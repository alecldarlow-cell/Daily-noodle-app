/**
 * The native half of the Tangle differential replay: the engine run on a fake clock
 * exactly as the page's fake clock runs it (scripts/replay-tangle.js). Timers fire in
 * time order (ties in the order they were set), the 100 ms tick runs from the page's
 * load, pointer events arrive with the page's own tile rectangles and points, and
 * leaving the page saves (pagehide) and opens a new engine, as a reload does.
 */
import { createSaveStore, londonDay, type KV } from '@noodle/core';

import { noteText, sheetInfo } from './finishing';
import {
  boardTop,
  createTangle,
  current,
  foundList,
  homeCard,
  KEY,
  result,
  type Rect,
  type TangleData,
  type TangleEngine,
} from './model';
import { LOAD_MS, type Scenario } from './oracle';

interface Timer {
  at: number;
  seq: number;
  fn: () => void;
  every: number;
  dead: boolean;
}

/** A fake clock with timers: setTimeout, setInterval and running to an instant. */
export class FakeClock {
  private timers: Timer[] = [];
  private seq = 0;
  constructor(public now: number) {}
  setTimeout = (fn: () => void, ms: number): Timer => this.add(fn, ms, 0);
  setInterval = (fn: () => void, ms: number): Timer => this.add(fn, ms, ms);
  clearTimeout = (t: unknown) => {
    if (t) (t as Timer).dead = true;
  };
  private add(fn: () => void, ms: number, every: number): Timer {
    const t = { at: this.now + Math.max(0, ms), seq: this.seq++, fn, every, dead: false };
    this.timers.push(t);
    return t;
  }
  runTo(at: number) {
    for (;;) {
      const live = this.timers.filter((t) => !t.dead && t.at <= at);
      if (!live.length) break;
      live.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const t = live[0]!;
      this.now = t.at;
      if (t.every) t.at += t.every;
      else t.dead = true;
      t.fn();
    }
    this.timers = this.timers.filter((t) => !t.dead);
    this.now = at;
  }
}

export function memoryKV(seed: Record<string, unknown> = {}): KV {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(seed)) m.set(k, JSON.stringify(v));
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

export interface Snapshot {
  view: string;
  home: ReturnType<typeof homeCard> | null;
  play: {
    score: number;
    words: string;
    star: string;
    clock: string;
    low: boolean;
    list: string;
    cur: string;
    tiles: string;
    toast: string;
    count: string;
    hide: boolean;
    veil: boolean;
  } | null;
  save: unknown;
}

export function snapshot(e: TangleEngine, kv: KV, today: string): Snapshot {
  const s = e.s;
  const R = s.R;
  const playing = !!R && R.state === 'playing';
  const top = boardTop(e);
  const cur = current(e);
  return {
    view: s.view,
    home: s.view === 'home' ? homeCard(e, today) : null,
    play:
      s.view === 'play'
        ? {
            score: top.score,
            words: top.words,
            star: top.star,
            clock: top.clock,
            low: top.low,
            list: foundList(e)
              .map(
                (g) =>
                  `${g.label}/${g.count}:` +
                  g.words
                    .map(
                      (w) =>
                        w.w + (w.star ? '★' : '') + (w.bonus ? '~' : '') + (w.fresh ? '+' : ''),
                    )
                    .join(','),
              )
              .join(' | '),
            cur: `${cur.text}${cur.idle ? '|idle' : ''}`,
            tiles: Array.from({ length: 16 }, (_, i) =>
              s.path.includes(i) ? (s.path[s.path.length - 1] === i ? 'L' : 'o') : '.',
            ).join(''),
            toast: `${s.toast.text}|${s.toast.cls}`,
            count: s.counting ? s.count : '',
            hide: s.counting || (s.paused && playing),
            veil: s.paused && playing,
          }
        : null,
    save: JSON.parse(kv.getItem(KEY) || 'null'),
  };
}

export interface Sheet {
  kick: string;
  title: string;
  hero: string;
  note: string;
  share: string;
  stats: string[];
  time: string;
  star: string;
  meter: string;
  lists: string[];
  rare: string;
}

export interface Simulation {
  snaps: Snapshot[];
  ends: Record<string, unknown>[];
  sheet: Sheet | null;
  reopened: Sheet | null;
}

export function sheetOf(e: TangleEngine, today: string): Sheet {
  const f = sheetInfo(e, today);
  const res = result(e, today);
  const r = f.recap;
  return {
    kick: f.kick,
    title: f.title,
    hero: `${f.hero.score}${f.hero.word}`,
    note: noteText(f.note),
    share: f.share,
    stats: f.stats.map((x) => String(x.value)),
    time: res.time,
    star: res.star,
    meter: `${r.meter}|${r.points}|${r.pct}`,
    lists: r.lists.map(
      (g) =>
        `${g.label}/${g.count}:` +
        g.words.map((w) => `${w.w}${w.pts}${w.got ? '' : '-'}${w.star ? '★' : ''}`).join(','),
    ),
    rare: `${r.rare}|${r.rareList}`,
  };
}

/** One pointer move of the replay: the tiles' rectangles and the points touched. */
export interface Gesture {
  rects: Rect[];
  /** [x, y] of the press, each move, and where it lifts. */
  points: [number, number][];
}

/** Play `sc`; `gestures` are the page's, one per trace or tap, in order. */
export function simulate(data: TangleData, sc: Scenario, gestures: Gesture[]): Simulation {
  const kv = memoryKV(sc.seed);
  const clock = new FakeClock(sc.open);
  const saves = createSaveStore(kv, { now: () => clock.now });
  const ends: Record<string, unknown>[] = [];
  let tick: unknown = null;
  let rects: Rect[] = [];
  const boot = () => {
    const e = createTangle(data, {
      saves,
      read: () => kv.getItem(KEY),
      now: () => clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      rects: () => rects,
      ended: () => ends.push(sheetInfo(e, londonDay(clock.now)).detail),
    });
    clock.clearTimeout(tick);
    tick = clock.setInterval(() => e.tick(), 100);
    return e;
  };
  let e = boot();
  let at = sc.open + LOAD_MS;
  clock.runTo(at);
  let g = 0;
  const snaps: Snapshot[] = [];
  const press = () => {
    const gs = gestures[g++];
    if (!gs) throw new Error('simulate: the replay gave fewer gestures than the moves need');
    rects = gs.rects;
    const [first, ...rest] = gs.points;
    e.down(first![0], first![1]);
    for (const p of rest) e.move([p]);
    e.up();
  };
  for (const step of sc.steps) {
    const m = step.move;
    if (m.t === 'play') e.playCard();
    else if (m.t === 'home') e.home();
    else if (m.t === 'trace' || m.t === 'tap') press();
    else if (m.t === 'leave') {
      e.leave();
      e = boot();
    }
    at += step.ms;
    clock.runTo(at);
    snaps.push(snapshot(e, kv, londonDay(clock.now)));
  }
  const day = londonDay(clock.now);
  const sheet = e.s.view === 'winModal' ? sheetOf(e, day) : null;
  let reopened: Sheet | null = null;
  if (sc.reopen) {
    e.leave();
    e = boot();
    reopened = e.s.view === 'winModal' ? sheetOf(e, day) : null;
  }
  return { snaps, ends, sheet, reopened };
}
