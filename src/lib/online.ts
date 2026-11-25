import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * Whether the phone has a connection at all.
 *
 * Only "no network" counts as offline. The library can also probe whether the
 * internet is reachable, by calling an outside address; on a network that
 * blocks that address the probe says "unreachable" while everything works.
 * Acting on it would show a false notice and stop the app asking the server,
 * so it is not used. "Not known yet" (the first moments after launch) is
 * treated as online, so the notice never flashes at start.
 */
export function isOffline(state: { isConnected: boolean | null }): boolean {
  return state.isConnected === false;
}

/** True while the phone has no connection. */
export function useIsOffline(): boolean {
  return isOffline(useNetInfo());
}

/**
 * Tells the data layer when the phone is offline, so it waits instead of
 * failing every request, and asks again when the connection returns. Call once.
 */
export function wireOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(!isOffline(state))));
}
