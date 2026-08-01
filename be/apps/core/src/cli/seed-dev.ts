import { stdout } from 'node:process'

import { CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand, S3Client } from '@aws-sdk/client-s3'

import { APP_GLOBAL_PREFIX } from '../app.constants'
import { createConfiguredApp } from '../app.factory'
import { PgPoolProvider } from '../database/database.provider'
import { logger } from '../helpers/logger.helper'
import { StorageSettingService } from '../modules/configuration/storage-setting/storage-setting.service'
import { SystemSettingService } from '../modules/configuration/system-setting/system-setting.service'
import { TenantService } from '../modules/platform/tenant/tenant.service'
import { RedisProvider } from '../redis/redis.provider'

const SEED_FLAG = '--seed-dev'

const DEFAULTS = {
  accessKeyId: 'rustfsadmin',
  bucket: 'afilmory-dev',
  endpoint: 'http://localhost:9300',
  gatewayUrl: 'http://localhost:1841',
  region: 'us-east-1',
  secretAccessKey: 'rustfsadmin',
} as const

export interface SeedDevCliOptions {
  accessKeyId: string
  bucket: string
  endpoint: string
  gatewayUrl: string
  region: string
  secretAccessKey: string
  slug: string | null
}

const VALUE_FLAGS = {
  '--access-key': 'accessKeyId',
  '--bucket': 'bucket',
  '--endpoint': 'endpoint',
  '--gateway-url': 'gatewayUrl',
  '--region': 'region',
  '--secret-key': 'secretAccessKey',
  '--slug': 'slug',
} as const satisfies Record<string, keyof SeedDevCliOptions>

export function parseSeedDevCliArgs(args: readonly string[]): SeedDevCliOptions | null {
  if (!args.includes(SEED_FLAG)) {
    return null
  }

  const options: SeedDevCliOptions = { ...DEFAULTS, slug: null }

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (!arg || !arg.startsWith('--')) {
      continue
    }

    const [flag, inline] = arg.includes('=')
      ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
      : [arg, null]
    if (!(flag in VALUE_FLAGS)) {
      continue
    }

    const field = VALUE_FLAGS[flag as keyof typeof VALUE_FLAGS]
    let value = inline
    if (value === null) {
      const next = args[index + 1]
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for ${flag}`)
      }
      value = next
      index++
    }

    const trimmed = value.trim()
    if (trimmed.length === 0) {
      throw new Error(`Missing value for ${flag}`)
    }
    options[field] = trimmed
  }

  return options
}

async function ensureBucket(options: SeedDevCliOptions): Promise<'created' | 'exists'> {
  // RustFS rejects virtual-host bucket addressing with `NotImplemented`, so
  // path-style is mandatory here and in the storage provider config below.
  const client = new S3Client({
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    endpoint: options.endpoint,
    forcePathStyle: true,
    region: options.region,
  })

  try {
    let state: 'created' | 'exists' = 'exists'
    try {
      await client.send(new HeadBucketCommand({ Bucket: options.bucket }))
    }
    catch {
      await client.send(new CreateBucketCommand({ Bucket: options.bucket }))
      state = 'created'
    }

    // The manifest hands out thumbnail URLs straight from the bucket rather
    // than through /api/storage/sign, so a private bucket renders the whole
    // grid as broken images even with secure access enabled.
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: options.bucket,
        Policy: JSON.stringify({
          Statement: [
            {
              Action: ['s3:GetObject'],
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Resource: [`arn:aws:s3:::${options.bucket}/*`],
              Sid: 'PublicRead',
            },
          ],
          Version: '2012-10-17',
        }),
      }),
    )

    return state
  }
  finally {
    client.destroy()
  }
}

export async function handleSeedDevCli(options: SeedDevCliOptions): Promise<void> {
  const app = await createConfiguredApp({ globalPrefix: APP_GLOBAL_PREFIX })
  const container = app.getContainer()
  const poolProvider = container.resolve(PgPoolProvider)
  const redisProvider = container.resolve(RedisProvider)
  const summary: string[] = []

  try {
    const bucketState = await ensureBucket(options)
    summary.push(`bucket ${options.bucket} ${bucketState}`)

    const systemSettings = container.resolve(SystemSettingService)
    await systemSettings.updateSettings({ oauthGatewayUrl: options.gatewayUrl })
    summary.push(`oauthGatewayUrl = ${options.gatewayUrl}`)

    if (options.slug) {
      const tenantId = await resolveTenantId(container.resolve(TenantService), options.slug)
      await configureTenantStorage(container.resolve(StorageSettingService), tenantId, options)
      summary.push(`workspace ${options.slug} storage -> ${options.endpoint}/${options.bucket}`)
    }
    else {
      summary.push('no --slug given, skipped workspace storage configuration')
    }

    stdout.write(`\nLocal dev seed complete\n${summary.map(line => `  - ${line}`).join('\n')}\n\n`)
  }
  finally {
    await app.close('cli')

    try {
      await poolProvider.getPool().end()
    }
    catch (error) {
      logger.warn(`Failed to close PostgreSQL pool cleanly: ${String(error)}`)
    }

    try {
      redisProvider.getClient().disconnect()
    }
    catch (error) {
      logger.warn(`Failed to disconnect Redis client cleanly: ${String(error)}`)
    }
  }
}

async function resolveTenantId(tenantService: TenantService, slug: string): Promise<string> {
  const tenant = await tenantService.resolve({ slug }, { noThrow: true })
  if (!tenant) {
    throw new Error(`No workspace found for slug "${slug}". Sign in and create it first, then re-run with --slug.`)
  }
  return tenant.tenant.id
}

async function configureTenantStorage(
  storageSettings: StorageSettingService,
  tenantId: string,
  options: SeedDevCliOptions,
): Promise<void> {
  const provider = {
    config: {
      accessKeyId: options.accessKeyId,
      bucket: options.bucket,
      customDomain: '',
      endpoint: options.endpoint,
      excludeRegex: '',
      prefix: '',
      region: options.region,
      secretAccessKey: options.secretAccessKey,
    },
    id: 'local-rustfs',
    name: 'Local RustFS',
    type: 's3',
  }

  await storageSettings.setMany([
    { key: 'builder.storage.providers', options: { tenantId }, value: JSON.stringify([provider]) },
    { key: 'builder.storage.activeProvider', options: { tenantId }, value: provider.id },
    // Without this the manifest hands out unsigned public URLs, which a
    // freshly created RustFS bucket answers with 403.
    { key: 'photo.storage.secureAccess', options: { tenantId }, value: 'true' },
  ])
}
