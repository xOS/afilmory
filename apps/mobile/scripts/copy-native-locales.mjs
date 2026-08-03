import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(scriptDirectory, '../../..')
const outputDirectory = resolve(scriptDirectory, '../modules/photo-masonry/ios/Resources/Locales')

await mkdir(outputDirectory, { recursive: true })

for (const namespace of ['app', 'mobile']) {
  const sourceDirectory = resolve(workspaceRoot, 'locales', namespace)
  const files = (await readdir(sourceDirectory)).filter(file => file.endsWith('.json'))
  await Promise.all(
    files.map(file => copyFile(resolve(sourceDirectory, file), resolve(outputDirectory, `${namespace}-${file}`))),
  )
}
