/**
 * Hide (8 Nov 2026, Google Play's user-generated content policy): players this install has
 * hidden, per league, by nickname, in the website's shape and key (board.html
 * `noodle-board-hidden-v1` = {code: [nickname, …]}). Kept on this phone only (not synced);
 * only this phone's boards change. A renamed player shows again.
 */
import { appStorage, useStoredRaw } from '@/shared/storage';

export const HIDE_KEY = 'noodle-board-hidden-v1';

type HiddenDoc = Record<string, string[]>;

export function readHidden(raw: string | null): HiddenDoc {
  try {
    const d = JSON.parse(raw ?? '{}') as unknown;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
    const out: HiddenDoc = {};
    for (const [k, v] of Object.entries(d as Record<string, unknown>))
      if (Array.isArray(v)) out[k] = v.filter((n): n is string => typeof n === 'string');
    return out;
  } catch {
    return {};
  }
}

/** The doc with `nick` hidden (`on`) or shown again in league `code`. */
export function withHidden(doc: HiddenDoc, code: string, nick: string, on: boolean): HiddenDoc {
  const list = (doc[code] ?? []).filter((n) => n !== nick);
  if (on) list.push(nick);
  const out = { ...doc };
  if (list.length) out[code] = list;
  else delete out[code];
  return out;
}

/**
 * A board's data without hidden players' rows: every list of `{nick}` rows (ranked,
 * unranked, not played yet, the All board's day and week, Records' players) loses them;
 * your own row always stays; lists of plain names (the roster) are kept.
 */
export function unhide<T>(d: T, hidden: readonly string[]): T {
  if (!hidden.length || !d || typeof d !== 'object') return d;
  const out: Record<string, unknown> = { ...(d as Record<string, unknown>) };
  for (const [k, v] of Object.entries(out)) {
    if (Array.isArray(v))
      out[k] = v.filter(
        (r) =>
          !(
            r &&
            typeof r === 'object' &&
            !(r as { me?: boolean }).me &&
            hidden.includes((r as { nick?: string }).nick ?? '')
          ),
      );
  }
  return out as T;
}

/** This league's hidden players and a setter. */
export function useHidden(code: string) {
  const doc = readHidden(useStoredRaw(HIDE_KEY));
  const list = doc[code] ?? [];
  const set = (nick: string, on: boolean) =>
    appStorage.setItem(
      HIDE_KEY,
      JSON.stringify(withHidden(readHidden(appStorage.getItem(HIDE_KEY)), code, nick, on)),
    );
  return { list, set };
}
