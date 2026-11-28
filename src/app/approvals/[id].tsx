import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/navigation/detail-header';
import { DeclineSheet } from '@/components/requests/decline-sheet';
import { RequestDetails } from '@/components/requests/request-details';
import { requestConsequence, requestSentLine, requestTitle } from '@/components/requests/request-text';
import { StepUpModal } from '@/components/tasks/step-up-modal';
import { Button, EmptyState, Skeleton, Text } from '@/components/ui';
import {
  decideRequest,
  type DecideOutcome,
  isRequestGone,
  listPendingRequests,
  requestErrorKey,
  REQUESTS_QUERY_KEY,
} from '@/services/accountant-requests';
import { radius, spacing, useTheme } from '@/theme';

type Decision = 'approve' | 'decline';
type Outcome = 'applied' | 'declined';

function successHaptic() {
  if (process.env.EXPO_OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

/**
 * One request from the accountant: what is being asked, then Approve or
 * Decline. Approving needs a one-time code (the server asks for it); the server
 * applies the change. Nothing here computes or alters a figure.
 */
export default function AccountantRequestScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Always read the list again on opening: the figures on this screen are what
  // the owner approves, so they must not come from a list fetched a minute ago,
  // and a request that has just arrived must not look "gone".
  const pending = useQuery({
    queryKey: REQUESTS_QUERY_KEY,
    queryFn: listPendingRequests,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const request = pending.data?.requests.find((r) => r.id === id);
  // Set at once on tap, unlike state: two taps in one frame send one answer.
  const inFlight = useRef(false);

  const [busy, setBusy] = useState<Decision | null>(null);
  const [stepUpScope, setStepUpScope] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function decide(decision: Decision, options: { reason?: string; afterCode?: boolean } = {}) {
    // The id comes from the request the list returned, never from the route.
    const actionId = request?.id;
    if (!actionId || inFlight.current) return;
    inFlight.current = true;
    setBusy(decision);
    setErrorKey(null);
    let result: DecideOutcome;
    try {
      result = await decideRequest(actionId, decision, options.reason);
    } catch {
      result = { status: 'error', code: 'unknown' };
    } finally {
      inFlight.current = false;
      setBusy(null);
    }

    if (result.status === 'step_up_required') {
      // A second ask straight after a verified code means the code did not
      // count: say so instead of asking for codes in a loop.
      if (options.afterCode) setErrorKey('requests.errCodeNotAccepted');
      else setStepUpScope(result.scope);
      return;
    }
    if (result.status === 'error') {
      setDeclining(false);
      setErrorKey(requestErrorKey(result.code));
      if (isRequestGone(result.code)) void queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY });
      return;
    }
    setDeclining(false);
    setOutcome(result.status);
    successHaptic();
    void queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY });
  }

  const shell = (title: string, body: ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title={title} />
      {body}
    </View>
  );

  // The answer is in: show it even though the request has now left the list.
  if (outcome) {
    return shell(
      t(outcome === 'applied' ? 'requests.appliedTitle' : 'requests.declinedTitle'),
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.gutter }}>
        <Ionicons
          name={outcome === 'applied' ? 'checkmark-circle' : 'close-circle-outline'}
          size={56}
          color={outcome === 'applied' ? theme.colors.success : theme.colors.mutedForeground}
        />
        <Text variant="title" center>
          {t(outcome === 'applied' ? 'requests.appliedTitle' : 'requests.declinedTitle')}
        </Text>
        <Text variant="body" color="mutedForeground" center>
          {t(outcome === 'applied' ? 'requests.appliedBody' : 'requests.declinedBody')}
        </Text>
        <Button title={t('common.done')} onPress={() => router.back()} fullWidth />
      </View>,
    );
  }

  if (pending.isLoading || (!request && pending.isFetching)) {
    return shell(
      t('requests.sectionTitle'),
      <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
        <Skeleton height={160} radius={radius.lg} />
        <Skeleton height={110} radius={radius.lg} />
      </View>,
    );
  }

  if (pending.isError) {
    return shell(
      t('requests.sectionTitle'),
      <EmptyState
        icon="cloud-offline-outline"
        title={t('common.listLoadFailed')}
        message={t('home.loadErrorBody')}
        actionLabel={t('common.retry')}
        onAction={() => void pending.refetch()}
      />,
    );
  }

  if (!request) {
    return shell(
      t('requests.sectionTitle'),
      <EmptyState
        icon="time-outline"
        title={t('requests.goneTitle')}
        message={t(errorKey ?? 'requests.goneBody')}
        actionLabel={t('common.back')}
        onAction={() => router.back()}
      />,
    );
  }

  const title = requestTitle(request);
  const sentLine = requestSentLine(request, t);

  return shell(
    title,
    <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: spacing.xl, gap: spacing.lg }}>
        {sentLine ? (
          <Text variant="footnote" color="mutedForeground">
            {sentLine}
          </Text>
        ) : null}
        <RequestDetails request={request} />
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        }}>
        {errorKey ? (
          <Text variant="footnote" color="danger" center accessibilityLiveRegion="polite">
            {t(errorKey)}
          </Text>
        ) : null}
        <Button
          title={t('requests.approve')}
          onPress={() => void decide('approve')}
          loading={busy === 'approve'}
          // Not while the list is being read again: the figures may be about to change.
          disabled={busy !== null || pending.isFetching}
          fullWidth
        />
        <Button
          title={t('requests.decline')}
          variant="secondary"
          onPress={() => setDeclining(true)}
          disabled={busy !== null || pending.isFetching}
          fullWidth
        />
      </View>

      <StepUpModal
        visible={stepUpScope !== null}
        scope={stepUpScope ?? ''}
        title={title}
        actionLabel={t(request.budget ? 'requests.approveBudget' : 'requests.approve')}
        note={requestConsequence(request, t)}
        onCancel={() => setStepUpScope(null)}
        onVerified={() => {
          setStepUpScope(null);
          void decide('approve', { afterCode: true });
        }}
      />
      <DeclineSheet
        visible={declining}
        busy={busy === 'decline'}
        onCancel={() => setDeclining(false)}
        onDecline={(reason) => void decide('decline', { reason })}
      />
    </>,
  );
}
