import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import type { HeadlineLine } from '@/components/horizon/headline';
import { BRIDGE_WIDTH, FieldMark, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { requestOneLine, requestSentLine, requestTitle } from '@/components/requests/request-text';
import { StepUpModal } from '@/components/tasks/step-up-modal';
import { Text } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { listPendingRequests, REQUESTS_QUERY_KEY } from '@/services/accountant-requests';
import { tasksService } from '@/services/tasks';
import type { ActionCenterTask } from '@/services/types';
import { useTheme } from '@/theme';

/** Height of the field: a one-line sentence and up to two quiet lines under it. */
const REQUESTS_FIELD = 200;

/** The lines under a row's title: only the parts that exist, one per line. */
function metaLines(...parts: (string | undefined)[]): string | undefined {
  const present = parts.filter((part): part is string => Boolean(part));
  return present.length > 0 ? present.join('\n') : undefined;
}

export default function TasksScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [stepUpTask, setStepUpTask] = useState<ActionCenterTask | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const urgent = useQuery({ queryKey: ['tasks-urgent'], queryFn: tasksService.getUrgent });
  const pending = useQuery({ queryKey: ['tasks-pending'], queryFn: tasksService.getPending });
  const completed = useQuery({ queryKey: ['tasks-completed-summary'], queryFn: tasksService.getCompletedSummary });
  const requests = useQuery({ queryKey: REQUESTS_QUERY_KEY, queryFn: listPendingRequests });
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([requests.refetch(), urgent.refetch(), pending.refetch(), completed.refetch()]),
  );

  const urgentTasks = (urgent.data ?? []).filter((task) => !approvedIds.has(task.id));
  const fromAccountant = requests.data?.requests ?? [];
  const unreadable = requests.data?.unreadable ?? 0;
  // A request the app cannot show still waits for the client, so it counts.
  const waiting = fromAccountant.length + unreadable + urgentTasks.length;
  const counted = urgent.data !== undefined && requests.data !== undefined;
  // Never say "nothing is waiting" when one of the two lists could not be read.
  const checkFailed = (requests.isError && !requests.data) || (urgent.isError && !urgent.data);

  function handleAction(task: ActionCenterTask) {
    if (task.actionKind === 'upload-receipt') {
      router.push('/capture');
    } else if (task.actionKind === 'approve') {
      setStepUpTask(task);
    } else {
      Alert.alert(t('common.comingSoon'), t('common.notAvailableYet', { name: task.actionLabel }));
    }
  }

  function handleVerified() {
    const task = stepUpTask;
    setStepUpTask(null);
    if (!task) return;
    setApprovedIds((prev) => new Set(prev).add(task.id));
    // Persist the real decision (RLS-scoped update on the client's own
    // approval_request), then refresh the lists + completed summary.
    tasksService
      .decideApproval(task.id, 'approved')
      .then(() => {
        void qc.invalidateQueries({ queryKey: ['tasks-urgent'] });
        void qc.invalidateQueries({ queryKey: ['tasks-completed-summary'] });
      })
      .catch(() => {
        // Roll the optimistic hide back so the item reappears on failure.
        setApprovedIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
        Alert.alert(t('tasks.couldNotApproveTitle'), t('tasks.couldNotApproveBody'));
      });
  }

  // The sentence the screen opens with: how many things are waiting for the client.
  const lines: HeadlineLine[] = checkFailed
    ? [{ text: t('horizonRequests.checkFailed') }]
    : !counted
      ? [{ text: t('common.loading'), soft: true }]
      : waiting === 0
        ? [{ text: t('horizonRequests.noneWaiting') }]
        : [{ text: t('horizonRequests.waiting', { count: waiting }) }];

  return (
    <>
      <HorizonScreen
        field={REQUESTS_FIELD}
        small
        lines={lines}
        sub={t('tasks.subtitle')}
        top={<FieldMark />}
        // The bridge marks the place to act: it shows only when something is waiting.
        bridge={waiting > 0 ? { start: HORIZON_GUTTER, width: BRIDGE_WIDTH } : null}
        safeBottom={false}
        refreshing={refreshing}
        onRefresh={onRefresh}>
        {requests.isError && !requests.data ? (
          <View accessibilityLiveRegion="polite">
            <RuledRow
              title={t('requests.loadFailed')}
              action={t('common.retry')}
              onPress={() => void requests.refetch()}
            />
          </View>
        ) : fromAccountant.length > 0 || unreadable > 0 ? (
          <>
            <SectionLabel>{t('requests.sectionTitle')}</SectionLabel>
            {fromAccountant.map((request) => (
              <RuledRow
                key={request.id}
                title={requestTitle(request)}
                meta={metaLines(requestOneLine(request, t), requestSentLine(request, t))}
                action={t('horizonRequests.review')}
                onPress={() => router.push(`/approvals/${request.id}` as Href)}
              />
            ))}
            {unreadable > 0 ? (
              <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 12 }}>
                <Text variant="footnote" style={{ color: theme.colors.warningSoftForeground }}>
                  {t('requests.unreadable', { count: unreadable })}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        <SectionLabel>{t('tasks.requiresAttention')}</SectionLabel>
        {urgent.isError && !urgent.data ? (
          <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void urgent.refetch()} />
        ) : !urgent.data ? (
          <RuledRow title={t('common.loading')} />
        ) : urgentTasks.length === 0 ? (
          <RuledRow title={t('home.allCaughtUp')} />
        ) : (
          urgentTasks.map((task) => (
            <RuledRow
              key={task.id}
              title={task.title}
              meta={metaLines(task.badgeLabel, task.description, task.metaLabel)}
              alert
              action={task.actionLabel}
              onPress={() => handleAction(task)}
            />
          ))
        )}

        {!pending.data ? (
          <>
            <SectionLabel>{t('tasks.pendingReview')}</SectionLabel>
            {pending.isError ? (
              <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void pending.refetch()} />
            ) : (
              <RuledRow title={t('common.loading')} />
            )}
          </>
        ) : pending.data.length > 0 ? (
          <>
            <SectionLabel>{t('tasks.pendingReview')}</SectionLabel>
            {pending.data.map((task) => (
              <RuledRow
                key={task.id}
                title={task.title}
                meta={metaLines(task.description, task.badgeLabel)}
                action={task.actionLabel}
                onPress={() => handleAction(task)}
              />
            ))}
          </>
        ) : null}

        <SectionLabel>{t('tasks.recentlyCompleted')}</SectionLabel>
        <RuledRow title={completed.data?.label ?? (completed.isError ? t('common.listLoadFailed') : t('common.loading'))} />
      </HorizonScreen>

      <StepUpModal
        visible={Boolean(stepUpTask)}
        scope={stepUpTask ? `approval:${stepUpTask.id}` : ''}
        title={stepUpTask?.actionLabel ?? ''}
        onCancel={() => setStepUpTask(null)}
        onVerified={handleVerified}
      />
    </>
  );
}
