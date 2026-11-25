import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import type { HeadlineLine } from '@/components/horizon/headline';
import { BRIDGE_WIDTH, FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Figure, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { ProgressLine } from '@/components/plan/plan-row';
import {
  DATE_ONLY,
  MONTH_ONLY,
  needsAttention,
  progressLabel,
  progressShare,
  standingLine,
  targetNote,
  targetTitle,
  targetValue,
} from '@/components/plan/plan-text';
import { Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { targetsQuery } from '@/services/month-plan';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

/** Height of the field: the target's name, the figure, the goal, and one quiet line. */
const TARGET_FIELD = 232;

/** A label and a figure on one line of the ground. */
function FigureRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${value}`}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        marginHorizontal: HORIZON_GUTTER,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}>
      <Text variant="callout" color="mutedForeground">
        {label}
      </Text>
      <Figure size={14}>{value}</Figure>
    </View>
  );
}

/**
 * One agreed target: how far it has come, the plan against what happened month
 * by month, the steps agreed with the accountant, and the accountant's note.
 * Every figure and the on-track judgement come from the server.
 */
export default function PlanTargetScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { clientId } = useAuth();
  const plan = useQuery(targetsQuery(clientId));
  const target = plan.data?.available ? plan.data.targets.find((item) => item.id === id) : undefined;
  // Could not reach the server: say so, instead of "not found".
  const failed = plan.isError && !target;
  const gone = !plan.isLoading && !failed && !target;

  const lines: HeadlineLine[] = target
    ? [
        { text: targetTitle(target), soft: true },
        { text: targetValue(target, target.current, t), figure: true },
        { text: t('horizonPlan.ofGoal', { goal: targetValue(target, target.goal, t) }), soft: true },
      ]
    : failed
      ? [{ text: t('common.listLoadFailed') }]
      : gone
        ? [{ text: t('horizonPlan.goneTitle') }]
        : [{ text: t('common.loading'), soft: true }];

  const alert = target ? needsAttention(target.status) : false;
  const sub = target ? standingLine(target, t) : undefined;
  const note = target ? targetNote(target) : null;

  return (
    <HorizonScreen
      field={TARGET_FIELD}
      small
      animateKey={target ? 'target' : failed ? 'failed' : gone ? 'gone' : 'loading'}
      lines={lines}
      sub={sub}
      top={<FieldBack colors={colors} />}
      // The bridge marks a target that needs the person: one at risk.
      bridge={alert ? { start: HORIZON_GUTTER, width: BRIDGE_WIDTH } : null}>
      {gone || failed ? (
        <View style={{ padding: HORIZON_GUTTER, gap: 14 }}>
          <Text variant="body" color="mutedForeground">
            {t(failed ? 'home.loadErrorBody' : 'horizonPlan.goneBody')}
          </Text>
          <Cta title={t('common.retry')} busy={plan.isFetching} onPress={() => void plan.refetch()} />
        </View>
      ) : target ? (
        <>
          <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 26, paddingBottom: 12, gap: 8 }}>
            <ProgressLine share={progressShare(target)} alert={alert} height={6} />
            <Text variant="footnote" color="mutedForeground">
              {t('horizonPlan.reached', { percent: progressLabel(target) })}
            </Text>
          </View>

          <FigureRow label={t('horizonPlan.goal')} value={targetValue(target, target.goal, t)} />
          <FigureRow label={t('horizonPlan.soFar')} value={targetValue(target, target.current, t)} />
          <FigureRow label={t('horizonPlan.startedAt')} value={targetValue(target, target.start, t)} />
          <FigureRow label={t('horizonPlan.deadline')} value={formatDate(target.deadline, DATE_ONLY)} />
          <FigureRow label={t('horizonPlan.agreedOn')} value={formatDate(target.setOn, DATE_ONLY)} />

          {note ? (
            <>
              <SectionLabel>{t('horizonPlan.note')}</SectionLabel>
              <View style={{ paddingHorizontal: HORIZON_GUTTER }}>
                <Text variant="body" style={{ writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' }}>
                  {note}
                </Text>
              </View>
            </>
          ) : null}

          {target.steps.length > 0 ? (
            <>
              <SectionLabel>{t('horizonPlan.steps')}</SectionLabel>
              {target.steps.map((step, index) => (
                <RuledRow
                  key={`${index}-${step.id}`}
                  title={(I18nManager.isRTL ? step.titleAr : null) ?? step.title}
                  meta={t(step.done ? 'horizonPlan.stepDone' : 'horizonPlan.stepOpen')}
                  plain
                />
              ))}
            </>
          ) : null}

          {target.months.length > 0 ? (
            <>
              <SectionLabel>{t('horizonPlan.monthByMonth')}</SectionLabel>
              {target.months.map((month, index) => (
                <RuledRow
                  key={`${index}-${month.month}`}
                  title={formatDate(month.month, MONTH_ONLY)}
                  meta={t('horizonPlan.planWas', { plan: targetValue(target, month.plan, t) })}
                  end={<Figure size={14}>{targetValue(target, month.actual, t)}</Figure>}
                  plain
                />
              ))}
            </>
          ) : null}

          <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 22 }}>
            <Cta kind="outline" title={t('horizonPlan.ask')} onPress={() => router.push('/messages')} />
          </View>
        </>
      ) : null}
    </HorizonScreen>
  );
}
