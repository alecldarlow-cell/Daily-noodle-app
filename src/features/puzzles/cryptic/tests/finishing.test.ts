import type { KV, SaveStore } from '@noodle/core';

import { commitFinish, reopenInfo, restoreCur, saveCur, shareCryptic } from '../finishing';
import { apply, init, SAVE_KEY, STREAK_KEY, type CrypticData, type Move } from '../model';
import answers from './answers.json';
import pages from './pages.json';

const P = (pages as unknown as { data: CrypticData }[])[0]!.data;
const A = (answers as Record<string, string>)[P.id]!;
const DAY = Date.parse('2026-11-21T12:00:00Z');

function kv(): KV {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as unknown as KV;
}
function store(k: KV): SaveStore {
  return {
    getDone: (key: string, id: string) => {
      const s = JSON.parse(k.getItem(key) || 'null') as {
        done?: Record<string, Record<string, unknown>>;
      } | null;
      return s?.done?.[id] ?? null;
    },
    putDone: (key: string, id: string, rec: Record<string, unknown>) => {
      const s = (JSON.parse(k.getItem(key) || 'null') as Record<string, unknown> | null) ?? {
        v: 1,
      };
      s.done = { ...((s.done as object) ?? {}), [id]: { ...rec, d: '2026-11-21' } };
      k.setItem(key, JSON.stringify(s));
      return rec;
    },
    saveStreak: (key: string, v: unknown) => k.setItem(key, JSON.stringify(v)),
  } as never;
}

describe('GIVEN a Cryptic part-played', () => {
  it('WHEN kept and reopened THEN letters, hints and time come back in the page’s shape', () => {
    const k = kv();
    const s = [{ t: 'hint' }, { t: 'hint' }, { t: 'hint' }, { t: 'type', ch: 'Q' }].reduce(
      (x, m) => apply(x, m as Move),
      init(P),
    );
    saveCur(k, s, 41.4, store(k), DAY);
    const cur = JSON.parse(k.getItem(SAVE_KEY)!).cur;
    expect(cur).toEqual({
      id: P.id,
      letters: [A[0], 'Q', '', '', '', '', ''],
      hints: 3,
      s: 41,
      at: DAY,
    });
    const back = restoreCur(k, P)!;
    expect(back.secs).toBe(41);
    expect(back.state.hints).toBe(3);
    expect(back.state.letters.slice(0, 2)).toEqual([A[0], 'Q']);
    expect(back.state.cur).toBe(2);
    expect(back.state.msg).toBe('Carrying on where you left off.');
  });
  it('WHEN the website kept a broken or other clue THEN nothing is restored', () => {
    const k = kv();
    k.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, cur: { id: 'DP·CRYP·0002', letters: [], hints: 1 } }),
    );
    expect(restoreCur(k, P)).toBeNull();
  });
});

describe('GIVEN another clue part-played (one round per puzzle, 22 Nov 2026)', () => {
  it('WHEN this clue is played, reopened and solved THEN the other clue’s round is kept throughout', () => {
    const k = kv();
    const sv = store(k);
    const other = { id: 'DP·CRYP·0002', letters: ['Z'], hints: 1, s: 5, at: 1 };
    k.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, done: {}, rounds: { [other.id]: other }, cur: other }),
    );
    let s = apply(init(P), { t: 'hint' });
    saveCur(k, s, 10, sv, DAY);
    const kept = JSON.parse(k.getItem(SAVE_KEY)!);
    expect(Object.keys(kept.rounds).sort()).toEqual([other.id, P.id].sort());
    expect(kept.cur.id).toBe(P.id);
    expect(restoreCur(k, P)!.state.hints).toBe(1);
    s = [...A].reduce((x, ch) => apply(x, { t: 'type', ch }), s);
    s = apply(s, { t: 'enter' });
    commitFinish(s, 30, false, sv, k, DAY);
    const after = JSON.parse(k.getItem(SAVE_KEY)!);
    expect(after.rounds).toEqual({ [other.id]: other });
    expect(after.done[P.id]).toBeDefined();
  });
});

describe('GIVEN a Cryptic solved with one hint', () => {
  it('THEN the result is saved as the page saves it, the streak bumps, and the share line reads as the website’s', () => {
    const k = kv();
    const sv = store(k);
    let s = apply(init(P), { t: 'hint' });
    saveCur(k, s, 10, sv, DAY);
    s = [...A].reduce((x, ch) => apply(x, { t: 'type', ch }), s);
    s = apply(s, { t: 'enter' });
    const f = commitFinish(s, 48.2, false, sv, k, DAY);
    expect(JSON.parse(k.getItem(SAVE_KEY)!)).toEqual({
      v: 1,
      done: { [P.id]: { t: '0:48', s: 48, h: 1, d: '2026-11-21' } },
    });
    expect(JSON.parse(k.getItem(STREAK_KEY)!)).toMatchObject({ last: '2026-11-21', streak: 1 });
    expect(f.share).toBe('🕵️ Cryptic #1 — 0:48 · 1 hint');
    expect(f.note).toBe('1 hint.');
    expect(f.detail).toEqual({
      type: 'word-cryptic',
      tv: 3,
      outcome: 'solved',
      secs: 48,
      checks: 0,
      reveals: 0,
      hints: 1,
    });
    expect(f.first).toBe(true);
    const again = reopenInfo(P, { t: '0:48', s: 48, h: 1 }, k, DAY);
    expect(again.note).toBe('1 hint.');
    expect(again.hero).toBe('0:48');
  });
  it('THEN a streak of two or more joins the share line', () => {
    expect(shareCryptic('DP·CRYP·0012', '1:05', 0, 3)).toBe(
      '🕵️ Cryptic #12 — 1:05 · no hints · 🔥3',
    );
  });
});
