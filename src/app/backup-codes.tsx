import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Cta } from '@/components/horizon/cta';
import { BRIDGE_WIDTH, FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Figure, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import {
  disableBackupCodes,
  generateBackupCodes,
  getBackupCodesStatus,
  type BackupCodesStatus,
} from '@/services/backup-codes';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const BACKUP_FIELD = 150;
const INTRO_SPACE_ABOVE = 20;
const INTRO_SPACE_BELOW = 6;
const ACTIONS_SPACE_ABOVE = 20;
const ACTIONS_GAP = 10;
const CODE_SIZE = 17;
const CODE_PADDING = 14;

export default function BackupCodesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
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
    <HorizonScreen
      field={BACKUP_FIELD}
      small
      lines={[{ text: t('backupCodes.title') }]}
      top={<FieldBack colors={colors} />}
      // New codes are shown once: saving them is the one thing to do now.
      bridge={freshCodes ? { start: HORIZON_GUTTER, width: BRIDGE_WIDTH } : null}>
      <View
        style={{
          paddingHorizontal: HORIZON_GUTTER,
          paddingTop: INTRO_SPACE_ABOVE,
          paddingBottom: INTRO_SPACE_BELOW,
        }}>
        <Text variant="callout" color="mutedForeground">
          {t('backupCodes.intro')}
        </Text>
      </View>

      {!status ? (
        <RuledRow title={t('common.loading')} />
      ) : freshCodes ? (
        <>
          <SectionLabel>{t('backupCodes.saveNowTitle')}</SectionLabel>
          <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingBottom: 10 }}>
            <Text variant="subhead" color="mutedForeground">
              {t('backupCodes.saveNowBody')}
            </Text>
          </View>
          {/* Two to a line in the mono face, ruled like a ledger. */}
          <View style={[styles.codes, { borderTopColor: theme.colors.border }]}>
            {freshCodes.map((code) => (
              <View key={code} style={[styles.code, { borderBottomColor: theme.colors.border }]}>
                <Figure size={CODE_SIZE}>{code}</Figure>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <Cta title={t('backupCodes.doneSaved')} onPress={() => setFreshCodes(null)} />
          </View>
        </>
      ) : (
        <>
          <RuledRow
            title={status.enabled ? t('backupCodes.remaining', { count: status.remaining }) : t('backupCodes.notSetUp')}
            meta={status.enabled ? t('backupCodes.replaceHint') : t('backupCodes.setupHint')}
          />
          <View style={styles.actions}>
            <Cta
              title={status.enabled ? t('backupCodes.regenerate') : t('backupCodes.generate')}
              busy={busy}
              onPress={() => void handleGenerate()}
            />
            {status.enabled ? (
              <Cta kind="outline" title={t('backupCodes.turnOff')} disabled={busy} onPress={handleDisable} />
            ) : null}
          </View>
        </>
      )}
    </HorizonScreen>
  );
}

const styles = StyleSheet.create({
  codes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: HORIZON_GUTTER,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  code: {
    width: '50%',
    paddingVertical: CODE_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    paddingHorizontal: HORIZON_GUTTER,
    paddingTop: ACTIONS_SPACE_ABOVE,
    gap: ACTIONS_GAP,
  },
});
