import { createZodSchemaDto } from '@tsuki-hono/common'
import { z } from 'zod'

const gallerySubscriptionTargetSchema = z.object({
  tenantId: z.string().trim().min(1).max(128),
})

export class GallerySubscriptionTargetDto extends createZodSchemaDto(gallerySubscriptionTargetSchema) {}
