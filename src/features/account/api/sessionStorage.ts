import * as SecureStore from 'expo-secure-store';

/**
 * Where the sign-in session lives: the phone's secure store (Keychain / Keystore).
 * Values there should stay under about 2 KB, and a Supabase session can be larger,
 * so each value is split into chunks under one index key.
 */
export interface SecureBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

const CHUNK = 1800;
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export function chunkedStorage(backend: SecureBackend = SecureStore) {
  return {
    async getItem(key: string): Promise<string | null> {
      const k = safe(key);
      const n = Number(await backend.getItemAsync(`${k}.n`));
      if (!n) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const p = await backend.getItemAsync(`${k}.${i}`);
        if (p === null) return null;
        parts.push(p);
      }
      return parts.join('');
    },
    async setItem(key: string, value: string): Promise<void> {
      const k = safe(key);
      const old = Number(await backend.getItemAsync(`${k}.n`)) || 0;
      const n = Math.max(1, Math.ceil(value.length / CHUNK));
      for (let i = 0; i < n; i++)
        await backend.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
      await backend.setItemAsync(`${k}.n`, String(n));
      for (let i = n; i < old; i++) await backend.deleteItemAsync(`${k}.${i}`);
    },
    async removeItem(key: string): Promise<void> {
      const k = safe(key);
      const n = Number(await backend.getItemAsync(`${k}.n`)) || 0;
      for (let i = 0; i < n; i++) await backend.deleteItemAsync(`${k}.${i}`);
      await backend.deleteItemAsync(`${k}.n`);
    },
  };
}
