import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Button, Screen, Text } from '@/components/ui';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { radius, spacing, useTheme } from '@/theme';

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const reduced = useReducedMotion();

  return (
    <Screen clearsTabBar={false} edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View
          entering={reduced ? undefined : FadeInDown.duration(500)}
          style={{ gap: spacing.lg }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.xl,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="wallet" size={30} color={theme.colors.primaryForeground} />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="footnote" color="brandAccent" weight="semibold">
              {t('common.appName')}
            </Text>
            <Text variant="display">{t('auth.welcomeTitle')}</Text>
            <Text variant="body" color="mutedForeground">
              {t('auth.welcomeBody')}
            </Text>
          </View>
        </Animated.View>
      </View>
      <Animated.View entering={reduced ? undefined : FadeInUp.duration(500).delay(150)}>
        <Button title={t('auth.getStarted')} onPress={() => router.push('/email')} fullWidth />
      </Animated.View>
    </Screen>
  );
}
