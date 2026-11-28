import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import { BRIDGE_WIDTH, FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { ChoiceRow, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { WordTabs } from '@/components/horizon/word-tabs';
import { Input, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { bookMeeting, getMeetingSlots, slotsByDay } from '@/services/client-pages';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const MEETING_FIELD = 170;
const GROUND_TOP = 18;
const GROUND_GAP = 14;
const NOTE_MAX = 500;
const NOTE_TEXT_SIZE = 16;
/** Days are dates without a time: formatted in UTC, so they never show as the day before. */
const DAY_TAB = { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' } as const;
const DAY_LONG = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' } as const;

/** The firm's time zone as a person says it. The server sends one of the GCC zones. */
const ZONE_KEY: Record<string, string> = {
  'Asia/Dubai': 'meetingScreen.zoneUae',
  'Asia/Riyadh': 'meetingScreen.zoneKsa',
  'Asia/Qatar': 'meetingScreen.zoneQatar',
  'Asia/Bahrain': 'meetingScreen.zoneBahrain',
  'Asia/Kuwait': 'meetingScreen.zoneKuwait',
  'Asia/Muscat': 'meetingScreen.zoneOman',
};

const dayText = (date: string, opts: Intl.DateTimeFormatOptions) => formatDate(`${date}T00:00:00Z`, opts);

type Sent = { date: string; start: string };
type Problem = 'taken' | 'tooMany' | 'failed' | 'notOffered';

/**
 * Asking the accountant's firm for a meeting. The free times are the firm's
 * own (its working hours, less what is already booked), worked out by the
 * server. The person picks a day and a time and may add a note; the firm then
 * confirms it. Nothing is booked until then, and the screen says so.
 */
export default function BookMeetingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clientId } = useAuth();
  const slotsKey = ['meeting-slots', clientId ?? 'none'];

  const slots = useQuery({ queryKey: slotsKey, queryFn: getMeetingSlots });
  const value = slots.data?.status === 'ok' ? slots.data.value : null;
  const days = useMemo(() => slotsByDay(value?.slots ?? []), [value]);

  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [chosenStart, setChosenStart] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  const day = days.find((d) => d.date === chosenDay) ?? days[0] ?? null;
  const zone = value ? (ZONE_KEY[value.timeZone] ? t(ZONE_KEY[value.timeZone]) : value.timeZone) : '';

  async function send() {
    if (!day || !chosenStart) return;
    setSending(true);
    setProblem(null);
    try {
      const outcome = await bookMeeting({ date: day.date, start: chosenStart, note });
      if (outcome.status === 'requested') {
        setSent({ date: outcome.date, start: outcome.start });
        // The calendar shows the request as waiting for the firm.
        void queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        void queryClient.invalidateQueries({ queryKey: ['calendar-days'] });
        return;
      }
      if (outcome.status === 'slot_taken') {
        setProblem('taken');
        setChosenStart(null);
        void slots.refetch();
        return;
      }
      setProblem(outcome.status === 'too_many_open' ? 'tooMany' : 'notOffered');
    } catch {
      setProblem('failed');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <HorizonScreen
        field={MEETING_FIELD}
        small
        lines={[{ text: t('meetingScreen.sentA') }, { text: t('meetingScreen.sentB'), soft: true }]}
        top={<FieldBack colors={colors} />}
        bridge={null}>
        <RuledRow
          title={t('meetingScreen.sentWhen', { day: dayText(sent.date, DAY_LONG), time: sent.start })}
          meta={zone || undefined}
        />
        <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: GROUND_TOP, gap: GROUND_GAP }}>
          <Text variant="body">{t('meetingScreen.sentBody', { firm: value?.firm ?? t('meetingScreen.yourAccountant') })}</Text>
          <Cta title={t('meetingScreen.done')} onPress={() => router.back()} />
        </View>
      </HorizonScreen>
    );
  }

  const ready = value !== null && value.accepting && days.length > 0;

  return (
    <HorizonScreen
      field={MEETING_FIELD}
      small
      lines={[{ text: t('meetingScreen.titleA') }, { text: t('meetingScreen.titleB'), soft: true }]}
      sub={value?.firm ? t('meetingScreen.withFirm', { firm: value.firm }) : undefined}
      subLines={1}
      top={<FieldBack colors={colors} />}
      // Choosing a time is the person's to do.
      bridge={ready ? { start: HORIZON_GUTTER, width: BRIDGE_WIDTH } : null}>
      {slots.isError && !slots.data ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void slots.refetch()} />
      ) : slots.isPending ? (
        <RuledRow title={t('common.loading')} />
      ) : slots.data?.status === 'not_offered' ? (
        <RuledRow title={t('meetingScreen.notOffered')} plain />
      ) : value && !value.accepting ? (
        <RuledRow title={t('meetingScreen.notAccepting')} plain />
      ) : days.length === 0 ? (
        <RuledRow title={t('meetingScreen.noSlots')} plain />
      ) : day ? (
        <>
          <WordTabs
            accessibilityLabel={t('meetingScreen.dayLabel')}
            options={days.map((d) => ({ key: d.date, label: dayText(d.date, DAY_TAB) }))}
            value={day.date}
            onChange={(next) => {
              setChosenDay(next);
              setChosenStart(null);
              setProblem(null);
            }}
          />
          <SectionLabel>{t('meetingScreen.timesLabel', { minutes: value?.minutes ?? 30, zone })}</SectionLabel>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('meetingScreen.timeLabel')}>
            {day.slots.map((slot) => (
              <ChoiceRow
                key={slot.start}
                title={t('meetingScreen.slot', { start: slot.start, end: slot.end })}
                selected={chosenStart === slot.start}
                onPress={() => {
                  setChosenStart(slot.start);
                  setProblem(null);
                }}
              />
            ))}
          </View>
          <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: GROUND_TOP, gap: GROUND_GAP }}>
            <Input
              variant="underline"
              style={{ backgroundColor: 'transparent', paddingHorizontal: 0, fontSize: NOTE_TEXT_SIZE }}
              accessibilityLabel={t('meetingScreen.noteLabel')}
              placeholder={t('meetingScreen.notePlaceholder')}
              value={note}
              onChangeText={setNote}
              maxLength={NOTE_MAX}
              multiline
            />
            {problem ? (
              <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
                {t(`meetingScreen.problem_${problem}`)}
              </Text>
            ) : null}
            <Cta
              title={t('meetingScreen.request')}
              disabled={!chosenStart}
              busy={sending}
              onPress={() => void send()}
            />
            <Text variant="footnote" color="mutedForeground">
              {t('meetingScreen.confirmNote')}
            </Text>
          </View>
        </>
      ) : null}
    </HorizonScreen>
  );
}
