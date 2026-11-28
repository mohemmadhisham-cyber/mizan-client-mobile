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
import { PriceLines } from '@/components/requests/price-lines';
import { RequestDetails } from '@/components/requests/request-details';
import { requestConsequence, requestSentLine, requestTitle } from '@/components/requests/request-text';
import { StepUpModal } from '@/components/tasks/step-up-modal';
import { EmptyState, Text } from '@/components/ui';
import {
  canChooseLines,
  decideRequest,
  type DecideOutcome,
  isRequestGone,
  type LineChoice,
  lineChoice,
  listPendingRequests,
  requestErrorKey,
  REQUESTS_QUERY_KEY,
  toggleLine,
} from '@/services/accountant-requests';
import { spacing, useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

type Decision = 'approve' | 'decline';
type Outcome =
  | { kind: 'applied'; approved?: number; of?: number; notWritten: number }
  | { kind: 'declined' };

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
  // The lines the owner chose when the code was asked for: the code confirms exactly those, even if the list is read again meanwhile.
  const linesAtCode = useRef<LineChoice | null>(null);

  const [busy, setBusy] = useState<Decision | null>(null);
  const [stepUpScope, setStepUpScope] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // A price change approved line by line: every line starts approved. What the person chose is kept
  // with the lines it was chosen from; if the request comes back with other lines, it starts afresh.
  const choosable = request ? canChooseLines(request) : false;
  const linesKey = request && choosable ? request.changes.map((c) => c.id).join(',') : '';
  const [picked, setPicked] = useState<{ key: string; chosen: Set<number>; reasons: Record<string, string> } | null>(null);
  const fresh = !picked || picked.key !== linesKey;
  const chosen = fresh ? new Set((request?.changes ?? []).map((c) => c.id as number)) : picked.chosen;
  const reasons = fresh ? {} : picked.reasons;
  const lines = request && choosable ? lineChoice(request, chosen, reasons) : null;
  const noneChosen = choosable && chosen.size === 0;

  async function decide(decision: Decision, options: { reason?: string; afterCode?: boolean } = {}) {
    // The id comes from the request the list returned, never from the route.
    const actionId = request?.id;
    if (!actionId || inFlight.current) return;
    inFlight.current = true;
    setBusy(decision);
    setErrorKey(null);
    const sending = decision !== 'approve' ? null : options.afterCode ? linesAtCode.current : lines;
    let result: DecideOutcome;
    try {
      result = await decideRequest(actionId, decision, options.reason, sending);
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
      else {
        linesAtCode.current = sending;
        setStepUpScope(result.scope);
      }
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
    setOutcome(
      result.status === 'applied'
        ? { kind: 'applied', approved: result.approved, of: result.of, notWritten: result.notWritten?.length ?? 0 }
        : { kind: 'declined' },
    );
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
    const applied = outcome.kind === 'applied';
    const partial = applied && typeof outcome.approved === 'number' && typeof outcome.of === 'number';
    return shell(
      outcome.kind,
      [
        {
          text: partial
            ? t('requests.partialTitle', { approved: outcome.approved, of: outcome.of })
            : t(applied ? 'requests.appliedTitle' : 'requests.declinedTitle'),
        },
      ],
      <View style={{ padding: HORIZON_GUTTER, gap: spacing.lg }}>
        <Text variant="body" color="mutedForeground">
          {t(partial ? 'requests.partialBody' : applied ? 'requests.appliedBody' : 'requests.declinedBody')}
        </Text>
        {applied && outcome.notWritten > 0 ? (
          <Text variant="body" color="danger">
            {t('requests.notWritten', { count: outcome.notWritten })}
          </Text>
        ) : null}
        <Cta title={t('common.done')} onPress={() => router.back()} />
      </View>,
      // Approved: the gold crosses the whole line. Declined: nothing is left to act on.
      { bridge: applied ? { start: 0, width } : null },
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
        {choosable ? (
          <PriceLines
            request={request}
            chosen={chosen}
            reasons={reasons}
            disabled={busy !== null}
            onToggle={(lineId) => {
              setErrorKey(null);
              setPicked({ key: linesKey, chosen: toggleLine(request, chosen, lineId), reasons });
            }}
            onReason={(lineId, reason) =>
              setPicked({ key: linesKey, chosen, reasons: { ...reasons, [String(lineId)]: reason } })
            }
          />
        ) : (
          <RequestDetails request={request} />
        )}
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
          title={lines ? t('requests.approveSome', { approved: lines.items.length, of: request.changes.length }) : t('requests.approve')}
          onPress={() => void decide('approve')}
          busy={busy === 'approve'}
          // Not while the list is being read again: the figures may be about to change.
          // Nor with no line chosen: that is a decline, which has its own button.
          disabled={busy === 'decline' || pending.isFetching || noneChosen}
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
        actionLabel={
          lines
            ? t('requests.approveSome', { approved: lines.items.length, of: request.changes.length })
            : t(request.budget ? 'requests.approveBudget' : 'requests.approve')
        }
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
