import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';

import { TrendChart } from '@/components/charts/trend-chart';
import { EditDashboardModal } from '@/components/dashboard/edit-dashboard-modal';
import { GracePeriodBanner } from '@/components/dashboard/grace-period-banner';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { QuickActionButton } from '@/components/dashboard/quick-action-button';
import { AppHeader } from '@/components/navigation/app-header';
import { Card, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useDashboardPrefs } from '@/lib/dashboard-prefs';
import { daysUntil, formatMoneyMinor, pctChange } from '@/lib/format';
import { clientDataService } from '@/services/client-data';
import type { InsightCard, Severity } from '@/services/types';
import { radius, softTone, spacing, useTheme, type ColorTokens, type SoftToneColors } from '@/theme';

const SEVERITY_ICON: Record<Severity, keyof typeof Ionicons.glyphMap> = {
  good: 'sparkles',
  warn: 'alert-circle',
  alert: 'warning',
  info: 'information-circle',
};

function firstNameFrom(email?: string, fullName?: string): string {
  if (fullName) return fullName.split(' ')[0];
  if (email) return email.split('@')[0];
  return '';
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { user, firmId } = useAuth();
  const companyKey = firmId ?? 'none';
  const name = firstNameFrom(user?.email, (user?.user_metadata as { full_name?: string })?.full_name);
  const { visible, toggle } = useDashboardPrefs();
  const [editingDashboard, setEditingDashboard] = useState(false);

  const kpis = useQuery({ queryKey: ['kpis', companyKey], queryFn: clientDataService.getKpis });
  const rev = useQuery({ queryKey: ['rev', companyKey], queryFn: clientDataService.getRevenueSeries });
  const exp = useQuery({ queryKey: ['exp', companyKey], queryFn: clientDataService.getExpenseSeries });
  const ins = useQuery({ queryKey: ['ins', companyKey], queryFn: clientDataService.getInsights });
  const acts = useQuery({ queryKey: ['acts', companyKey], queryFn: clientDataService.getActions });

  if (kpis.isError) {
    return (
      <Screen header={<AppHeader />}>
        <EmptyState
          icon="warning-outline"
          title={t('home.loadError')}
          message={t('home.loadErrorBody')}
          actionLabel={t('common.retry')}
          onAction={() => {
            void kpis.refetch();
            void rev.refetch();
            void exp.refetch();
            void ins.refetch();
            void acts.refetch();
          }}
        />
      </Screen>
    );
  }

  const k = kpis.data;
  const cur = k?.currency ?? 'AED';
  const days = k ? daysUntil(k.vatDueDate) : 0;
  const revDelta =
    rev.data && rev.data.length >= 2
      ? pctChange(rev.data[rev.data.length - 1].value, rev.data[rev.data.length - 2].value)
      : null;
  const expDelta =
    exp.data && exp.data.length >= 2
      ? pctChange(exp.data[exp.data.length - 1].value, exp.data[exp.data.length - 2].value)
      : null;
  const deltaSub = (d: number | null) => (d === null ? undefined : `${d >= 0 ? '+' : ''}${d}% ${t('home.vsLastMonth')}`);

  return (
    <>
      <Screen scroll header={<AppHeader />}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <View style={{ gap: spacing.xs, flex: 1 }}>
          <Text variant="h1">{t('home.greeting', { name })}</Text>
          <Text variant="callout" color="mutedForeground">
            {t('home.subtitle')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit dashboard"
          onPress={() => setEditingDashboard(true)}
          hitSlop={8}
          style={{ padding: spacing.xs }}>
          <Ionicons name="options-outline" size={22} color={theme.colors.mutedForeground} />
        </Pressable>
      </View>

      <GracePeriodBanner />

      {/* Hero — Figma "Available to Spend" */}
      {k ? (
        <Card elevated style={{ alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xl }}>
          <Text variant="caption" color="mutedForeground" weight="semibold" style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {t('home.availableToSpend')}
          </Text>
          <Text variant="display" color="primary" tabular adjustsFontSizeToFit numberOfLines={1}>
            {formatMoneyMinor(k.cash, cur)}
          </Text>
          {revDelta !== null ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: trendTone(theme.colors, revDelta).bg,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                marginTop: spacing.xs,
              }}>
              <Ionicons
                name={revDelta >= 0 ? 'trending-up' : 'trending-down'}
                size={13}
                color={trendTone(theme.colors, revDelta).fg}
              />
              <Text variant="caption" weight="semibold" style={{ color: trendTone(theme.colors, revDelta).fg }}>
                {deltaSub(revDelta)}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : (
        <Skeleton height={132} radius={radius.lg} style={{ marginBottom: spacing.xl }} />
      )}

      {/* Quick Actions — Figma circular shortcut row */}
      <SectionHeader title={t('home.quickActions')} />
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }}>
        <QuickActionButton
          label={t('home.photographReceipt')}
          icon="camera"
          tone="brand"
          onPress={() => router.push('/capture')}
        />
        <QuickActionButton label={t('home.askAi')} icon="sparkles" tone="accent" onPress={() => router.push('/ai-advisor')} />
        <QuickActionButton label={t('home.payBill')} icon="card-outline" tone="neutral" onPress={() => router.push('/more')} />
        <QuickActionButton
          label={t('home.transfer')}
          icon="swap-horizontal-outline"
          tone="neutral"
          onPress={() => router.push('/more')}
        />
      </View>

      {/* Cash Flow — Figma card hosting the real trend chart */}
      {visible.cashFlow ? (
        <View style={{ marginBottom: spacing.xl }}>
          {rev.data ? (
            <TrendChart question={t('home.cashFlow')} data={rev.data} type="line" headingVariant="title" currency={cur} />
          ) : (
            <Skeleton height={180} radius={radius.lg} />
          )}
        </View>
      ) : null}

      {/* Critical Tasks — Figma-styled cards */}
      {visible.criticalTasks ? (
        <>
          <SectionHeader title={t('home.criticalTasks')} />
          {!acts.data ? (
            <ListSkeleton />
          ) : acts.data.length === 0 ? (
            <Card>
              <Text variant="callout" color="mutedForeground">
                {t('home.allCaughtUp')}
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
              {acts.data.map((a, i) => (
                <TaskRow key={a.id} label={a.label} count={a.count} href={a.href} urgent={i === 0} />
              ))}
            </View>
          )}
        </>
      ) : null}

      {visible.thisMonth ? (
        <>
          <SectionHeader title={t('home.thisMonth')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl }}>
            {k ? (
              <>
                <KpiCard
                  label={t('home.moneyIn')}
                  value={formatMoneyMinor(k.moneyIn, cur)}
                  icon="arrow-down-circle-outline"
                  accent="good"
                  sub={deltaSub(revDelta)}
                />
                <KpiCard
                  label={t('home.moneyOut')}
                  value={formatMoneyMinor(k.moneyOut, cur)}
                  icon="arrow-up-circle-outline"
                  sub={deltaSub(expDelta)}
                />
                <KpiCard
                  label={t('home.vatDue')}
                  value={formatMoneyMinor(k.vatDue, cur)}
                  icon="document-text-outline"
                  accent={days <= 7 ? 'alert' : 'warn'}
                  sub={t('home.dueIn', { days })}
                />
              </>
            ) : (
              Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
            )}
          </View>
        </>
      ) : null}

      {visible.whatChanged ? (
        <>
          <SectionHeader title={t('home.whatChanged')} />
          {!ins.data ? (
            <ListSkeleton />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {ins.data.map((card) => (
                <InsightRow key={card.id} card={card} />
              ))}
            </View>
          )}
        </>
      ) : null}

      {visible.expenseTrend ? (
        <View style={{ marginTop: spacing.lg }}>
          {exp.data ? (
            <TrendChart question={t('home.expenseTrend')} data={exp.data} type="bar" currency={cur} />
          ) : (
            <Skeleton height={200} radius={radius.lg} />
          )}
        </View>
      ) : null}
      </Screen>

      <EditDashboardModal
        visible={editingDashboard}
        sectionVisibility={visible}
        onToggle={toggle}
        onDone={() => setEditingDashboard(false)}
      />
    </>
  );
}

// Small helper so the hero trend badge reads success (green) or danger (red).
function trendTone(colors: ColorTokens, delta: number): SoftToneColors {
  return softTone(colors, delta >= 0 ? 'success' : 'danger');
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text variant="title" style={{ marginBottom: spacing.sm }}>
      {title}
    </Text>
  );
}

function KpiSkeleton() {
  return (
    <Card elevated style={{ flexBasis: '47%', flexGrow: 1, gap: spacing.sm }}>
      <Skeleton width="60%" height={12} />
      <Skeleton width="80%" height={22} />
    </Card>
  );
}

function ListSkeleton() {
  return (
    <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} height={72} radius={radius.md} />
      ))}
    </View>
  );
}

function TaskRow({ label, count, href, urgent }: { label: string; count: number; href: string; urgent: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const chevron: keyof typeof Ionicons.glyphMap = I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';
  const badgeBg = urgent ? theme.colors.dangerSoft : theme.colors.secondary;
  const badgeFg = urgent ? theme.colors.dangerSoftForeground : theme.colors.mutedForeground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href as Href)}
      style={({ pressed }) => [
        styles.taskRow,
        { backgroundColor: theme.colors.card, opacity: pressed ? 0.75 : 1 },
        theme.elevation.sm,
      ]}>
      <View style={[styles.taskBadge, { backgroundColor: badgeBg }]}>
        <Ionicons name={urgent ? 'alert-circle' : 'ellipse'} size={urgent ? 20 : 12} color={badgeFg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="semibold" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="footnote" color="mutedForeground" numberOfLines={1}>
          {t('home.itemsPending', { count })}
        </Text>
      </View>
      <Ionicons name={chevron} size={18} color={theme.colors.mutedForeground} />
    </Pressable>
  );
}

function InsightRow({ card }: { card: InsightCard }) {
  const theme = useTheme();
  const tone =
    card.severity === 'good'
      ? theme.colors.success
      : card.severity === 'warn'
        ? theme.colors.warning
        : card.severity === 'alert'
          ? theme.colors.danger
          : theme.colors.mutedForeground;
  return (
    <Card style={{ flexDirection: 'row', gap: spacing.md }}>
      <View style={[styles.insightIcon, { backgroundColor: theme.colors.accent }]}>
        <Ionicons name={SEVERITY_ICON[card.severity]} size={18} color={tone} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="semibold">
          {card.title}
        </Text>
        <Text variant="footnote" color="mutedForeground">
          {card.body}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.base,
    gap: spacing.md,
  },
  taskBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
