import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountantChatView } from '@/components/accountant-chat/accountant-chat-view';
import { Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { spacing, useTheme } from '@/theme';

/**
 * Messages with the accountant, as its own tab. The conversation itself
 * (text, photos, voice messages) is the existing chat view, unchanged.
 */
export default function MessagesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, clientId, firmId } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Text
        accessibilityRole="header"
        variant="h2"
        weight="semibold"
        style={{
          paddingHorizontal: spacing.gutter,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}>
        {t('nav.messages')}
      </Text>
      <AccountantChatView clientId={clientId} firmId={firmId} userId={user?.id} safeBottom={false} />
    </View>
  );
}
