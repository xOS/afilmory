import { describe, expect, it, vi } from 'vitest'

import { AppStoreBillingService } from './app-store-billing.service'

describe('app store billing service', () => {
  it('reconciles a verified sandbox purchase on the production service', async () => {
    const subject = {
      appAccountToken: '134a1ab0-6c0b-4244-8d4a-e17151985731',
      billingOwnerUserId: 'user-1',
      tenantId: 'tenant-1',
      tombstonedAt: null,
    }
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([subject]) }),
        }),
      }),
    }
    const catalog = {
      findOfferByProduct: vi.fn().mockResolvedValue({
        applicationPlanId: 'pro',
        externalProductId: 'app.afilmory.subscription.pro',
        id: 'plan:pro',
        rank: 100,
        storagePlanId: null,
      }),
    }
    const entitlements = {
      reconcileSubscription: vi.fn().mockResolvedValue({ grants: [] }),
    }
    const signedData = {
      verifyTransaction: vi.fn().mockResolvedValue({
        appAccountToken: subject.appAccountToken,
        environment: 'Sandbox',
        expiresDate: Date.now() + 60_000,
        originalTransactionId: 'original-1',
        productId: 'app.afilmory.subscription.pro',
        purchaseDate: Date.now(),
        signedDate: Date.now(),
        transactionId: 'transaction-1',
      }),
    }
    const providerEvents = {
      track: vi.fn().mockImplementation(async (_event, _errorCode, reconcile) => ({
        duplicate: false,
        result: await reconcile(),
      })),
    }
    const service = new AppStoreBillingService(
      { get: () => db } as never,
      catalog as never,
      entitlements as never,
      signedData as never,
      providerEvents as never,
    )

    await expect(
      service.submitTransaction({
        billingOwnerUserId: 'user-1',
        signedTransactionInfo: 'sandbox-jws',
        tenantId: 'tenant-1',
      }),
    ).resolves.toMatchObject({ status: 'active', tenantId: 'tenant-1', transactionId: 'transaction-1' })
    expect(catalog.findOfferByProduct).toHaveBeenCalledWith('app_store', 'sandbox', 'app.afilmory.subscription.pro')
    expect(entitlements.reconcileSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'sandbox', tenantId: 'tenant-1' }),
    )
  })
})
