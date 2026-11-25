import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, BackHandler, Keyboard, View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import { BRIDGE_WIDTH, FieldMark, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Text } from '@/components/ui';
import { askToUnlock, setAppLock } from '@/lib/app-lock';

/** What asking the phone came to. Null when a question was already out: that one answers. */
type Answer = 'unlocked' | 'refused' | null;

const LOCK_FIELD = 260;
const GROUND_TOP = 22;
const GROUND_GAP = 16;

interface AppLockScreenProps {
  userId: string;
  onUnlocked: () => void;
  onSignOut: () => void;
}

/**
 * Shown over the whole app while it is locked. It asks the phone to confirm
 * who is holding it as soon as it appears, and again when the person presses
 * Unlock. Signing out is always offered, so a person who cannot unlock is
 * never stuck: they sign in again with an emailed code.
 */
export function AppLockScreen({ userId, onUnlocked, onSignOut }: AppLockScreenProps) {
  const { t } = useTranslation();
  // It asks as soon as it appears, so it starts out asking.
  const [asking, setAsking] = useState(true);
  const [refused, setRefused] = useState(false);
  // Set at once, unlike state: two presses ask the phone once.
  const inFlight = useRef(false);

  async function ask(): Promise<Answer> {
    if (inFlight.current) return null;
    inFlight.current = true;
    try {
      const result = await askToUnlock(t('lock.prompt'));
      if (result !== 'unavailable') return result;
      // The phone no longer has a passcode, fingerprint or face to confirm with, so the lock
      // cannot be kept. It is turned off, and the person can turn it on again in Settings.
      await setAppLock(userId, false);
      return 'unlocked';
    } finally {
      inFlight.current = false;
    }
  }

  function settle(answer: Answer) {
    if (answer === 'unlocked') {
      onUnlocked();
    } else if (answer === 'refused') {
      setAsking(false);
      setRefused(true);
    }
  }

  function pressUnlock() {
    setAsking(true);
    setRefused(false);
    void ask().then(settle);
  }

  useEffect(() => {
    Keyboard.dismiss();
    // The phone's back button does nothing here: it must not move the screens under the lock.
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);

    // Ask straight away: the person opened the app to use it. The phone can only ask while
    // the app is in view, so an app started out of sight waits until it is.
    let waiting: { remove: () => void } | null = null;
    if (AppState.currentState === 'active') {
      void ask().then(settle);
    } else {
      waiting = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        waiting?.remove();
        waiting = null;
        void ask().then(settle);
      });
    }
    return () => {
      back.remove();
      waiting?.remove();
    };
    // Once, when the lock appears. `ask` and `settle` are rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HorizonScreen
      field={LOCK_FIELD}
      lines={[{ text: t('common.appName') }, { text: t('lock.titleB'), soft: true }]}
      top={<FieldMark />}
      // The one thing to do here.
      bridge={{ start: HORIZON_GUTTER, width: BRIDGE_WIDTH }}>
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: GROUND_TOP, gap: GROUND_GAP }}>
        <Text variant="body">{t('lock.body')}</Text>
        {refused ? (
          <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
            {t('lock.refused')}
          </Text>
        ) : null}
        <Cta title={t('lock.unlock')} busy={asking} onPress={pressUnlock} />
        <Cta kind="quiet" title={t('auth.signOut')} disabled={asking} onPress={onSignOut} />
      </View>
    </HorizonScreen>
  );
}
