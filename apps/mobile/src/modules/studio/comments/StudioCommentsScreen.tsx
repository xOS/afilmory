import {
  Button,
  ContentUnavailableView,
  ContextMenu,
  Form,
  HStack,
  Image,
  Picker,
  ProgressView,
  Section,
  Spacer,
  SwipeActions,
  Text,
  VStack,
} from '@expo/ui/swift-ui'
import {
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listStyle,
  pickerStyle,
  refreshable,
  tag,
} from '@expo/ui/swift-ui/modifiers'
import { useCallback, useMemo, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { Alert, StyleSheet, View } from 'react-native'

import { getIntlLocale, useTranslation } from '@/i18n'
import { supportsStudioSplitView } from '@/modules/shell/adaptiveLayout'

import { deleteComment, listComments } from '../api'
import { formatDateTime } from '../format'
import { StudioAccessBoundary, StudioErrorState, StudioHost, StudioLoadingState } from '../StudioNative'
import type { CommentsListResponse, CommentStatus, StudioComment, StudioCommentUser } from '../types'
import { useRemoteResource } from '../useRemoteResource'

type CommentFilter = 'all' | CommentStatus

export function StudioCommentsScreen() {
  return (
    <StudioAccessBoundary>
      <StudioCommentsController />
    </StudioAccessBoundary>
  )
}

function StudioCommentsController() {
  const [filter, setFilter] = useState<CommentFilter>('pending')
  return <StudioCommentsContent key={filter} filter={filter} onFilterChange={setFilter} />
}

function StudioCommentsContent({
  filter,
  onFilterChange,
}: {
  filter: CommentFilter
  onFilterChange: (filter: CommentFilter) => void
}) {
  const { i18n, t } = useTranslation()
  const locale = getIntlLocale(i18n.resolvedLanguage)
  const load = useCallback(() => listComments({ limit: 20, status: filter === 'all' ? undefined : filter }), [filter])
  const resource = useRemoteResource(load, [load])
  const [pages, setPages] = useState<CommentsListResponse[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [contentWidth, setContentWidth] = useState(0)

  const comments = useMemo(
    () => [...(resource.data?.comments ?? []), ...pages.flatMap(page => page.comments)],
    [pages, resource.data?.comments],
  )
  const users = useMemo(
    () => Object.assign({}, resource.data?.users ?? {}, ...pages.map(page => page.users)),
    [pages, resource.data?.users],
  ) as Record<string, StudioCommentUser>
  const nextCursor = pages.at(-1)?.nextCursor ?? resource.data?.nextCursor ?? null
  const usesSplitView = supportsStudioSplitView(contentWidth)
  const selectedComment
    = comments.find(comment => comment.id === selectedCommentId) ?? (usesSplitView ? comments[0] : null)

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    setContentWidth(current => (current === width ? current : width))
  }, [])

  const refresh = useCallback(async () => {
    setPages([])
    await resource.reload()
  }, [resource])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) {
      return
    }
    setLoadingMore(true)
    try {
      const page = await listComments({
        cursor: nextCursor,
        limit: 20,
        status: filter === 'all' ? undefined : filter,
      })
      setPages(current => [...current, page])
    }
    catch (error) {
      Alert.alert(t('studio.comments.loadMoreFailed'), error instanceof Error ? error.message : undefined)
    }
    finally {
      setLoadingMore(false)
    }
  }, [filter, loadingMore, nextCursor, t])

  const confirmDelete = useCallback(
    (id: string) => {
      Alert.alert(t('studio.comments.delete.title'), t('studio.comments.delete.description'), [
        { style: 'cancel', text: t('common.cancel') },
        {
          style: 'destructive',
          text: t('common.delete'),
          onPress: () => {
            setDeletingId(id)
            void deleteComment(id)
              .then(refresh)
              .catch((error) => {
                Alert.alert(t('studio.comments.delete.failed'), error instanceof Error ? error.message : undefined)
              })
              .finally(() => setDeletingId(null))
          },
        },
      ])
    },
    [refresh, t],
  )

  if (resource.loading && !resource.data) {
    return <StudioLoadingState />
  }
  if (resource.error && !resource.data) {
    return <StudioErrorState message={resource.error.message} onRetry={() => void resource.reload()} />
  }
  if (!resource.data) {
    return null
  }

  const list = (
    <Form modifiers={[listStyle('insetGrouped'), refreshable(refresh)]}>
      <Section>
        <Picker
          label={t('studio.comments.filter')}
          modifiers={[pickerStyle('menu')]}
          selection={filter}
          onSelectionChange={value => onFilterChange(value as CommentFilter)}
        >
          {(['pending', 'all', 'approved', 'hidden', 'rejected'] as const).map(value => (
            <Text key={value} modifiers={[tag(value)]}>
              {t(`studio.comments.status.${value}`)}
            </Text>
          ))}
        </Picker>
      </Section>

      <Section title={t('studio.comments.results', { count: comments.length })}>
        {comments.length === 0 ? (
          <ContentUnavailableView
            description={t('studio.comments.empty.description')}
            systemImage="text.bubble"
            title={t('studio.comments.empty.title')}
          />
        ) : (
          comments.map(comment => (
            <CommentRow
              key={comment.id}
              comment={comment}
              deleting={deletingId === comment.id}
              locale={locale}
              selected={usesSplitView && selectedComment?.id === comment.id}
              user={users[comment.userId]}
              onDelete={() => confirmDelete(comment.id)}
              onPress={usesSplitView ? () => setSelectedCommentId(comment.id) : undefined}
            />
          ))
        )}
        {nextCursor ? (
          <Button
            label={loadingMore ? t('studio.comments.loadingMore') : t('studio.comments.loadMore')}
            onPress={() => void loadMore()}
          />
        ) : null}
      </Section>
    </Form>
  )

  return (
    <View style={styles.root} onLayout={handleLayout}>
      {usesSplitView ? (
        <View style={styles.splitView}>
          <View style={styles.listPane}>
            <StudioHost>{list}</StudioHost>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailPane}>
            <StudioHost>
              <Form modifiers={[listStyle('insetGrouped')]}>
                <CommentDetail
                  comment={selectedComment}
                  deleting={selectedComment?.id === deletingId}
                  locale={locale}
                  user={selectedComment ? users[selectedComment.userId] : undefined}
                  onDelete={selectedComment ? () => confirmDelete(selectedComment.id) : undefined}
                />
              </Form>
            </StudioHost>
          </View>
        </View>
      ) : (
        <StudioHost>{list}</StudioHost>
      )}
    </View>
  )
}

function CommentRow({
  comment,
  deleting,
  locale,
  onDelete,
  onPress,
  selected,
  user,
}: {
  comment: StudioComment
  deleting: boolean
  locale: string
  onDelete: () => void
  onPress?: () => void
  selected: boolean
  user?: StudioCommentUser
}) {
  const { t } = useTranslation()
  const reactionCount = Object.values(comment.reactionCounts).reduce((sum, count) => sum + count, 0)
  const content = (
    <HStack spacing={12}>
      <Image color={selected ? '#0a84ff' : 'secondary'} size={22} systemName="person.crop.circle" />
      <VStack alignment="leading" spacing={3}>
        <HStack spacing={6}>
          <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
            {user?.name ?? t('studio.comments.unknownUser')}
          </Text>
          <Text
            modifiers={[foregroundStyle({ style: 'secondary', type: 'hierarchical' }), font({ textStyle: 'caption' })]}
          >
            {t(`studio.comments.status.${comment.status}`)}
          </Text>
        </HStack>
        <Text modifiers={[font({ textStyle: 'body' }), lineLimit(3)]}>{comment.content}</Text>
        <HStack spacing={6}>
          <Text
            modifiers={[foregroundStyle({ style: 'secondary', type: 'hierarchical' }), font({ textStyle: 'caption' })]}
          >
            {formatDateTime(comment.createdAt, locale) ?? ''}
          </Text>
          {reactionCount > 0 ? (
            <Text
              modifiers={[
                foregroundStyle({ style: 'secondary', type: 'hierarchical' }),
                font({ textStyle: 'caption' }),
              ]}
            >
              · ♥
              {' '}
              {reactionCount}
            </Text>
          ) : null}
        </HStack>
      </VStack>
      <Spacer />
      {deleting ? <ProgressView /> : selected ? <Image color="#0a84ff" size={13} systemName="checkmark" /> : null}
    </HStack>
  )

  return (
    <SwipeActions>
      <ContextMenu>
        <ContextMenu.Trigger>
          {onPress ? (
            <Button
              modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, alignment: 'leading' })]}
              onPress={onPress}
            >
              {content}
            </Button>
          ) : (
            content
          )}
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          <Button label={t('common.delete')} role="destructive" onPress={onDelete} />
        </ContextMenu.Items>
      </ContextMenu>
      <SwipeActions.Actions edge="trailing">
        <Button label={t('common.delete')} role="destructive" onPress={onDelete} />
      </SwipeActions.Actions>
    </SwipeActions>
  )
}

function CommentDetail({
  comment,
  deleting,
  locale,
  onDelete,
  user,
}: {
  comment: StudioComment | null
  deleting: boolean
  locale: string
  onDelete?: () => void
  user?: StudioCommentUser
}) {
  const { t } = useTranslation()
  if (!comment) {
    return (
      <Section>
        <ContentUnavailableView
          description={t('studio.comments.empty.description')}
          systemImage="text.bubble"
          title={t('studio.comments.empty.title')}
        />
      </Section>
    )
  }

  const reactionCount = Object.values(comment.reactionCounts).reduce((sum, count) => sum + count, 0)
  return (
    <>
      <Section title={user?.name ?? t('studio.comments.unknownUser')}>
        <VStack alignment="leading" spacing={10}>
          <Text modifiers={[font({ textStyle: 'body' })]}>{comment.content}</Text>
          <Text modifiers={[foregroundStyle({ style: 'secondary', type: 'hierarchical' })]}>
            {t(`studio.comments.status.${comment.status}`)}
            {' · '}
            {formatDateTime(comment.createdAt, locale) ?? ''}
          </Text>
          <Text
            modifiers={[
              foregroundStyle({ style: 'secondary', type: 'hierarchical' }),
              font({ design: 'monospaced', textStyle: 'caption' }),
            ]}
          >
            {comment.photoId}
          </Text>
          {reactionCount > 0 ? (
            <Text>
              ♥
              {reactionCount}
            </Text>
          ) : null}
        </VStack>
      </Section>
      <Section>
        {deleting ? <ProgressView /> : <Button label={t('common.delete')} role="destructive" onPress={onDelete} />}
      </Section>
    </>
  )
}

const styles = StyleSheet.create({
  detailPane: { flex: 1 },
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.12)', width: StyleSheet.hairlineWidth },
  listPane: { maxWidth: 430, minWidth: 340, width: '38%' },
  root: { flex: 1 },
  splitView: { flex: 1, flexDirection: 'row' },
})
