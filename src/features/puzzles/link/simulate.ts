/**
 * The native half of the differential replay: plays a scenario's moves through the
 * model on a fake clock, as the screen does on a real one, and reports the board after
 * every move and the finish in the shape `scripts/replay-link.js` reads from the page.
 *
 * The clock follows the page's: it starts on Play (or the first tile), shows whole
 * seconds since then, and stops on the landing of the fourth group or on the fourth
 * mistake. A right four lands SETTLE_MS after Submit (at once with reduced motion);
 * after the fourth mistake the rest are laid out one group every 420 ms from 420 ms
 * on (all at 420 ms with reduced motion), and the result is saved at that moment.
 * The sheet rises 1.2 s after a win (0.5 s after a loss; at once with reduced motion).
 */
import { createSaveStore, dnNum, type KV } from '@noodle/core';

import { streakLine } from '@/shared/finish-sheet/rules';

import { commitFinish, isRanked, reopenInfo, type FinishInfo } from './finishing';
import {
  afterFinish,
  allTiles,
  apply,
  disabled,
  init,
  REVEAL_STEP_MS,
  roundToKeep,
  SAVE_KEY,
  SETTLE_MS,
  showsShare,
  STREAK_KEY,
  timerText,
  type LinkData,
  type LinkState,
  withRound,
} from './model';
import { realMove, type Scenario } from './oracle';

export interface Snapshot {
  /** Solved groups' ranks in the order found. */
  bands: string;
  /** The board in order, a held tile marked *. */
  tiles: string;
  pips: number;
  msg: string;
  timer: string;
  rank: string;
  /** Share result in place of Shuffle / Deselect / Submit. */
  share: boolean;
  /** The disabled controls. */
  off: string;
  sheet: boolean;
}

export function snapshot(s: LinkState, timer: string, sheet: boolean): Snapshot {
  // Hidden controls (Share result in their place) keep whatever disabled state the last
  // render gave them, which no one sees: compared only while they show.
  const d = showsShare(s) ? { submit: false, clear: false, shuffle: false } : disabled(s);
  return {
    bands: s.solved.map((i) => s.p.groups[i]!.rank).join(' '),
    tiles: s.live.map((w) => w + (s.sel.includes(w) ? '*' : '')).join(' '),
    pips: s.mistakes,
    msg: `${s.msg.text}|${s.msg.tone}`,
    // the bar's clock the house way ("0:15"), as #timer shows it since 29 Oct 2026
    timer: timer.replace(/^0+(\d)/, '$1'),
    rank: s.label ? '· replay' : '',
    share: showsShare(s),
    off: (['submit', 'clear', 'shuffle'] as const).filter((k) => d[k]).join(' '),
    sheet,
  };
}

/** A finish sheet as the replay compares it with the page. */
export interface Sheet {
  share: string;
  note: string;
  title: string;
  kick: string;
  /** The guess squares: "g1 x g2 …". */
  hero: string;
  /** The model's three numbers (kept as a check; the sheet shows only `streakLine` since AF-019). */
  stats: string[];
  /** "🔥 5-day streak", the sheet's line under the score. */
  streakLine: string;
  /** "Play again (not recorded)" under a lost result. */
  again: boolean;
}

/** The saves after the last move, every puzzle_end, and each sheet in the order shown. */
export interface Outcome {
  save: unknown;
  streak: unknown;
  ends: Record<string, unknown>[];
  sheets: Sheet[];
}

export interface Simulation {
  snaps: Snapshot[];
  final: Outcome;
  reopened: Omit<Sheet, 'kick'> | null;
}

export function memoryKV(
  seed: Record<string, unknown> = {},
): KV & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(seed)) m.set(k, JSON.stringify(v));
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    dump: () => Object.fromEntries(m),
  };
}

export const heroCode = (squares: number[]) => squares.map((r) => (r ? `g${r}` : 'x')).join(' ');
const statsOf = (f: FinishInfo) => [f.time, String(f.streak), String(f.best)];
/** The sheet's line under the score (finish.js streakLine, AF-019): the day streak. */
const line = (n: number) => streakLine([{ value: n, label: 'day streak' }]);
const sheetOf = (f: FinishInfo, kick: string): Sheet => ({
  share: f.share,
  note: f.note,
  title: f.title,
  kick,
  hero: heroCode(f.squares),
  stats: statsOf(f),
  streakLine: line(f.streak),
  again: !f.won,
});

/**
 * Play `sc` from instant `t0` (the moment of the first move). `deals` are the page's
 * boards: the first deal, then one per Shuffle or Play again, in order (a test may
 * give a function of the tiles to deal instead). `opened` is
 * the instant the page loaded (when it read the streak to decide on a replay).
 */
export function simulate(
  data: LinkData,
  sc: Scenario,
  t0: number,
  date: string,
  deals: (string[] | ((live: string[]) => string[]))[],
  opened: number = t0,
): Simulation {
  const kv = memoryKV(sc.seed);
  let now = t0;
  const saves = createSaveStore(kv, { now: () => now });
  let k = 0;
  const deal = (live: string[]) => {
    const d = deals[k++];
    if (!d) throw new Error('simulate: the replay gave fewer deals than the moves need');
    return typeof d === 'function' ? d(live) : d;
  };
  let state = init(data, deal(allTiles(data)), { ranked: isRanked(kv, opened), rec: null });
  let clockAt: number | null = null;
  let frozen = 0;
  const secsAt = (at: number) =>
    state.timer === 'running' && clockAt !== null
      ? Math.floor((at - clockAt) / 1000)
      : state.timer === 'idle'
        ? 0
        : frozen;
  const shown = (at: number) => timerText(secsAt(at));
  // The round kept in digi-link-v1 › cur, as the page's curSave / curClear write it.
  let dirty = false;
  const writeRound = (c: Parameters<typeof withRound>[1]) => {
    const next = withRound(kv.getItem(SAVE_KEY), c);
    if (next !== null) kv.setItem(SAVE_KEY, next);
  };
  const keep = (at: number) => {
    const c = roundToKeep(state, secsAt(at), at, dirty);
    if (c) writeRound(c);
  };
  const track = (before: LinkState, at: number) => {
    if (
      state.timer === 'running' &&
      (before.timer !== 'running' || state.replayStarted !== before.replayStarted)
    )
      clockAt = at;
    if (state.timer === 'stopped' && before.timer === 'running')
      frozen = Math.floor((at - (clockAt ?? at)) / 1000);
    if (state.timer === 'idle') frozen = 0;
  };
  const ends: Record<string, unknown>[] = [];
  const sheets: Sheet[] = [];
  const kick = `Link ${dnNum(data.id).slice(1)}`;
  let info: FinishInfo | null = null;
  let sheetAt = Infinity;
  const finishNow = (at: number) => {
    const saved = now;
    now = at;
    const f = commitFinish(state, shown(at), saves, kv, at);
    now = saved;
    if (f.first) ends.push(f.detail);
    writeRound(null);
    state = afterFinish(state, f);
    info = f;
    sheets.push(sheetOf(f, kick));
    sheetAt = at + (sc.reduced ? 0 : f.won ? 1200 : 500);
  };
  const snaps: Snapshot[] = [];
  for (const step of sc.steps) {
    const m = step.move;
    const real = realMove(
      m,
      m.t === 'shuffle' ? deal(state.live) : m.t === 'again' ? deal(allTiles(data)) : [],
    );
    let before = state;
    state = apply(state, real);
    track(before, now);
    if (m.t === 'again') {
      sheetAt = Infinity;
      dirty = false;
    }
    const guessed = state.guesses.length > before.guesses.length;
    if (guessed) dirty = true;
    if (guessed && !state.settling) {
      if (state.over) writeRound(null);
      else keep(now);
    }
    if (state.settling) {
      const at = now + (sc.reduced ? 0 : SETTLE_MS);
      before = state;
      state = apply(state, { t: 'land' });
      track(before, at);
      if (state.over) finishNow(at);
      else keep(at);
    } else if (state.revealing) {
      const rest = 4 - state.solved.length;
      const at = now + REVEAL_STEP_MS + (sc.reduced ? 0 : REVEAL_STEP_MS * rest);
      state = apply(state, { t: 'revealed' });
      finishNow(at);
    }
    now += step.ms;
    snaps.push(snapshot(state, shown(now), now >= sheetAt));
  }
  if (!info) throw new Error(`simulate: ${sc.variant} never finished ${data.id}`);
  const final: Outcome = {
    save: JSON.parse(kv.getItem(SAVE_KEY) || 'null'),
    streak: JSON.parse(kv.getItem(STREAK_KEY) || 'null'),
    ends,
    sheets,
  };
  let reopened: Simulation['reopened'] = null;
  if (sc.reopen) {
    const { kick: _k, ...r } = sheetOf(
      reopenInfo(state.p, saves.getDone(SAVE_KEY, data.id)!, kv),
      kick,
    );
    reopened = r;
  }
  return { snaps, final, reopened };
}
