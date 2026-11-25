import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { refreshPush } from '@/lib/push';

const onPhone = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Notifications on the phone, for the signed-in person.
 *
 * - With notifications on, the phone is put on the server's list each time
 *   the app starts or the person signs in.
 * - Tapping a notification opens the app's own list of notifications. Nothing
 *   the notification carries is followed: the list is read from the server,
 *   behind sign-in, like everything else.
 *
 * `ready` is false until the session is known and the first screen is up.
 */
export function usePush(userId: string | null, ready: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    let current = true;
    void refreshPush(userId, () => current);
    return () => {
      current = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!onPhone || !userId || !ready) return;
    const open = () => {
      // Each tap is answered once: without this, the tap that opened the app would be answered again later.
      Notifications.clearLastNotificationResponse();
      router.push('/notifications');
    };
    // The tap that opened the app, if one did.
    if (Notifications.getLastNotificationResponse()) open();
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [userId, ready, router]);
}
