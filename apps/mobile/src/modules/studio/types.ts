import type { GalleryPhoto } from '@/modules/galleries/types'

export type PhotoSyncStatus = 'pending' | 'synced' | 'conflict'

export interface DashboardStats {
  totalPhotos: number
  totalStorageBytes: number
  thisMonthUploads: number
  previousMonthUploads: number
  sync: {
    synced: number
    pending: number
    conflicts: number
  }
}

export interface DashboardRecentActivityItem {
  id: string
  photoId: string
  title: string
  description: string | null
  createdAt: string
  takenAt: string | null
  storageProvider: string
  size: number | null
  syncStatus: PhotoSyncStatus
  tags: string[]
  previewUrl: string | null
}

export interface DashboardOverviewResponse {
  stats: DashboardStats
  recentActivity: DashboardRecentActivityItem[]
}

export interface UploadTrendPoint {
  month: string
  uploads: number
}

export interface StorageProviderUsage {
  provider: string
  bytes: number
  photoCount: number
}

export interface DashboardAnalyticsResponse {
  uploadTrends: UploadTrendPoint[]
  storageUsage: {
    totalBytes: number
    totalPhotos: number
    currentMonthBytes: number
    previousMonthBytes: number
    providers: StorageProviderUsage[]
  }
  popularTags: Array<{ tag: string, count: number }>
  topDevices: Array<{ device: string, count: number }>
}

export interface PhotoAssetListItem {
  id: string
  photoId: string
  storageKey: string
  storageProvider: string
  manifest: {
    version: string
    data: Partial<GalleryPhoto> & { id?: string }
  }
  syncedAt: string
  updatedAt: string
  createdAt: string
  publicUrl: string | null
  size: number | null
  syncStatus: PhotoSyncStatus
}

export interface PhotoAssetSummary {
  total: number
  synced: number
  conflicts: number
  pending: number
}

export type CommentStatus = 'approved' | 'pending' | 'hidden' | 'rejected'

export interface StudioComment {
  id: string
  photoId: string
  parentId: string | null
  userId: string
  content: string
  status: CommentStatus
  createdAt: string
  updatedAt: string
  reactionCounts: Record<string, number>
  viewerReactions: string[]
}

export interface StudioCommentUser {
  id: string
  name: string
  image: string | null
}

export interface CommentsListResponse {
  comments: StudioComment[]
  relations: Record<string, StudioComment>
  users: Record<string, StudioCommentUser>
  nextCursor: string | null
}

export type SiteSettingKey
  = | 'site.name'
    | 'site.title'
    | 'site.description'
    | 'site.url'
    | 'site.accentColor'
    | 'site.social.twitter'
    | 'site.social.github'
    | 'site.feed.folo.challenge.feedId'
    | 'site.feed.folo.challenge.userId'
    | 'site.map.providers'
    | 'site.mapStyle'
    | 'site.mapProjection'

export type UiFieldComponent
  = | {
    type: 'text'
    placeholder?: string
    inputType?: 'text' | 'email' | 'url' | 'number'
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
    autoCorrect?: boolean
  }
  | { type: 'textarea', placeholder?: string, minRows?: number, maxRows?: number }
  | {
    type: 'select'
    placeholder?: string
    options?: readonly string[]
    allowCustom?: boolean
    presentation?: 'automatic' | 'menu' | 'navigationLink' | 'segmented'
  }
  | { type: 'multiSelect', options: readonly string[] }
  | { type: 'color', supportsOpacity?: boolean }
  | { type: 'switch', trueLabel?: string, falseLabel?: string }
  | { type: 'secret', placeholder?: string, revealable?: boolean }
  | { type: 'slot', name: string }

export interface UiFieldNode {
  type: 'field'
  id: string
  title: string
  description?: string | null
  helperText?: string | null
  key: SiteSettingKey
  component: UiFieldComponent
  required?: boolean
  hidden?: boolean
}

export interface UiGroupNode {
  type: 'group'
  id: string
  title: string
  description?: string | null
  children: UiNode[]
}

export interface UiSectionNode {
  type: 'section'
  id: string
  title: string
  description?: string | null
  children: UiNode[]
}

export type UiNode = UiFieldNode | UiGroupNode | UiSectionNode

export interface SiteSettingUiSchemaResponse {
  schema: {
    version: string
    title: string
    description?: string | null
    sections: UiSectionNode[]
  }
  values: Partial<Record<SiteSettingKey, string | null>>
}

export interface DataSyncSummary {
  storageObjects: number
  databaseRecords: number
  inserted: number
  updated: number
  deleted: number
  conflicts: number
  skipped: number
  errors: number
}

export interface DataSyncRunRecord {
  id: string
  dryRun: boolean
  summary: DataSyncSummary
  actionsCount: number
  startedAt: string
  completedAt: string
}

export interface DataSyncStatus {
  lastRun: DataSyncRunRecord | null
}

export interface DataSyncConflict {
  id: string
  storageKey: string
  photoId: string | null
  reason: string | null
  storageProvider: string
  updatedAt: string
}

export type DataSyncProgressEvent
  = | { type: 'start', payload: { summary: DataSyncSummary } }
    | { type: 'stage', payload: { summary: DataSyncSummary, processed: number, total: number } }
    | { type: 'action', payload: { summary: DataSyncSummary, index: number, total: number } }
    | { type: 'complete', payload: { summary: DataSyncSummary } }
    | { type: 'error', payload: { message: string } }
    | { type: 'log', payload: { message: string } }

export interface StudioHomeData {
  overview: DashboardOverviewResponse
  pendingComments: number
  pendingCommentsHasMore: boolean
  syncStatus: DataSyncStatus
}
