import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';
import { chevronBack } from '@/lib/direction';
import { spacing, useTheme } from '@/theme';

const MARK_LIGHT = require('../../../assets/images/mizan-mark.png');
const MARK_DARK = require('../../../assets/images/mizan-mark-light.png');

interface DetailHeaderProps {
  title: string;
  onBack?: () => void;
  /** False on a tab's own screen, where there is nothing to go back to. */
  showBack?: boolean;
}

/** Back button + title + a small brand mark, for pushed (non-tab) screens. */
export function DetailHeader({ title, onBack, showBack = true }: DetailHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.gutter, paddingBottom: spacing.md }}>
      {showBack ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onBack ?? (() => router.back())} hitSlop={8}>
          <Ionicons name={chevronBack()} size={22} color={theme.colors.foreground} />
        </PressableScale>
      ) : null}
      <Text variant="h2" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Text>
      <Image
        source={theme.dark ? MARK_DARK : MARK_LIGHT}
        style={{ width: 20, height: 12.6 }}
        resizeMode="contain"
        accessibilityLabel={t('common.appName')}
      />
    </View>
  );
}
