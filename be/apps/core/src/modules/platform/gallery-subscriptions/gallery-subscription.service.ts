import { gallerySubscriptions, tenantMemberships, tenants } from '@afilmory/db'
import { DbAccessor } from '@core/database/database.provider'
import { BizException, ErrorCode } from '@core/errors'
import { and, desc, eq } from 'drizzle-orm'
import { injectable } from 'tsyringe'

import { evaluateGallerySubscription } from './gallery-subscription.policy'

export interface GallerySubscriptionSummary {
  tenantId: string
  createdAt: string
}

@injectable()
export class GallerySubscriptionService {
  constructor(private readonly dbAccessor: DbAccessor) {}

  async listForUser(userId: string): Promise<GallerySubscriptionSummary[]> {
    const db = this.dbAccessor.get()
    return await db
      .select({
        tenantId: gallerySubscriptions.targetTenantId,
        createdAt: gallerySubscriptions.createdAt,
      })
      .from(gallerySubscriptions)
      .where(eq(gallerySubscriptions.subscriberUserId, userId))
      .orderBy(desc(gallerySubscriptions.createdAt))
  }

  async subscribe(userId: string, targetTenantId: string): Promise<GallerySubscriptionSummary> {
    const db = this.dbAccessor.get()
    const [[target], [activeMembership]] = await Promise.all([
      db
        .select({
          banned: tenants.banned,
          slug: tenants.slug,
          status: tenants.status,
        })
        .from(tenants)
        .where(eq(tenants.id, targetTenantId))
        .limit(1),
      db
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.userId, userId),
            eq(tenantMemberships.tenantId, targetTenantId),
            eq(tenantMemberships.status, 'active'),
          ),
        )
        .limit(1),
    ])

    const decision = evaluateGallerySubscription(target ?? null, Boolean(activeMembership))
    if (!decision.allowed) {
      if (decision.reason === 'own-gallery') {
        throw new BizException(ErrorCode.AUTH_FORBIDDEN, {
          message: 'A workspace member cannot subscribe to their own gallery.',
        })
      }
      throw new BizException(ErrorCode.COMMON_NOT_FOUND, { message: 'Gallery not found.' })
    }

    const [created] = await db
      .insert(gallerySubscriptions)
      .values({
        subscriberUserId: userId,
        targetTenantId,
      })
      .onConflictDoNothing()
      .returning({
        tenantId: gallerySubscriptions.targetTenantId,
        createdAt: gallerySubscriptions.createdAt,
      })

    if (created) {
      return created
    }

    const [existing] = await db
      .select({
        tenantId: gallerySubscriptions.targetTenantId,
        createdAt: gallerySubscriptions.createdAt,
      })
      .from(gallerySubscriptions)
      .where(
        and(eq(gallerySubscriptions.subscriberUserId, userId), eq(gallerySubscriptions.targetTenantId, targetTenantId)),
      )
      .limit(1)

    if (!existing) {
      throw new BizException(ErrorCode.COMMON_CONFLICT, {
        message: 'The gallery subscription could not be created.',
      })
    }

    return existing
  }

  async unsubscribe(userId: string, targetTenantId: string): Promise<boolean> {
    const db = this.dbAccessor.get()
    const deleted = await db
      .delete(gallerySubscriptions)
      .where(
        and(eq(gallerySubscriptions.subscriberUserId, userId), eq(gallerySubscriptions.targetTenantId, targetTenantId)),
      )
      .returning({ id: gallerySubscriptions.id })

    return deleted.length > 0
  }
}
