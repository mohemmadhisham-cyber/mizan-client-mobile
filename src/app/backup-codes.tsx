import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
          t('backupCodes.replaceTitle'),
          t('backupCodes.replaceBody'),
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('backupCodes.replace'), style: 'destructive', onPress: () => resolve(true) },
          ],
        );
      });
    if (!(await proceed())) return;

    setBusy(true);
    const res = await generateBackupCodes();
    setBusy(false);
    if (!res.ok || !res.codes) {
      Alert.alert(t('backupCodes.generateFailed'), res.error ?? t('common.tryAgainShort'));
      return;
    }
    setFreshCodes(res.codes);
    setStatus({ enabled: true, remaining: res.codes.length });
  }

  function handleDisable() {
    Alert.alert(t('backupCodes.turnOffTitle'), t('backupCodes.turnOffBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backupCodes.turnOff'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const res = await disableBackupCodes();
          setBusy(false);
          if (!res.ok) {
            Alert.alert(t('backupCodes.turnOffFailed'), res.error ?? t('common.tryAgainShort'));
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
      <DetailHeader title={t('backupCodes.title')} />
      <ScrollView contentContainerStyle={{ padding: spacing.gutter, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Text variant="callout" color="mutedForeground">
          {t('backupCodes.intro')}
        </Text>

        {!status ? (
          <Skeleton height={100} radius={radius.lg} />
        ) : freshCodes ? (
          <Card elevated style={{ gap: spacing.md }}>
            <Text variant="title">{t('backupCodes.saveNowTitle')}</Text>
            <Text variant="footnote" color="mutedForeground">
              {t('backupCodes.saveNowBody')}
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
            <Button title={t('backupCodes.doneSaved')} onPress={() => setFreshCodes(null)} fullWidth />
          </Card>
        ) : (
          <Card elevated style={{ gap: spacing.md }}>
            <Text variant="title">{status.enabled ? t('backupCodes.remaining', { count: status.remaining }) : t('backupCodes.notSetUp')}</Text>
            <Text variant="footnote" color="mutedForeground">
              {status.enabled
                ? t('backupCodes.replaceHint')
                : t('backupCodes.setupHint')}
            </Text>
            <Button
              title={status.enabled ? t('backupCodes.regenerate') : t('backupCodes.generate')}
              onPress={handleGenerate}
              loading={busy}
              fullWidth
            />
            {status.enabled ? (
              <Button title={t('backupCodes.turnOff')} variant="secondary" onPress={handleDisable} disabled={busy} fullWidth />
            ) : null}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
