import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, Keyboard, Linking, View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import { BRIDGE_WIDTH, FieldMark, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Text } from '@/components/ui';

const UPDATE_FIELD = 260;
const GROUND_TOP = 22;
const GROUND_GAP = 16;

interface UpdateRequiredScreenProps {
  /** The store page for this phone, already checked to be the store's own. Null when there is none to follow. */
  storeUrl: string | null;
}

/**
 * Shown over the whole app when this version is older than the server still
 * accepts. There is one thing to do, and nothing else to reach: the screens
 * under it would not work.
 */
export function UpdateRequiredScreen({ storeUrl }: UpdateRequiredScreenProps) {
  const { t } = useTranslation();

  useEffect(() => {
    Keyboard.dismiss();
    // The phone's back button does nothing here: it must not move the screens underneath.
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => back.remove();
  }, []);

  function openStore() {
    if (!storeUrl) return;
    Linking.openURL(storeUrl).catch(() => {
      Alert.alert(t('update.openFailedTitle'), t('update.noLink'));
    });
  }

  return (
    <HorizonScreen
      field={UPDATE_FIELD}
      lines={[{ text: t('common.appName') }, { text: t('update.titleB'), soft: true }]}
      top={<FieldMark />}
      // The bridge marks the one thing to do. With no store page to open there is no button, so no bridge.
      bridge={storeUrl ? { start: HORIZON_GUTTER, width: BRIDGE_WIDTH } : null}>
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: GROUND_TOP, gap: GROUND_GAP }}>
        <Text variant="body">{t('update.body')}</Text>
        {storeUrl ? (
          <Cta title={t('update.action')} onPress={openStore} />
        ) : (
          <Text variant="body" color="mutedForeground">
            {t('update.noLink')}
          </Text>
        )}
      </View>
    </HorizonScreen>
  );
}
