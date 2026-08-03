import { DatabaseModule } from '@core/database/database.module'
import { Module } from '@tsuki-hono/common'

import { GallerySubscriptionController } from './gallery-subscription.controller'
import { GallerySubscriptionService } from './gallery-subscription.service'

@Module({
  imports: [DatabaseModule],
  controllers: [GallerySubscriptionController],
  providers: [GallerySubscriptionService],
})
export class GallerySubscriptionModule {}
