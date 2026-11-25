import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { readDevicePref, writeDevicePref } from '@/lib/device-prefs';
import { registerPushToken, unregisterPushToken, type PushPlatform } from '@/services/push-tokens';

/**
 * Notifications on the phone: a person turns them on in Settings, per phone.
 * The phone then has a push address ("token"), which the app gives to the
 * server so that it can send this person's notifications here, and takes back
 * when they turn it off or sign out.
 *
 * A push shows only a short title. Tapping one opens the app's own list of
 * notifications; nothing in a push is ever followed as a link.
 *
 * The choice and the token are kept on this device, per person. They are not
 * secrets from the person, and the token is of no use without the server's
 * own key to the push service.
 */

const ON = 'on';
const OFF = 'off';
const choiceKey = (userId: string) => `push.${userId}`;
const tokenKey = (userId: string) => `push_token.${userId}`;
const ANDROID_CHANNEL = 'default';
/** How long signing out waits for the server to take this phone off its list. Signing out is never held up for longer. */
export const SIGN_OUT_WAIT_MS = 3_000;

const pushPlatform = (): PushPlatform | null => (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null);

export function isPushOn(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return readDevicePref(choiceKey(userId)) === ON;
}

/**
 * Once, when the app starts: a notification that arrives while the app is
 * open is shown as a banner and in the phone's list, quietly.
 */
export function configurePushHandling(): void {
  if (!pushPlatform()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Whether the phone lets this app show notifications. `ask` puts the phone's own question to the person if it can still be asked. */
async function allowed(ask: boolean): Promise<boolean> {
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (!ask || !now.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** This phone's push address, or null when it has none (a simulator, a build without push set up). */
async function phoneToken(): Promise<string | null> {
  const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !projectId) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data || null;
  } catch {
    return null;
  }
}

export type PushTurnOn =
  /** On: this phone is on the server's list. */
  | 'on'
  /** The phone does not let this app show notifications. The person can change that in the phone's settings. */
  | 'denied'
  /** This build or this server cannot do push yet. */
  | 'unavailable'
  /** It should have worked and did not. Try again. */
  | 'failed';

/**
 * Turns notifications on for this person on this phone. `channelName` is the
 * name Android shows for the app's notifications in the phone's settings.
 * Never throws.
 */
export async function turnPushOn(userId: string, channelName: string): Promise<PushTurnOn> {
  const platform = pushPlatform();
  if (!platform) return 'unavailable';
  try {
    // Android asks its question only once a channel exists.
    if (platform === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: channelName,
        // The lint rule does not follow the package's re-export of this enum. TypeScript does, and checks it.
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    if (!(await allowed(true))) return 'denied';
    const token = await phoneToken();
    if (!token) return 'unavailable';
    const saved = await registerPushToken(token, platform, userId);
    if (saved === 'not_offered') return 'unavailable';
    if (saved === 'failed') return 'failed';
    const kept = (await writeDevicePref(tokenKey(userId), token)) && (await writeDevicePref(choiceKey(userId), ON));
    if (kept) return 'on';
    // The phone could not keep the choice. The server is told to forget, so the two do not disagree.
    await unregisterPushToken(token, userId);
    return 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Turns them off. The server is told first: only it can stop a push from
 * arriving, so "off" is not shown until it has heard. Resolves to false when
 * it could not be told. Never throws.
 */
export async function turnPushOff(userId: string): Promise<boolean> {
  try {
    const token = readDevicePref(tokenKey(userId));
    if (token && (await unregisterPushToken(token, userId)) === 'failed') return false;
    return await writeDevicePref(choiceKey(userId), OFF);
  } catch {
    return false;
  }
}

/**
 * When the app starts, or a person signs in, with notifications on: the phone
 * is put on the server's list again. That keeps the list fresh (the server
 * stops sending to a phone it has not heard from for a long time), puts back
 * a phone taken off at sign-out, and follows a token the phone has changed.
 * The phone's own question is not asked here. Never throws.
 */
export async function refreshPush(userId: string, isCurrent: () => boolean = () => true): Promise<void> {
  const platform = pushPlatform();
  if (!platform || !isPushOn(userId)) return;
  try {
    if (!(await allowed(false))) return;
    const token = await phoneToken();
    if (!token || !isCurrent()) return;
    if ((await registerPushToken(token, platform, userId)) !== 'saved') return;
    const before = readDevicePref(tokenKey(userId));
    if (before === token) return;
    await writeDevicePref(tokenKey(userId), token);
    if (before && isCurrent()) await unregisterPushToken(before, userId);
  } catch {
    // Best effort: the next start tries again.
  }
}

/**
 * Before signing out: this phone is taken off the server's list, so the next
 * person to use it is not shown this person's notifications. It needs the
 * session, so it runs first; it waits `SIGN_OUT_WAIT_MS` at most. The choice
 * itself is kept: signing in again on this phone puts it back. Never throws.
 */
export async function forgetPushOnSignOut(userId: string): Promise<void> {
  const token = readDevicePref(tokenKey(userId));
  if (!token || !isPushOn(userId)) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const gaveUp = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SIGN_OUT_WAIT_MS);
  });
  try {
    await Promise.race([unregisterPushToken(token, userId).then(() => undefined), gaveUp]);
  } catch {
    // The server stops sending to a phone it has not heard from, and the token moves to whoever registers it next.
  } finally {
    clearTimeout(timer);
  }
}
