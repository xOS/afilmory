import {
  Button,
  Form,
  Grid,
  HStack,
  Image,
  Label,
  LabeledContent,
  ProgressView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui'
import {
  background,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  listStyle,
  padding,
  refreshable,
  shapes,
} from '@expo/ui/swift-ui/modifiers'
import { useRouter } from 'expo-router'
import type { ComponentProps } from 'react'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'

import { getIntlLocale, useTranslation } from '@/i18n'
import { signOut, switchWorkspace, useAuth } from '@/modules/auth/sessionStore'
import { supportsStudioGrid } from '@/modules/shell/adaptiveLayout'

import { fetchStudioHome } from './api'
import { formatBytes, formatCount, formatDateTime } from './format'
import { StudioAccessBoundary, StudioErrorState, StudioHost, StudioLoadingState } from './StudioNative'
import { useRemoteResource } from './useRemoteResource'

type StudioPath = '/studio/analytics' | '/studio/comments' | '/studio/library' | '/studio/operations' | '/studio/site'
type StudioSymbol = NonNullable<ComponentProps<typeof Image>['systemName']>

export function StudioHomeScreen() {
  return (
    <StudioAccessBoundary>
      <StudioHomeContent />
    </StudioAccessBoundary>
  )
}

function StudioHomeContent() {
  const { i18n, t } = useTranslation()
  const auth = useAuth()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const load = useCallback(() => fetchStudioHome(), [])
  const resource = useRemoteResource(load, [load])
  const locale = getIntlLocale(i18n.resolvedLanguage)

  const navigate = useCallback((path: StudioPath) => router.push(path), [router])
  const handleSignOut = useCallback(async () => {
    if (signingOut) {
      return
    }
    setSigningOut(true)
    try {
      await signOut()
    }
    finally {
      setSigningOut(false)
    }
  }, [signingOut])
  const handleWorkspaceSwitch = useCallback(
    async (tenantId: string) => {
      if (switchingWorkspaceId) {
        return
      }
      setSwitchingWorkspaceId(tenantId)
      try {
        await switchWorkspace(tenantId)
        await resource.reload()
      }
      catch (error) {
        Alert.alert(t('studio.error.title'), error instanceof Error ? error.message : t('studio.error.description'))
      }
      finally {
        setSwitchingWorkspaceId(null)
      }
    },
    [resource, switchingWorkspaceId, t],
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

  const { overview, pendingComments, pendingCommentsHasMore, syncStatus } = resource.data
  const lastSync = formatDateTime(syncStatus.lastRun?.completedAt, locale)
  const pendingLabel = pendingCommentsHasMore
    ? `${formatCount(pendingComments, locale)}+`
    : formatCount(pendingComments, locale)
  const usesMetricGrid = supportsStudioGrid(contentWidth)
  const manageableMemberships
    = auth.session?.memberships.filter(
      membership =>
        membership.status === 'active'
        && membership.workspace.status === 'active'
        && (membership.role === 'admin' || membership.role === 'owner'),
    ) ?? []

  return (
    <StudioHost onWidthChange={setContentWidth}>
      <Form modifiers={[listStyle('insetGrouped'), refreshable(async () => void (await resource.reload()))]}>
        <Section title={t('studio.home.workspace')}>
          <LabeledContent label={t('studio.home.workspaceName')}>
            <Text>{auth.session?.activeWorkspace?.name ?? ''}</Text>
          </LabeledContent>
          <LabeledContent label={t('studio.home.signedInAs')}>
            <Text>{auth.session?.user.email ?? ''}</Text>
          </LabeledContent>
          {manageableMemberships
            .filter(membership => membership.workspace.id !== auth.session?.activeWorkspace?.id)
            .map(membership => (
              <Button
                key={membership.id}
                label={membership.workspace.name}
                modifiers={[buttonStyle('borderless')]}
                onPress={() => void handleWorkspaceSwitch(membership.workspace.id)}
              />
            ))}
          {switchingWorkspaceId ? <ProgressView /> : null}
        </Section>

        <Section title={t('studio.home.overview')}>
          {usesMetricGrid ? (
            <Grid alignment="leading" horizontalSpacing={12} verticalSpacing={12}>
              <Grid.Row>
                <StudioMetric
                  label={t('studio.metric.photos')}
                  value={formatCount(overview.stats.totalPhotos, locale)}
                />
                <StudioMetric
                  label={t('studio.metric.storage')}
                  value={formatBytes(overview.stats.totalStorageBytes, locale)}
                />
              </Grid.Row>
              <Grid.Row>
                <StudioMetric
                  label={t('studio.metric.monthUploads')}
                  value={formatCount(overview.stats.thisMonthUploads, locale)}
                />
                <StudioMetric label={t('studio.metric.pendingComments')} value={pendingLabel} />
              </Grid.Row>
            </Grid>
          ) : (
            <>
              <LabeledContent label={t('studio.metric.photos')}>
                <Text modifiers={[font({ design: 'rounded', weight: 'semibold' })]}>
                  {formatCount(overview.stats.totalPhotos, locale)}
                </Text>
              </LabeledContent>
              <LabeledContent label={t('studio.metric.storage')}>
                <Text modifiers={[font({ design: 'rounded', weight: 'semibold' })]}>
                  {formatBytes(overview.stats.totalStorageBytes, locale)}
                </Text>
              </LabeledContent>
              <LabeledContent label={t('studio.metric.monthUploads')}>
                <Text modifiers={[font({ design: 'rounded', weight: 'semibold' })]}>
                  {formatCount(overview.stats.thisMonthUploads, locale)}
                </Text>
              </LabeledContent>
              <LabeledContent label={t('studio.metric.pendingComments')}>
                <Text>{pendingLabel}</Text>
              </LabeledContent>
            </>
          )}
        </Section>

        <Section title={t('studio.home.manage')}>
          <StudioRouteRow
            detail={t('studio.library.subtitle')}
            icon="photo.on.rectangle.angled"
            title={t('studio.library.title')}
            onPress={() => navigate('/studio/library')}
          />
          <StudioRouteRow
            badgeValue={pendingComments > 0 ? pendingLabel : undefined}
            detail={t('studio.comments.subtitle')}
            icon="text.bubble"
            title={t('studio.comments.title')}
            onPress={() => navigate('/studio/comments')}
          />
          <StudioRouteRow
            detail={t('studio.analytics.subtitle')}
            icon="chart.xyaxis.line"
            title={t('studio.analytics.title')}
            onPress={() => navigate('/studio/analytics')}
          />
          <StudioRouteRow
            detail={t('studio.site.subtitle')}
            icon="paintpalette"
            title={t('studio.site.title')}
            onPress={() => navigate('/studio/site')}
          />
        </Section>

        <Section title={t('studio.operations.title')}>
          <StudioRouteRow
            badgeValue={overview.stats.sync.conflicts > 0 ? String(overview.stats.sync.conflicts) : undefined}
            detail={lastSync ?? t('studio.operations.neverSynced')}
            icon="arrow.triangle.2.circlepath"
            title={t('studio.operations.sync')}
            onPress={() => navigate('/studio/operations')}
          />
          <LabeledContent label={t('studio.metric.pendingSync')}>
            <Text>{formatCount(overview.stats.sync.pending, locale)}</Text>
          </LabeledContent>
          <LabeledContent label={t('studio.metric.conflicts')}>
            <Text>{formatCount(overview.stats.sync.conflicts, locale)}</Text>
          </LabeledContent>
        </Section>

        {overview.recentActivity.length > 0 ? (
          <Section title={t('studio.home.recent')}>
            {overview.recentActivity.slice(0, 4).map(activity => (
              <HStack key={activity.id} spacing={12}>
                <Image
                  color={statusColor(activity.syncStatus)}
                  size={18}
                  systemName={statusSymbol(activity.syncStatus)}
                />
                <VStack alignment="leading" spacing={2}>
                  <Text modifiers={[font({ textStyle: 'body', weight: 'medium' })]}>{activity.title}</Text>
                  <Text
                    modifiers={[
                      foregroundStyle({ style: 'secondary', type: 'hierarchical' }),
                      font({ textStyle: 'caption' }),
                    ]}
                  >
                    {formatDateTime(activity.createdAt, locale) ?? activity.storageProvider}
                  </Text>
                </VStack>
              </HStack>
            ))}
          </Section>
        ) : null}

        <Section>
          <Button
            label={signingOut ? t('studio.account.signingOut') : t('common.signOut')}
            modifiers={[buttonStyle('borderless')]}
            role="destructive"
            onPress={() => void handleSignOut()}
          />
          {resource.refreshing ? <ProgressView /> : null}
        </Section>
      </Form>
    </StudioHost>
  )
}

function StudioMetric({ label, value }: { label: string, value: string }) {
  return (
    <VStack
      alignment="leading"
      modifiers={[
        frame({ maxWidth: Infinity, minHeight: 78, alignment: 'leading' }),
        padding({ all: 12 }),
        background('#2c2c2e', shapes.roundedRectangle({ cornerRadius: 12, roundedCornerStyle: 'continuous' })),
      ]}
      spacing={5}
    >
      <Text modifiers={[font({ design: 'rounded', textStyle: 'title2', weight: 'semibold' })]}>{value}</Text>
      <Text modifiers={[foregroundStyle({ style: 'secondary', type: 'hierarchical' }), font({ textStyle: 'caption' })]}>
        {label}
      </Text>
    </VStack>
  )
}

function StudioRouteRow({
  badgeValue,
  detail,
  icon,
  onPress,
  title,
}: {
  badgeValue?: string
  detail: string
  icon: StudioSymbol
  onPress: () => void
  title: string
}) {
  return (
    <Button modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, alignment: 'leading' })]} onPress={onPress}>
      <HStack spacing={12}>
        <Label systemImage={icon} />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ textStyle: 'body', weight: 'medium' })]}>{title}</Text>
          <Text
            modifiers={[foregroundStyle({ style: 'secondary', type: 'hierarchical' }), font({ textStyle: 'caption' })]}
          >
            {detail}
          </Text>
        </VStack>
        <Spacer />
        {badgeValue ? (
          <Text modifiers={[foregroundStyle({ style: 'secondary', type: 'hierarchical' })]}>{badgeValue}</Text>
        ) : null}
        <Image color="secondary" size={12} systemName="chevron.right" />
      </HStack>
    </Button>
  )
}

function statusSymbol(status: 'conflict' | 'pending' | 'synced'): StudioSymbol {
  switch (status) {
    case 'conflict':
      return 'exclamationmark.triangle.fill'
    case 'pending':
      return 'clock.fill'
    case 'synced':
      return 'checkmark.circle.fill'
  }
}

function statusColor(status: 'conflict' | 'pending' | 'synced'): string {
  switch (status) {
    case 'conflict':
      return '#ff453a'
    case 'pending':
      return '#ff9f0a'
    case 'synced':
      return '#30d158'
  }
}
