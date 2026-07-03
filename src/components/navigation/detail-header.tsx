import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

interface DetailHeaderProps {
  title: string;
  onBack?: () => void;
}

/** Back button + title for pushed (non-tab) screens. */
export function DetailHeader({ title, onBack }: DetailHeaderProps) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.gutter, paddingBottom: spacing.md }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack ?? (() => router.back())} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={theme.colors.foreground} />
      </Pressable>
      <Text variant="h2" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Text>
    </View>
  );
}
