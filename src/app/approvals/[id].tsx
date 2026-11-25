import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import type { HeadlineLine } from '@/components/horizon/headline';
import {
  type Bridge,
  BRIDGE_WIDTH,
  FieldBack,
  HORIZON_GUTTER,
  HorizonScreen,
} from '@/components/horizon/horizon-screen';
import { DeclineSheet } from '@/components/requests/decline-sheet';
import { RequestDetails } from '@/components/requests/request-details';
import { requestConsequence, requestSentLine, requestTitle } from '@/components/requests/request-text';
import { StepUpModal } from '@/components/tasks/step-up-modal';
import { EmptyState, Text } from '@/components/ui';
import {
  decideRequest,
  type DecideOutcome,
  isRequestGone,
  listPendingRequests,
  requestErrorKey,
  REQUESTS_QUERY_KEY,
} from '@/services/accountant-requests';
import { spacing, useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

type Decision = 'approve' | 'decline';
type Outcome = 'applied' | 'declined';

/** Height of the field: a one-line title and one quiet line under it. */
const APPROVE_FIELD = 176;
/** A title longer than this is cut in the field, so it is repeated in full below the line. */
const TITLE_FITS = 26;
const REST_BRIDGE: Bridge = { start: HORIZON_GUTTER, width: BRIDGE_WIDTH };

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
  const colors = horizonColors(theme.colors);
  const { width } = useWindowDimensions();
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
    // Shown at once: the request is about to leave the list, and nothing may be tapped in between.
    setOutcome(result.status);
    successHaptic();
    void queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY });
  }

  const shell = (
    key: string,
    lines: HeadlineLine[],
    body: ReactNode,
    options: { sub?: string; bridge?: Bridge | null } = {},
  ) => (
    <HorizonScreen
      field={APPROVE_FIELD}
      small
      scroll={false}
      animateKey={key}
      lines={lines}
      sub={options.sub}
      top={<FieldBack colors={colors} />}
      bridge={options.bridge ?? null}>
      {body}
    </HorizonScreen>
  );

  // The answer is in: show it even though the request has now left the list.
  if (outcome) {
    return shell(
      outcome,
      [{ text: t(outcome === 'applied' ? 'requests.appliedTitle' : 'requests.declinedTitle') }],
      <View style={{ padding: HORIZON_GUTTER, gap: spacing.lg }}>
        <Text variant="body" color="mutedForeground">
          {t(outcome === 'applied' ? 'requests.appliedBody' : 'requests.declinedBody')}
        </Text>
        <Cta title={t('common.done')} onPress={() => router.back()} />
      </View>,
      // Approved: the gold crosses the whole line. Declined: nothing is left to act on.
      { bridge: outcome === 'applied' ? { start: 0, width } : null },
    );
  }

  if (pending.isLoading || (!request && pending.isFetching)) {
    return shell('loading', [{ text: t('common.loading'), soft: true }], null);
  }

  if (pending.isError) {
    return shell(
      'error',
      [{ text: t('requests.sectionTitle') }],
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
      'gone',
      [{ text: t('requests.sectionTitle') }],
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
    'request',
    [{ text: title }],
    <>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: HORIZON_GUTTER,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
          gap: spacing.lg,
        }}>
        {title.length > TITLE_FITS ? (
          // Read once: the field already speaks the title in full.
          <Text variant="title" accessibilityElementsHidden importantForAccessibility="no">
            {title}
          </Text>
        ) : null}
        <RequestDetails request={request} />
      </ScrollView>

      <View
        style={{
          paddingHorizontal: HORIZON_GUTTER,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
          gap: 10,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        }}>
        {errorKey ? (
          <Text variant="footnote" color="danger" center accessibilityLiveRegion="polite">
            {t(errorKey)}
          </Text>
        ) : null}
        <Cta
          title={t('requests.approve')}
          onPress={() => void decide('approve')}
          busy={busy === 'approve'}
          // Not while the list is being read again: the figures may be about to change.
          disabled={busy === 'decline' || pending.isFetching}
        />
        <Cta
          kind="outline"
          title={t('requests.decline')}
          onPress={() => setDeclining(true)}
          disabled={busy !== null || pending.isFetching}
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
    { sub: sentLine || undefined, bridge: REST_BRIDGE },
  );
}
