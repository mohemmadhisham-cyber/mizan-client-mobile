import { Ionicons } from '@expo/vector-icons';
import { openBrowserAsync } from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { createRenewalLink } from '@/services/client-billing';
import { getFirmLockStatus, type FirmLockStatus } from '@/services/firm-lock-status';
import { formatMoneyMinor, type Currency } from '@/lib/format';
import { EXPO_PUBLIC_WEB_APP_URL } from '@/lib/env';
import { radius, spacing, useTheme } from '@/theme';

function daysUntil(dateStr: string): number {
  const ms = new Date(`${dateStr}T00:00:00`).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Shown on Home when the firm's account is in the dunning "grace" window
 * (overdue 7-13 days) -- access still works, but will be suspended once the
 * grace period ends. Not shown once actually locked (that's the full-screen
 * access-suspended gate instead). */
export function GracePeriodBanner() {
  const theme = useTheme();
  const [status, setStatus] = useState<FirmLockStatus | null>(null);
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFirmLockStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status || status.state !== 'grace') return null;

  async function renewNow() {
    setRenewing(true);
    const res = await createRenewalLink();
    setRenewing(false);
    if (res.ok && res.token) {
      await openBrowserAsync(`${EXPO_PUBLIC_WEB_APP_URL}/pay/${res.token}`);
    }
  }

  const days = status.graceUntil ? daysUntil(status.graceUntil) : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={renewNow}
      disabled={renewing}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: theme.colors.warningSoft,
        borderRadius: radius.md,
        padding: spacing.base,
        marginBottom: spacing.lg,
      }}>
      <Ionicons name="alert-circle" size={22} color={theme.colors.warningSoftForeground} />
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="semibold" style={{ color: theme.colors.warningSoftForeground }}>
          {days !== null ? `Subscription overdue — ${days} day${days === 1 ? '' : 's'} until access is suspended` : 'Subscription payment overdue'}
        </Text>
        <Text variant="footnote" style={{ color: theme.colors.warningSoftForeground }}>
          {formatMoneyMinor(status.amountDueMinor, status.currency as Currency)} due. {renewing ? 'Opening…' : 'Tap to renew now.'}
        </Text>
      </View>
    </Pressable>
  );
}
