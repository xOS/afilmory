import type { HttpContextAuth } from '@core/context/http-context.values'
import { AllowPlaceholderTenant } from '@core/decorators/allow-placeholder.decorator'
import { SkipTenantGuard } from '@core/decorators/skip-tenant.decorator'
import { BypassResponseTransform } from '@core/interceptors/response-transform.decorator'
import { Controller, Get, HttpContext } from '@tsuki-hono/common'

import { FeaturedGalleriesService } from './featured-galleries.service'

@Controller('featured-galleries')
@SkipTenantGuard()
@BypassResponseTransform()
export class FeaturedGalleriesController {
  constructor(private readonly featuredGalleriesService: FeaturedGalleriesService) {}

  @AllowPlaceholderTenant()
  @Get('/')
  async listFeaturedGalleries() {
    const auth = HttpContext.getValue('auth') as HttpContextAuth | undefined
    return await this.featuredGalleriesService.listFeaturedGalleries(auth?.user?.id)
  }
}
