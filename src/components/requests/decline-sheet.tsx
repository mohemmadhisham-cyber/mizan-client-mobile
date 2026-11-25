import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, KeyboardAvoidingView, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Text } from '@/components/ui';
import { DECLINE_REASON_MAX } from '@/services/accountant-requests';
import { radius, spacing, useTheme } from '@/theme';

interface DeclineSheetProps {
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  /** Called with the reason the person typed, or undefined when they left it empty. */
  onDecline: (reason: string | undefined) => void;
}

/** Asks for an optional short reason before declining; the accountant sees it. */
export function DeclineSheet({ visible, busy, onCancel, onDecline }: DeclineSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');
  const family = I18nManager.isRTL ? theme.fonts.arabic : theme.fonts.sans;

  function close() {
    setReason('');
    onCancel();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: theme.colors.scrim, justifyContent: 'flex-end' }}>
        <Card
          elevated
          style={{
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            paddingBottom: insets.bottom + spacing.lg,
            gap: spacing.md,
          }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="title">{t('requests.declineTitle')}</Text>
            <Text variant="footnote" color="mutedForeground">
              {t('requests.declineBody')}
            </Text>
          </View>

          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={DECLINE_REASON_MAX}
            placeholder={t('requests.reasonPlaceholder')}
            placeholderTextColor={theme.colors.mutedForeground}
            accessibilityLabel={t('requests.reasonLabel')}
            style={{
              minHeight: 96,
              textAlignVertical: 'top',
              textAlign: I18nManager.isRTL ? 'right' : 'left',
              borderWidth: 1,
              borderColor: theme.colors.input,
              borderRadius: radius.md,
              padding: spacing.md,
              color: theme.colors.foreground,
              backgroundColor: theme.colors.background,
              fontFamily: family.regular,
              fontSize: theme.typography.body.fontSize,
            }}
          />
          <Text variant="caption" color="mutedForeground" tabular style={{ alignSelf: 'flex-end' }}>
            {reason.length}/{DECLINE_REASON_MAX}
          </Text>

          <Button title={t('requests.decline')} onPress={() => onDecline(reason.trim() || undefined)} loading={busy} fullWidth />
          <Pressable accessibilityRole="button" onPress={close} disabled={busy} style={{ alignSelf: 'center' }}>
            <Text variant="footnote" color="mutedForeground">
              {t('common.cancel')}
            </Text>
          </Pressable>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}
