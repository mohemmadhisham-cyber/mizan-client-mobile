import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { readDevicePref, writeDevicePref } from '@/lib/device-prefs';
import { forgetPushToken, registerPushToken, type PushPlatform } from '@/services/push-tokens';

/**
 * Notifications on the phone: a person turns them on in Settings, per phone.
 * The phone then has a push address ("token"), which the app gives to the
 * server so that it can send this person's notifications here, and takes back
 * when they turn it off or stop being signed in.
 *
 * A push shows only a short title. Tapping one opens the app's own list of
 * notifications; nothing in a push is ever followed as a link.
 *
 * The phone may be shared or passed on, so the rule this file keeps is: once
 * a person is no longer signed in on this phone, however that came about, the
 * phone comes off the server's list. A token to be taken off is written down
 * on the device first, and tried again until the server has heard.
 *
 * Everything that talks to the server runs one at a time, in the order it was
 * asked for, so that an "on" never lands after the "off" that followed it.
 */

const ON = 'on';
const OFF = 'off';
const choiceKey = (userId: string) => `push.${userId}`;
const tokenKey = (userId: string) => `push_token.${userId}`;
/** Tokens the server has still to be told to forget, one to a line. */
const PENDING_KEY = 'push_forget_pending';
const PENDING_MAX = 5;
const ANDROID_CHANNEL = 'default';

const pushPlatform = (): PushPlatform | null => (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null);

// ------------------------------------------------------------------ one at a time

let queue: Promise<unknown> = Promise.resolve();

/** Runs `work` after everything asked for before it, whether that worked or not. */
function inTurn<T>(work: () => Promise<T>): Promise<T> {
  const mine = queue.then(work, work);
  queue = mine.catch(() => {});
  return mine;
}

// ------------------------------------------------------------------ what is kept on the device

export function isPushOn(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return readDevicePref(choiceKey(userId)) === ON;
}

const storedToken = (userId: string): string | null => readDevicePref(tokenKey(userId)) || null;

const pendingTokens = (): string[] => (readDevicePref(PENDING_KEY) ?? '').split('\n').filter(Boolean);

const writePending = (tokens: string[]): Promise<boolean> => writeDevicePref(PENDING_KEY, tokens.slice(-PENDING_MAX).join('\n'));

async function addPending(token: string): Promise<void> {
  const now = pendingTokens();
  if (!now.includes(token)) await writePending([...now, token]);
}

async function removePending(token: string): Promise<void> {
  const now = pendingTokens();
  if (now.includes(token)) await writePending(now.filter((kept) => kept !== token));
}

// ------------------------------------------------------------------ the phone

/** Whether the phone lets this app show notifications. `ask` puts the phone's own question to the person if it can still be asked. */
async function allowed(ask: boolean): Promise<boolean> {
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (!ask || !now.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

type PhoneToken =
  | { kind: 'ok'; token: string }
  /** This build has no push set up. */
  | { kind: 'none' }
  /** The phone could not get one just now (no connection, the push service not answering). */
  | { kind: 'error' };

async function phoneToken(): Promise<PhoneToken> {
  const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !projectId) return { kind: 'none' };
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return token ? { kind: 'ok', token } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

// ------------------------------------------------------------------ taking a phone off the list

/**
 * Tells the server to forget a token. It is written down first, so a try
 * that does not get through is made again later. True once the server has heard.
 */
async function forget(token: string): Promise<boolean> {
  await addPending(token);
  if ((await forgetPushToken(token)) !== 'saved') return false;
  await removePending(token);
  return true;
}

async function flush(): Promise<void> {
  for (const token of pendingTokens()) await forget(token);
}

/**
 * Tries again to take off the list any phone token the server has not yet
 * been told to forget. Called when the app starts, comes back into view, or
 * finds nobody signed in. Needs no session. Never throws.
 */
export function flushForgottenPush(): Promise<void> {
  if (!pushPlatform()) return Promise.resolve();
  return inTurn(flush).catch(() => {});
}

// ------------------------------------------------------------------ on, off, and keeping it so

/** Who is signed in right now, for the choice of whether to show a notification that arrives while the app is open. */
let viewer: string | null = null;

export function setPushViewer(userId: string | null): void {
  viewer = userId;
}

/**
 * Once, when the app starts: a notification that arrives while the app is
 * open is shown as a banner and in the phone's list, quietly. With nobody
 * signed in it is not shown at all.
 */
export function configurePushHandling(): void {
  if (!pushPlatform()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: viewer !== null,
      shouldShowList: viewer !== null,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Whether notifications are on for this person AND the phone still allows them. Never throws. */
export async function isPushWorking(userId: string | null | undefined): Promise<boolean> {
  if (!pushPlatform() || !isPushOn(userId)) return false;
  try {
    return await allowed(false);
  } catch {
    return false;
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
export function turnPushOn(userId: string, channelName: string): Promise<PushTurnOn> {
  const platform = pushPlatform();
  if (!platform) return Promise.resolve('unavailable');
  return inTurn(async (): Promise<PushTurnOn> => {
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
    const phone = await phoneToken();
    if (phone.kind === 'none') return 'unavailable';
    if (phone.kind === 'error') return 'failed';
    const saved = await registerPushToken(phone.token, platform, userId);
    if (saved === 'not_offered') return 'unavailable';
    if (saved === 'failed') return 'failed';
    // It is this person's now: an older note to forget this token must not undo that.
    await removePending(phone.token);
    const kept = (await writeDevicePref(tokenKey(userId), phone.token)) && (await writeDevicePref(choiceKey(userId), ON));
    if (kept) return 'on';
    // The phone could not keep the choice. The server is told to forget, so the two do not disagree.
    await forget(phone.token);
    return 'failed';
  }).catch((): PushTurnOn => 'failed');
}

/**
 * Turns them off. The server is told first: only it can stop a push from
 * arriving, so "off" is not shown until it has heard. Resolves to false when
 * it could not be told. Never throws.
 */
export function turnPushOff(userId: string): Promise<boolean> {
  return inTurn(async () => {
    const token = storedToken(userId);
    if (token && !(await forget(token))) return false;
    if (!(await writeDevicePref(choiceKey(userId), OFF))) return false;
    await writeDevicePref(tokenKey(userId), '');
    return true;
  }).catch(() => false);
}

/**
 * When the app starts, or a person signs in: first anything still to be
 * forgotten is forgotten. Then, with notifications on, the phone is put on the
 * server's list again. That keeps the list fresh (the server stops sending to
 * a phone it has not heard from for a long time), puts back a phone taken off
 * at sign-out, and follows a token the phone has changed. The phone's own
 * question is not asked here. Never throws.
 */
export function refreshPush(userId: string, isCurrent: () => boolean = () => true): Promise<void> {
  const platform = pushPlatform();
  if (!platform) return Promise.resolve();
  return inTurn(async () => {
    await flush();
    if (!isPushOn(userId) || !(await allowed(false))) return;
    const phone = await phoneToken();
    // Asked again here: the person may have turned it off, or signed out, while the phone was being asked.
    if (phone.kind !== 'ok' || !isCurrent() || !isPushOn(userId)) return;
    if ((await registerPushToken(phone.token, platform, userId)) !== 'saved') return;
    await removePending(phone.token);
    const before = storedToken(userId);
    if (before === phone.token) return;
    if (!(await writeDevicePref(tokenKey(userId), phone.token))) {
      // The phone cannot remember this token, so it could not take it off at sign-out. It comes off now.
      await forget(phone.token);
      return;
    }
    // The phone changed its token. The old one leads nowhere good.
    if (before) await forget(before);
  }).catch(() => {});
}

/**
 * This person is no longer signed in on this phone: they signed out, signed
 * out everywhere, or the session ended on its own. The phone comes off the
 * server's list, so the next person to use it is not shown this person's
 * notifications, and the ones already on screen are cleared.
 *
 * It needs no session, so it works after the session has gone. The token is
 * written down as "to be forgotten" before the server is asked, so it is
 * tried again later if the server cannot be reached now. The person's choice
 * is kept: signing in again on this phone puts it back. Safe to call more
 * than once. Never throws.
 */
export async function forgetPushWhenSignedOut(userId: string): Promise<void> {
  if (!pushPlatform()) return;
  const token = storedToken(userId);
  if (!token) return;
  try {
    await addPending(token);
    await writeDevicePref(tokenKey(userId), '');
    void Notifications.dismissAllNotificationsAsync().catch(() => {});
    await inTurn(flush);
  } catch {
    // Still written down: the next start, or the next time the app comes into view, tries again.
  }
}
