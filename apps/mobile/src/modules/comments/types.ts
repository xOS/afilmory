export type CommentStatus = 'approved' | 'pending' | 'hidden' | 'rejected'

export interface PhotoComment {
  clientId?: string
  id: string
  photoId: string
  parentId: string | null
  userId: string
  content: string
  deliveryState?: 'sending' | 'sent'
  status: CommentStatus
  createdAt: string
  updatedAt: string
  reactionCounts: Record<string, number>
  viewerReactions: string[]
}

export interface CommentUser {
  id: string
  name: string
  image: string | null
  website?: string | null
}

export interface CommentCollection {
  comments: PhotoComment[]
  relations: Record<string, PhotoComment>
  users: Record<string, CommentUser>
}

export interface CommentPage extends CommentCollection {
  nextCursor: string | null
}
