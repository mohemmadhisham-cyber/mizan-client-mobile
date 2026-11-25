import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { TrendChart } from '@/components/charts/trend-chart';
import { EditDashboardModal } from '@/components/dashboard/edit-dashboard-modal';
import { GracePeriodBanner } from '@/components/dashboard/grace-period-banner';
import { Cta } from '@/components/horizon/cta';
import type { HeadlineLine } from '@/components/horizon/headline';
import { BRIDGE_WIDTH, FieldMark, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Ledger, type LedgerCell, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useAuth } from '@/lib/auth-context';
import { useDashboardPrefs } from '@/lib/dashboard-prefs';
import { daysUntil, formatMoneyMinor } from '@/lib/format';
import { clearDashboardCache, clientDataService } from '@/services/client-data';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

/** Height of the field on Home: room for a three-line sentence. */
const HOME_FIELD = 252;
const AVATAR = 36;

function initialsFrom(email?: string, fullName?: string): string {
  const source = fullName?.trim() || email?.split('@')[0] || '';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/** When VAT is due, in words. Nothing when there is no VAT to pay or no usable date. */
function vatNote(vatDue: number, dueDate: string, t: TFunction): string | undefined {
  if (vatDue === 0 || !dueDate) return undefined;
  const days = daysUntil(dueDate);
  if (Number.isNaN(days)) return undefined;
  if (days < 0) return t('horizonHome.vatOverdue', { days: -days });
  if (days === 0) return t('horizonHome.vatToday');
  return t('home.dueIn', { days });
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const { user, firmId } = useAuth();
  const companyKey = firmId ?? 'none';
  const { visible, toggle } = useDashboardPrefs();
  const [editingDashboard, setEditingDashboard] = useState(false);

  const kpis = useQuery({ queryKey: ['kpis', companyKey], queryFn: clientDataService.getKpis });
  const rev = useQuery({ queryKey: ['rev', companyKey], queryFn: clientDataService.getRevenueSeries });
  const exp = useQuery({ queryKey: ['exp', companyKey], queryFn: clientDataService.getExpenseSeries });
  const ins = useQuery({ queryKey: ['ins', companyKey], queryFn: clientDataService.getInsights });
  const acts = useQuery({ queryKey: ['acts', companyKey], queryFn: clientDataService.getActions });
  const refetchAll = () =>
    Promise.all([kpis.refetch(), rev.refetch(), exp.refetch(), ins.refetch(), acts.refetch()]);
  const { refreshing, onRefresh } = usePullToRefresh(() => {
    // The summary is cached for 30 s; a pull must reach the server.
    clearDashboardCache();
    return refetchAll();
  });

  const k = kpis.data;
  const cur = k?.currency ?? 'AED';
  const waiting = acts.data ?? [];

  // The sentence the screen opens with. Amounts are the server's, rounded to whole units for display.
  const failed = kpis.isError && !k;
  const lines: HeadlineLine[] = failed
    ? [{ text: t('horizonHome.errorA') }, { text: t('horizonHome.errorB'), soft: true }]
    : !k
      ? [{ text: t('horizonHome.loadingA'), soft: true }, { text: t('horizonHome.loadingB'), soft: true }]
      : [
          { text: t(k.profit < 0 ? 'horizonHome.lost' : 'horizonHome.made'), soft: true },
          { text: formatMoneyMinor(Math.abs(k.profit), cur), figure: true },
          { text: t('horizonHome.thisMonth'), soft: true },
        ];

  const cells: LedgerCell[] = [
    { key: 'in', label: t('home.moneyIn'), value: k ? formatMoneyMinor(k.moneyIn, cur) : null },
    { key: 'out', label: t('home.moneyOut'), value: k ? formatMoneyMinor(k.moneyOut, cur) : null },
    { key: 'cash', label: t('horizonHome.cash'), value: k ? formatMoneyMinor(k.cash, cur) : null },
    {
      key: 'vat',
      label: t('home.vatDue'),
      value: k ? formatMoneyMinor(k.vatDue, cur) : null,
      note: k ? vatNote(k.vatDue, k.vatDueDate, t) : undefined,
    },
  ];

  const top = (
    <>
      <FieldMark />
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.notifications')}
        onPress={() => router.push('/notifications')}
        hitSlop={11}
        style={({ pressed }) => ({ marginEnd: 14, opacity: pressed ? 0.6 : 1 })}>
        <Ionicons name="notifications-outline" size={22} color={colors.onField} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.profileAndSettings')}
        onPress={() => router.push('/more')}
        hitSlop={8}
        style={({ pressed }) => ({
          width: AVATAR,
          height: AVATAR,
          borderRadius: AVATAR / 2,
          borderWidth: 1,
          borderColor: colors.fieldMuted,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}>
        <Text variant="footnote" weight="semibold" style={{ color: colors.onField }}>
          {initialsFrom(user?.email, (user?.user_metadata as { full_name?: string })?.full_name)}
        </Text>
      </Pressable>
    </>
  );

  return (
    <>
      <HorizonScreen
        field={HOME_FIELD}
        lines={lines}
        top={top}
        // The bridge marks the one place to act: it shows only when something is waiting.
        bridge={waiting.length > 0 ? { start: HORIZON_GUTTER, width: BRIDGE_WIDTH } : null}
        safeBottom={false}
        refreshing={refreshing}
        onRefresh={onRefresh}>
        {failed ? (
          <View style={{ padding: HORIZON_GUTTER, gap: 14 }}>
            <Text variant="body" color="mutedForeground">
              {t('home.loadErrorBody')}
            </Text>
            <Cta title={t('common.retry')} onPress={() => void refetchAll()} />
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: HORIZON_GUTTER }}>
              <GracePeriodBanner />
            </View>

            {visible.thisMonth ? <Ledger cells={cells} /> : null}

            {visible.criticalTasks ? (
              <>
                <SectionLabel>{t('horizonHome.needsYou')}</SectionLabel>
                {acts.isError && !acts.data ? (
                  <RuledRow title={t('horizonHome.waitingError')} action={t('common.retry')} onPress={() => void acts.refetch()} />
                ) : waiting.length === 0 ? (
                  <RuledRow title={acts.data ? t('home.allCaughtUp') : t('common.loading')} />
                ) : (
                  waiting.map((item) => (
                    <RuledRow
                      key={item.id}
                      title={item.label}
                      meta={t('home.itemsPending', { count: item.count })}
                      action={t('horizonHome.open')}
                      onPress={() => router.push(item.href as Href)}
                    />
                  ))
                )}
              </>
            ) : null}

            <SectionLabel>{t('home.quickActions')}</SectionLabel>
            <RuledRow title={t('home.photographReceipt')} onPress={() => router.push('/capture')} />
            <RuledRow title={t('home.askAi')} onPress={() => router.push('/ai-advisor')} />

            {visible.whatChanged && ins.data && ins.data.length > 0 ? (
              <>
                <SectionLabel>{t('home.whatChanged')}</SectionLabel>
                {ins.data.map((card) => (
                  <RuledRow key={card.id} title={card.title} meta={card.body} alert={card.severity === 'alert'} />
                ))}
              </>
            ) : null}

            {visible.cashFlow && rev.data ? (
              <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 22 }}>
                <TrendChart question={t('home.cashFlow')} data={rev.data} type="line" headingVariant="title" currency={cur} />
              </View>
            ) : null}
            {visible.expenseTrend && exp.data ? (
              <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 16 }}>
                <TrendChart question={t('home.expenseTrend')} data={exp.data} type="bar" currency={cur} />
              </View>
            ) : null}

            <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 12 }}>
              <Cta kind="quiet" title={t('dashboard.edit')} onPress={() => setEditingDashboard(true)} />
            </View>
          </>
        )}
      </HorizonScreen>

      <EditDashboardModal
        visible={editingDashboard}
        sectionVisibility={visible}
        onToggle={toggle}
        onDone={() => setEditingDashboard(false)}
      />
    </>
  );
}
