import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

const MARK_LIGHT = require('../../../assets/images/mizan-mark.png');
const MARK_DARK = require('../../../assets/images/mizan-mark-light.png');

interface DetailHeaderProps {
  title: string;
  onBack?: () => void;
}

/** Back button + title + a small brand mark, for pushed (non-tab) screens. */
export function DetailHeader({ title, onBack }: DetailHeaderProps) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.gutter, paddingBottom: spacing.md }}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={onBack ?? (() => router.back())} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={theme.colors.foreground} />
      </PressableScale>
      <Text variant="h2" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Text>
      <Image
        source={theme.dark ? MARK_DARK : MARK_LIGHT}
        style={{ width: 20, height: 12.6 }}
        resizeMode="contain"
        accessibilityLabel="Mizan"
      />
    </View>
  );
}
