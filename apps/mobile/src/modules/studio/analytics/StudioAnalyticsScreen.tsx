import {
  Chart,
  ContentUnavailableView,
  Form,
  Grid,
  HStack,
  LabeledContent,
  ProgressView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui'
import {
  background,
  font,
  foregroundStyle,
  frame,
  listStyle,
  padding,
  refreshable,
  shapes,
} from '@expo/ui/swift-ui/modifiers'
import { useCallback, useState } from 'react'

import { getIntlLocale, useTranslation } from '@/i18n'
import { supportsStudioGrid } from '@/modules/shell/adaptiveLayout'
import { useTheme } from '@/theme/useTheme'

import { fetchDashboardAnalytics } from '../api'
import { formatBytes, formatCount, formatTrendMonth } from '../format'
import { StudioAccessBoundary, StudioErrorState, StudioHost, StudioLoadingState } from '../StudioNative'
import { useRemoteResource } from '../useRemoteResource'

export function StudioAnalyticsScreen() {
  return (
    <StudioAccessBoundary>
      <StudioAnalyticsContent />
    </StudioAccessBoundary>
  )
}

function StudioAnalyticsContent() {
  const { i18n, t } = useTranslation()
  const { palette } = useTheme()
  const locale = getIntlLocale(i18n.resolvedLanguage)
  const load = useCallback(() => fetchDashboardAnalytics(), [])
  const resource = useRemoteResource(load, [load])
  const [contentWidth, setContentWidth] = useState(0)

  if (resource.loading && !resource.data) {
    return <StudioLoadingState />
  }
  if (resource.error && !resource.data) {
    return <StudioErrorState message={resource.error.message} onRetry={() => void resource.reload()} />
  }
  if (!resource.data) {
    return null
  }

  const data = resource.data
  const maxProviderBytes = Math.max(...data.storageUsage.providers.map(provider => provider.bytes), 1)
  const usesMetricGrid = supportsStudioGrid(contentWidth)

  return (
    <StudioHost onWidthChange={setContentWidth}>
      <Form modifiers={[listStyle('insetGrouped'), refreshable(async () => void (await resource.reload()))]}>
        <Section title={t('studio.analytics.storage')}>
          {usesMetricGrid ? (
            <Grid alignment="leading" horizontalSpacing={12} verticalSpacing={12}>
              <Grid.Row>
                <AnalyticsMetric
                  label={t('studio.metric.storage')}
                  value={formatBytes(data.storageUsage.totalBytes, locale)}
                />
                <AnalyticsMetric
                  label={t('studio.metric.photos')}
                  value={formatCount(data.storageUsage.totalPhotos, locale)}
                />
              </Grid.Row>
              <Grid.Row>
                <AnalyticsMetric
                  label={t('studio.analytics.currentMonth')}
                  value={formatBytes(data.storageUsage.currentMonthBytes, locale)}
                />
                <AnalyticsMetric
                  label={t('studio.analytics.previousMonth')}
                  value={formatBytes(data.storageUsage.previousMonthBytes, locale)}
                />
              </Grid.Row>
            </Grid>
          ) : (
            <>
              <LabeledContent label={t('studio.metric.storage')}>
                <Text modifiers={[font({ design: 'rounded', weight: 'semibold' })]}>
                  {formatBytes(data.storageUsage.totalBytes, locale)}
                </Text>
              </LabeledContent>
              <LabeledContent label={t('studio.metric.photos')}>
                <Text>{formatCount(data.storageUsage.totalPhotos, locale)}</Text>
              </LabeledContent>
              <LabeledContent label={t('studio.analytics.currentMonth')}>
                <Text>{formatBytes(data.storageUsage.currentMonthBytes, locale)}</Text>
              </LabeledContent>
              <LabeledContent label={t('studio.analytics.previousMonth')}>
                <Text>{formatBytes(data.storageUsage.previousMonthBytes, locale)}</Text>
              </LabeledContent>
            </>
          )}
        </Section>

        <Section title={t('studio.analytics.uploadTrend')}>
          {data.uploadTrends.length > 0 ? (
            <Chart
              animate
              barStyle={{ cornerRadius: 4 }}
              data={data.uploadTrends.map(point => ({
                color: palette.accent,
                x: formatTrendMonth(point.month, locale),
                y: point.uploads,
              }))}
              modifiers={[frame({ height: 190 })]}
              showGrid
              type="bar"
            />
          ) : (
            <ContentUnavailableView
              description={t('studio.analytics.noTrend.description')}
              systemImage="chart.bar"
              title={t('studio.analytics.noTrend.title')}
            />
          )}
        </Section>

        <Section title={t('studio.analytics.providers')}>
          {data.storageUsage.providers.length > 0 ? (
            data.storageUsage.providers.map(provider => (
              <VStack key={provider.provider} alignment="leading" spacing={6}>
                <HStack>
                  <Text modifiers={[font({ textStyle: 'subheadline', weight: 'medium' })]}>{provider.provider}</Text>
                  <Spacer />
                  <Text
                    modifiers={[
                      foregroundStyle({ style: 'secondary', type: 'hierarchical' }),
                      font({ textStyle: 'caption' }),
                    ]}
                  >
                    {formatBytes(provider.bytes, locale)}
                    {' '}
                    ·
                    {formatCount(provider.photoCount, locale)}
                  </Text>
                </HStack>
                <ProgressView value={provider.bytes / maxProviderBytes} />
              </VStack>
            ))
          ) : (
            <Text>{t('studio.analytics.noData')}</Text>
          )}
        </Section>

        <Section title={t('studio.analytics.tags')}>
          {data.popularTags.length > 0 ? (
            data.popularTags.slice(0, 10).map(item => (
              <LabeledContent key={item.tag} label={item.tag}>
                <Text>{formatCount(item.count, locale)}</Text>
              </LabeledContent>
            ))
          ) : (
            <Text>{t('studio.analytics.noData')}</Text>
          )}
        </Section>

        <Section title={t('studio.analytics.devices')}>
          {data.topDevices.length > 0 ? (
            data.topDevices.slice(0, 10).map(item => (
              <LabeledContent key={item.device} label={item.device}>
                <Text>{formatCount(item.count, locale)}</Text>
              </LabeledContent>
            ))
          ) : (
            <Text>{t('studio.analytics.noData')}</Text>
          )}
        </Section>
      </Form>
    </StudioHost>
  )
}

function AnalyticsMetric({ label, value }: { label: string, value: string }) {
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
