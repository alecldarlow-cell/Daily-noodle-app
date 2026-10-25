import type { SaveStore } from '@noodle/core';

import type { CachedStorage } from '@/shared/storage';

import { BRIDGED_KEY, ID_KEY } from './injection';

export type BridgeMessage =
  | { t: 'save'; key: string; value: string; id: string }
  | { t: 'share'; text: string; url: string }
  | { t: 'end'; detail: Record<string, unknown> }
  | { t: 'id'; key: string; value: string | null };

/** A message from the page, or null if it isn't one the bridge sent. */
export function parseMessage(raw: string): BridgeMessage | null {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  const x = m as Record<string, unknown>;
  if (
    x.t === 'save' &&
    typeof x.key === 'string' &&
    typeof x.value === 'string' &&
    BRIDGED_KEY.test(x.key)
  )
    return { t: 'save', key: x.key, value: x.value, id: typeof x.id === 'string' ? x.id : '' };
  if (x.t === 'share' && typeof x.text === 'string')
    return { t: 'share', text: x.text, url: typeof x.url === 'string' ? x.url : '' };
  if (
    x.t === 'id' &&
    typeof x.key === 'string' &&
    ID_KEY.test(x.key) &&
    (typeof x.value === 'string' || x.value === null)
  )
    return { t: 'id', key: x.key, value: x.value };
  if (x.t === 'end' && x.detail && typeof x.detail === 'object' && !Array.isArray(x.detail))
    return { t: 'end', detail: x.detail as Record<string, unknown> };
  return null;
}

/**
 * Take a save the page just wrote. Result documents (`-v1`) merge with the app's by
 * @noodle/core's rules: a result the app already holds is kept (it was committed
 * first), new results and the page's other fields come in. Streak documents are the
 * page's newest word on that streak, which began from the app's copy, so they replace it.
 */
export function applySave(
  key: string,
  value: string,
  store: CachedStorage,
  saves: SaveStore,
  activeId?: string,
): void {
  if (!BRIDGED_KEY.test(key)) return;
  let doc: unknown;
  try {
    doc = JSON.parse(value);
  } catch {
    return;
  }
  if (key.endsWith('-streak')) {
    if (doc && typeof doc === 'object') store.setItem(key, value);
    return;
  }
  if (!doc || typeof doc !== 'object' || (doc as { v?: unknown }).v !== 1) return;
  saves.saveProgress(key, doc as Record<string, unknown>, activeId, false);
}

/**
 * Take a tracker key the page wrote or removed (null). The privacy page's switch sets
 * digi.optout and removes the codes; while opted out, no code is taken in. Removed keys
 * are kept as '' (the app's storage has no delete); '' counts as absent everywhere.
 */
export function applyId(key: string, value: string | null, store: CachedStorage): void {
  if (!ID_KEY.test(key)) return;
  if (key === 'digi.optout') {
    store.setItem(key, value ?? '');
    if (value === '1') for (const k of ['digi.aid', 'digi.sid', 'digi.last']) store.setItem(k, '');
    return;
  }
  if (value !== null && store.getItem('digi.optout') === '1') return;
  store.setItem(key, value ?? '');
}

/** The app's current puzzle saves and tracker keys, to seed a page with. */
export function seedFrom(store: CachedStorage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of store.keys()) {
    const v = store.getItem(k);
    if (v !== null && (BRIDGED_KEY.test(k) || (ID_KEY.test(k) && v !== ''))) out[k] = v;
  }
  return out;
}
