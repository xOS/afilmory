import { tenantApiClient } from '@/api/client'
import { camelCaseKeys } from '@/modules/auth/case'

import type {
  CommentsListResponse,
  CommentStatus,
  DashboardAnalyticsResponse,
  DashboardOverviewResponse,
  DataSyncConflict,
  DataSyncStatus,
  SiteSettingKey,
  SiteSettingUiSchemaResponse,
} from './types'

export async function fetchDashboardOverview(): Promise<DashboardOverviewResponse> {
  return camelCaseKeys(await tenantApiClient('/dashboard/overview'))
}

export async function fetchDashboardAnalytics(): Promise<DashboardAnalyticsResponse> {
  return camelCaseKeys(await tenantApiClient('/dashboard/analytics'))
}

export async function listComments(query: {
  cursor?: string
  limit?: number
  status?: CommentStatus
}): Promise<CommentsListResponse> {
  return camelCaseKeys(
    await tenantApiClient('/comments/all', {
      method: 'GET',
      query,
    }),
  )
}

export async function deleteComment(id: string): Promise<void> {
  await tenantApiClient(`/comments/${id}`, { method: 'DELETE' })
}

export async function getSiteSettings(): Promise<SiteSettingUiSchemaResponse> {
  return camelCaseKeys(await tenantApiClient('/site/settings/ui-schema'))
}

export async function updateSiteSettings(entries: Array<{ key: SiteSettingKey, value: string }>): Promise<void> {
  await tenantApiClient('/site/settings', {
    body: { entries },
    method: 'POST',
  })
}

export async function getDataSyncStatus(): Promise<DataSyncStatus> {
  return camelCaseKeys(await tenantApiClient('/data-sync/status'))
}

export async function listDataSyncConflicts(): Promise<DataSyncConflict[]> {
  return camelCaseKeys(await tenantApiClient('/data-sync/conflicts'))
}

export async function resolveDataSyncConflict(
  id: string,
  strategy: 'prefer-database' | 'prefer-storage',
): Promise<void> {
  await tenantApiClient(`/data-sync/conflicts/${id}/resolve`, {
    body: { dryRun: false, strategy },
    method: 'POST',
  })
}
