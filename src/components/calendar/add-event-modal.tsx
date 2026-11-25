import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Input, Text } from '@/components/ui';
import type { CalendarEventKind, NewCalendarEvent } from '@/services/types';
import { radius, spacing, useTheme } from '@/theme';

const KINDS: { key: CalendarEventKind; label: string }[] = [
  { key: 'meeting', label: 'Meeting' },
  { key: 'task', label: 'Task' },
  { key: 'deadline', label: 'Deadline' },
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
  const theme = useTheme();
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
      setError('Give the event a title.');
      return;
    }
    if (time.trim() && !TIME_PATTERN.test(time.trim())) {
      setError('Time must be in 24-hour HH:MM format, e.g. 14:30.');
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: theme.colors.scrim, justifyContent: 'flex-end' }}>
        <Card
          elevated
          style={{
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            paddingBottom: insets.bottom + spacing.lg,
            gap: spacing.md,
          }}>
          <Text variant="title">New event</Text>
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
                    {k.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Call with accountant" />
          <Input label="Time (optional)" value={time} onChangeText={setTime} placeholder="14:30" keyboardType="numbers-and-punctuation" />
          <Input label="Notes (optional)" value={description} onChangeText={setDescription} placeholder="Anything to remember" />

          {error ? (
            <Text variant="footnote" color="danger">
              {error}
            </Text>
          ) : null}

          <Button title="Add event" onPress={submit} loading={busy} fullWidth />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              reset();
              onCancel();
            }}
            style={{ alignItems: 'center', paddingTop: spacing.xs }}>
            <Text variant="footnote" color="mutedForeground">
              Cancel
            </Text>
          </Pressable>
        </Card>
      </View>
    </Modal>
  );
}
