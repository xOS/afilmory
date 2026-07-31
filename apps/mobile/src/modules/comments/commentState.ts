import type { CommentCollection, CommentPage, PhotoComment } from './types'

const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>()

function getRelativeTimeFormatter(locale: string): Intl.RelativeTimeFormat {
  const cached = relativeTimeFormatters.get(locale)
  if (cached) {
    return cached
  }
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  relativeTimeFormatters.set(locale, formatter)
  return formatter
}

export function emptyCommentCollection(): CommentCollection {
  return { comments: [], relations: {}, users: {} }
}

export function mergeCommentPage(
  current: CommentCollection,
  incoming: Omit<CommentPage, 'nextCursor'>,
  replace = false,
): CommentCollection {
  const comments = replace ? [] : [...current.comments]
  const positions = new Map(comments.map((comment, index) => [comment.id, index]))

  for (const comment of incoming.comments) {
    const position = positions.get(comment.id)
    if (position === undefined) {
      positions.set(comment.id, comments.length)
      comments.push(comment)
    }
    else {
      comments[position] = comment
    }
  }
  comments.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))

  return {
    comments,
    relations: replace ? { ...incoming.relations } : { ...current.relations, ...incoming.relations },
    users: replace ? { ...incoming.users } : { ...current.users, ...incoming.users },
  }
}

export function replaceComment(collection: CommentCollection, nextComment: PhotoComment): CommentCollection {
  const position = collection.comments.findIndex(comment => comment.id === nextComment.id)
  if (position < 0) {
    return collection
  }
  const comments = [...collection.comments]
  const current = comments[position]
  comments[position] = current.clientId
    ? { ...nextComment, clientId: current.clientId, deliveryState: current.deliveryState }
    : nextComment
  return { ...collection, comments }
}

export function settleOptimisticComment(
  collection: CommentCollection,
  clientId: string,
  incoming: Omit<CommentPage, 'nextCursor'>,
): CommentCollection {
  const comments = collection.comments.filter(comment => comment.clientId !== clientId)
  const settledComments = incoming.comments.map((comment, index) =>
    index === 0 ? { ...comment, clientId, deliveryState: 'sent' as const } : comment)
  return mergeCommentPage({ ...collection, comments }, { ...incoming, comments: settledComments })
}

export function removeOptimisticComment(collection: CommentCollection, clientId: string): CommentCollection {
  const comments = collection.comments.filter(comment => comment.clientId !== clientId)
  return comments.length === collection.comments.length ? collection : { ...collection, comments }
}

export function toggleLocalReaction(comment: PhotoComment, reaction = 'like'): PhotoComment {
  const active = comment.viewerReactions.includes(reaction)
  const currentCount = comment.reactionCounts[reaction] ?? 0
  return {
    ...comment,
    reactionCounts: {
      ...comment.reactionCounts,
      [reaction]: Math.max(0, currentCount + (active ? -1 : 1)),
    },
    viewerReactions: active
      ? comment.viewerReactions.filter(item => item !== reaction)
      : [...comment.viewerReactions, reaction],
  }
}

export function formatCommentRelativeTime(iso: string, locale: string, now = Date.now()): string {
  const timestamp = new Date(iso).getTime()
  if (!Number.isFinite(timestamp)) {
    return ''
  }

  const rawDiff = Math.floor((now - timestamp) / 1000)
  const diffSeconds = Math.min(Math.max(rawDiff, -2_592_000), 2_592_000)
  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'seconds'],
    [60, 'minutes'],
    [24, 'hours'],
    [7, 'days'],
    [4.34524, 'weeks'],
    [12, 'months'],
    [Number.POSITIVE_INFINITY, 'years'],
  ]

  let unit: Intl.RelativeTimeFormatUnit = 'seconds'
  let value = diffSeconds
  for (const [amount, nextUnit] of divisions) {
    if (Math.abs(value) < amount) {
      unit = nextUnit
      break
    }
    value /= amount
  }

  return getRelativeTimeFormatter(locale).format(Math.round(-value), unit)
}
