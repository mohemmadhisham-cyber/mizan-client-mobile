import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * A Supabase-compatible storage adapter backed by the OS secure enclave.
 *
 * expo-secure-store caps each value at ~2048 bytes and only allows keys
 * matching [A-Za-z0-9._-]. A Supabase auth session exceeds that limit, so we
 * transparently chunk large values across multiple SecureStore entries and
 * track the chunk count in a sidecar meta entry.
 *
 * On web (Expo web preview) SecureStore is unavailable, so we fall back to
 * localStorage. Native (iOS/Android) is the real target and uses the enclave.
 */

const CHUNK_SIZE = 2000;
const META_SUFFIX = '__meta';
const isWeb = Platform.OS === 'web';

interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Returns localStorage only when it's actually usable. During web static
// rendering (Node), a partial/absent localStorage would otherwise throw.
function webStorage(): WebStorageLike | null {
  const ls = (globalThis as { localStorage?: WebStorageLike }).localStorage;
  return ls && typeof ls.getItem === 'function' ? ls : null;
}

function baseKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function readMeta(k: string): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(`${k}${META_SUFFIX}`);
  if (raw == null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

async function nativeGet(key: string): Promise<string | null> {
  const k = baseKey(key);
  const count = await readMeta(k);
  if (count == null) return SecureStore.getItemAsync(k); // legacy single value
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(`${k}__${i}`);
    if (part == null) return null; // partial/corrupted — treat as absent
    parts.push(part);
  }
  return parts.join('');
}

async function nativeRemove(key: string): Promise<void> {
  const k = baseKey(key);
  const count = await readMeta(k);
  if (count != null) {
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(`${k}__${i}`);
    }
    await SecureStore.deleteItemAsync(`${k}${META_SUFFIX}`);
  }
  await SecureStore.deleteItemAsync(k);
}

async function nativeSet(key: string, value: string): Promise<void> {
  await nativeRemove(key); // clear any prior (possibly larger) value first
  const k = baseKey(key);
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }
  for (let i = 0; i < chunks.length; i += 1) {
    await SecureStore.setItemAsync(`${k}__${i}`, chunks[i]);
  }
  await SecureStore.setItemAsync(`${k}${META_SUFFIX}`, String(chunks.length));
}

export const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) return webStorage()?.getItem(key) ?? null;
    return nativeGet(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      webStorage()?.setItem(key, value);
      return;
    }
    await nativeSet(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      webStorage()?.removeItem(key);
      return;
    }
    await nativeRemove(key);
  },
};
