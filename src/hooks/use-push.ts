import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { flushForgottenPush, forgetPushWhenSignedOut, refreshPush, setPushViewer } from '@/lib/push';

const onPhone = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Notifications on the phone, for whoever is signed in.
 *
 * - With notifications on, the phone is put on the server's list each time
 *   the app starts or the person signs in.
 * - When a person stops being signed in, however that came about (signing
 *   out, signing out everywhere, the session ending on its own), the phone
 *   comes off the list. If the server cannot be reached, that is tried again
 *   each time the app comes back into view.
 * - Tapping a notification opens the app's own list of notifications. Nothing
 *   the notification carries is followed: the list is read from the server,
 *   behind sign-in, like everything else.
 *
 * `ready` is false until the session is known and the first screen is up.
 */
export function usePush(userId: string | null, ready: boolean): void {
  const router = useRouter();

  useEffect(() => {
    setPushViewer(userId);
    if (!userId) {
      // A tap made while nobody was signed in is not kept for whoever signs in next.
      if (onPhone) Notifications.clearLastNotificationResponse();
      void flushForgottenPush();
      return;
    }
    let current = true;
    void refreshPush(userId, () => current);
    return () => {
      current = false;
      // No longer this person's phone. Every way of ceasing to be signed in passes through here:
      // signing out, signing out everywhere, and a session that ended on its own.
      void forgetPushWhenSignedOut(userId);
    };
  }, [userId]);

  // A phone that could not be taken off the list is tried again whenever the app comes back into view.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushForgottenPush();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!onPhone || !userId || !ready) return;
    const open = () => {
      // Each tap is answered once: without this, the tap that opened the app would be answered again later.
      Notifications.clearLastNotificationResponse();
      // To the list, not onto a pile of lists: a second tap does not stack a second screen.
      router.navigate('/notifications');
    };
    // The tap that opened the app, if one did.
    if (Notifications.getLastNotificationResponse()) open();
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [userId, ready, router]);
}
