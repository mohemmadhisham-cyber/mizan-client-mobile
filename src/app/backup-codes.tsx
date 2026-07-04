import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Button, Card, Skeleton, Text } from '@/components/ui';
import {
  disableBackupCodes,
  generateBackupCodes,
  getBackupCodesStatus,
  type BackupCodesStatus,
} from '@/services/backup-codes';
import { radius, spacing, useTheme } from '@/theme';

export default function BackupCodesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<BackupCodesStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);

  useEffect(() => {
    getBackupCodesStatus().then(setStatus);
  }, []);

  async function handleGenerate() {
    const proceed = () =>
      new Promise<boolean>((resolve) => {
        if (!status?.enabled) return resolve(true);
        Alert.alert(
          'Replace existing codes?',
          'Generating new codes immediately invalidates any codes you already have.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Replace', style: 'destructive', onPress: () => resolve(true) },
          ],
        );
      });
    if (!(await proceed())) return;

    setBusy(true);
    const res = await generateBackupCodes();
    setBusy(false);
    if (!res.ok || !res.codes) {
      Alert.alert('Could not generate codes', res.error ?? 'Try again.');
      return;
    }
    setFreshCodes(res.codes);
    setStatus({ enabled: true, remaining: res.codes.length });
  }

  function handleDisable() {
    Alert.alert('Turn off backup codes?', 'Your existing codes will stop working.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Turn off',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const res = await disableBackupCodes();
          setBusy(false);
          if (!res.ok) {
            Alert.alert('Could not turn off backup codes', res.error ?? 'Try again.');
            return;
          }
          setStatus({ enabled: false, remaining: 0 });
          setFreshCodes(null);
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title="Backup Codes" />
      <ScrollView contentContainerStyle={{ padding: spacing.gutter, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Text variant="callout" color="mutedForeground">
          {"Backup codes let you prove it's you if you ever lose access to your email. They are not a second login step — keep them somewhere safe, like a password manager."}
        </Text>

        {!status ? (
          <Skeleton height={100} radius={radius.lg} />
        ) : freshCodes ? (
          <Card elevated style={{ gap: spacing.md }}>
            <Text variant="title">Save these codes now</Text>
            <Text variant="footnote" color="mutedForeground">
              {"Each code works once. This is the only time they'll be shown."}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {freshCodes.map((code) => (
                <View
                  key={code}
                  style={{
                    backgroundColor: theme.colors.secondary,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.sm,
                  }}>
                  <Text variant="body" weight="semibold" tabular>
                    {code}
                  </Text>
                </View>
              ))}
            </View>
            <Button title="Done — I've saved these" onPress={() => setFreshCodes(null)} fullWidth />
          </Card>
        ) : (
          <Card elevated style={{ gap: spacing.md }}>
            <Text variant="title">{status.enabled ? `${status.remaining} codes remaining` : 'Not set up'}</Text>
            <Text variant="footnote" color="mutedForeground">
              {status.enabled
                ? 'Generating new codes replaces these.'
                : 'Generate a set of one-time codes to protect account recovery.'}
            </Text>
            <Button
              title={status.enabled ? 'Regenerate codes' : 'Generate backup codes'}
              onPress={handleGenerate}
              loading={busy}
              fullWidth
            />
            {status.enabled ? (
              <Button title="Turn off" variant="secondary" onPress={handleDisable} disabled={busy} fullWidth />
            ) : null}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
