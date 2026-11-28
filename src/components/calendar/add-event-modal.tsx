import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Card, Input, Text } from '@/components/ui';
import { useAppLocked } from '@/hooks/use-app-lock';
import type { CalendarEventKind, NewCalendarEvent } from '@/services/types';
import { radius, spacing, useTheme } from '@/theme';

const KINDS: { key: CalendarEventKind; labelKey: string }[] = [
  { key: 'meeting', labelKey: 'calendar.kindMeeting' },
  { key: 'task', labelKey: 'calendar.kindTask' },
  { key: 'deadline', labelKey: 'calendar.kindDeadline' },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

type DraftEvent = Omit<NewCalendarEvent, 'eventDate'>;

interface AddEventModalProps {
  visible: boolean;
  dateLabel: string;
  onCancel: () => void;
  onCreate: (event: DraftEvent) => Promise<void>;
}

export function AddEventModal({ visible, dateLabel, onCancel, onCreate }: AddEventModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const appLocked = useAppLocked();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<CalendarEventKind>('meeting');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setKind('meeting');
    setTitle('');
    setTime('');
    setDescription('');
    setError(null);
  }

  async function submit() {
    if (!title.trim()) {
      setError(t('calendar.titleRequired'));
      return;
    }
    if (time.trim() && !TIME_PATTERN.test(time.trim())) {
      setError(t('calendar.timeFormat'));
      return;
    }
    setError(null);
    setBusy(true);
    await onCreate({
      kind,
      title: title.trim(),
      description: description.trim() || undefined,
      eventTime: time.trim() || undefined,
    });
    setBusy(false);
    reset();
  }

  return (
    // Closed while the app is locked: a sheet is drawn above the lock. It comes back as it was.
    <Modal visible={visible && !appLocked} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: theme.colors.scrim, justifyContent: 'flex-end' }}>
        <Card
          elevated
          style={{
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            paddingBottom: insets.bottom + spacing.lg,
            gap: spacing.md,
          }}>
          <Text variant="title">{t('calendar.newEvent')}</Text>
          <Text variant="footnote" color="mutedForeground">
            {dateLabel}
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {KINDS.map((k) => {
              const active = kind === k.key;
              return (
                <Pressable
                  key={k.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setKind(k.key)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: active ? theme.colors.primary : theme.colors.secondary,
                  }}>
                  <Text variant="caption" weight="semibold" style={{ color: active ? theme.colors.primaryForeground : theme.colors.foreground }}>
                    {t(k.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Input label={t('calendar.titleLabel')} value={title} onChangeText={setTitle} placeholder={t('calendar.titlePlaceholder')} />
          <Input label={t('calendar.timeLabel')} value={time} onChangeText={setTime} placeholder="14:30" keyboardType="numbers-and-punctuation" />
          <Input label={t('calendar.notesLabel')} value={description} onChangeText={setDescription} placeholder={t('calendar.notesPlaceholder')} />

          {error ? (
            <Text variant="footnote" color="danger">
              {error}
            </Text>
          ) : null}

          <Button title={t('calendar.addEvent')} onPress={submit} loading={busy} fullWidth />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              reset();
              onCancel();
            }}
            style={{ alignItems: 'center', paddingTop: spacing.xs }}>
            <Text variant="footnote" color="mutedForeground">
              {t('common.cancel')}
            </Text>
          </Pressable>
        </Card>
      </View>
    </Modal>
  );
}
