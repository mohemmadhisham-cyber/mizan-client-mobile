import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';

import { TrendChart } from '@/components/charts/trend-chart';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Card, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { daysUntil, formatMoneyMinor, pctChange } from '@/lib/format';
import { clientDataService } from '@/services/client-data';
import type { InsightCard, Severity } from '@/services/types';
import { radius, spacing, useTheme } from '@/theme';

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
  const { user, firmId } = useAuth();
  const companyKey = firmId ?? 'none';
  const name = firstNameFrom(user?.email, (user?.user_metadata as { full_name?: string })?.full_name);

  const kpis = useQuery({ queryKey: ['kpis', companyKey], queryFn: clientDataService.getKpis });
  const rev = useQuery({ queryKey: ['rev', companyKey], queryFn: clientDataService.getRevenueSeries });
  const exp = useQuery({ queryKey: ['exp', companyKey], queryFn: clientDataService.getExpenseSeries });
  const ins = useQuery({ queryKey: ['ins', companyKey], queryFn: clientDataService.getInsights });
  const acts = useQuery({ queryKey: ['acts', companyKey], queryFn: clientDataService.getActions });

  if (kpis.isError) {
    return (
      <Screen>
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
  const runway = k && k.moneyOut > 0 ? Math.round(k.cash / k.moneyOut) : null;
  const deltaSub = (d: number | null) => (d === null ? undefined : `${d >= 0 ? '+' : ''}${d}% ${t('home.vsLastMonth')}`);

  return (
    <Screen scroll>
      <View style={{ gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <Text variant="h1">{t('home.greeting', { name })}</Text>
        <Text variant="callout" color="mutedForeground">
          {t('home.subtitle')}
        </Text>
      </View>

      {k ? (
        <Card elevated style={{ marginBottom: spacing.lg }}>
          <View style={styles.snapshot}>
            <View style={{ gap: 2, flexShrink: 1 }}>
              <Text variant="footnote" color="mutedForeground">
                {t('home.profit')}
              </Text>
              <Text variant="display" tabular adjustsFontSizeToFit numberOfLines={1}>
                {formatMoneyMinor(k.profit, cur)}
              </Text>
            </View>
            <View style={{ alignItems: I18nManager.isRTL ? 'flex-start' : 'flex-end', gap: 2 }}>
              <Text variant="footnote" color="mutedForeground">
                {t('home.cashPosition')}
              </Text>
              <Text variant="title" tabular>
                {formatMoneyMinor(k.cash, cur)}
              </Text>
              {runway != null ? (
                <Text variant="caption" color="mutedForeground">
                  {t('home.runway', { months: runway })}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>
      ) : (
        <Skeleton height={112} radius={radius.lg} style={{ marginBottom: spacing.lg }} />
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {k ? (
          <>
            <KpiCard label={t('home.cash')} value={formatMoneyMinor(k.cash, cur)} icon="wallet-outline" accent="good" />
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
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        )}
      </View>

      <SectionHeader title={t('home.actionStrip')} />
      {!acts.data ? (
        <ListSkeleton />
      ) : acts.data.length === 0 ? (
        <Card>
          <Text variant="callout" color="mutedForeground">
            {t('home.allCaughtUp')}
          </Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {acts.data.map((a) => (
            <ActionRow key={a.id} label={a.label} count={a.count} href={a.href} />
          ))}
        </View>
      )}

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

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {rev.data ? (
          <TrendChart
            question={t('home.revenueTrend')}
            takeaway={
              revDelta !== null
                ? `${revDelta >= 0 ? '+' : ''}${revDelta}% ${t('home.vsLastMonth')}`
                : undefined
            }
            data={rev.data}
            type="bar"
          />
        ) : (
          <Skeleton height={200} radius={radius.lg} />
        )}
        {exp.data ? (
          <TrendChart question={t('home.expenseTrend')} data={exp.data} type="line" />
        ) : (
          <Skeleton height={200} radius={radius.lg} />
        )}
      </View>
    </Screen>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text variant="subhead" weight="semibold" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
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
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} height={56} radius={radius.lg} />
      ))}
    </View>
  );
}

function ActionRow({ label, count, href }: { label: string; count: number; href: string }) {
  const theme = useTheme();
  const router = useRouter();
  const chevron: keyof typeof Ionicons.glyphMap = I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href as Href)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
        <View style={[styles.countBadge, { backgroundColor: theme.colors.warning }]}>
          <Text variant="caption" weight="bold" style={{ color: theme.colors.warningForeground }}>
            {count}
          </Text>
        </View>
        <Text variant="callout" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
          {label}
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
  snapshot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.sm,
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
