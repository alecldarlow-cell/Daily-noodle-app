import { londonDay, type KV, type SaveStore } from '@noodle/core';

import type { PuzzleFile } from '../../types';
import { commitFinish, isRanked, reopenInfo, type Finished, type FinishInfo } from '../finishing';
import {
  afterFinish,
  allTiles,
  apply,
  finishing,
  init,
  recordTime,
  resumeRound,
  REVEAL_STEP_MS,
  roundToKeep,
  SAVE_KEY,
  SETTLE_MS,
  shuffle,
  timerText,
  type LinkData,
  type LinkState,
  type Move,
  withRound,
} from '../model';

export type Phase = 'start' | 'play' | 'finished';

/** A board move from the screen; Shuffle and Play again are dealt here. */
export type ScreenMove =
  | Exclude<Move, { t: 'shuffle' } | { t: 'again' } | { t: 'land' } | { t: 'revealed' }>
  | { t: 'shuffle' }
  | { t: 'again' };

export interface GameDeps {
  store: KV;
  saves: SaveStore;
  now: () => number;
  random: () => number;
  /** A first finish, with the tracker's detail. */
  announce: (f: Finished) => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (t: unknown) => void;
}

/**
 * One Link being played, as engines/link.js runs it, outside React: the deal, the
 * clock (from Play, or the first tile if the start card is skipped; stopped on the
 * fourth group's landing or the fourth mistake), the settle and the reveal, the finish
 * (saved, the streak on today's first go only, announced on a first finish), the sheet
 * rising 1.2 s after a win (0.5 s after a loss, at once with reduced motion), and Play
 * again (not recorded) after a loss. A finished Link opens on its sheet.
 *
 * The clock (R10, as engines/link.js since 29 Oct 2026) adds up stretches of play: it
 * stops while the app is away (`away`) and carries on when it's back (`back`), so time
 * away never counts. The unfinished round is kept in `digi-link-v1` › cur, as the page
 * keeps it, after every counted guess and whenever the app goes away; it is cleared at
 * the finish. A Link opened with a kept round shows it paused behind Resume.
 */
export class LinkGame {
  state: LinkState;
  phase: Phase;
  info: FinishInfo | null;
  /** The puzzle's day is before today's (London): an archive Link. Display only. */
  readonly past: boolean;
  /** Milliseconds already played, and when the current stretch began (null: stopped). */
  private acc = 0;
  private clockAt: number | null = null;
  /** The clock was stopped by the app going away, and carries on when it's back. */
  private awayPaused = false;
  /** A guess has been made since the round began (the page's curDirty). */
  private dirty = false;
  /** Opened with a kept round: the start card offers Resume, with this many seconds. */
  readonly resumed: { found: number; secs: number } | null = null;
  /** A reopened puzzle shows its saved time. */
  private shown: string | null;
  private committed: boolean;
  private reduced = false;
  private version = 0;
  private listeners = new Set<() => void>();
  private timers: unknown[] = [];
  private setT: (fn: () => void, ms: number) => unknown;
  private clearT: (t: unknown) => void;

  constructor(
    private file: PuzzleFile<LinkData>,
    private deps: GameDeps,
  ) {
    this.setT = deps.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearT = deps.clearTimeout ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
    const data = file.data;
    const rec = deps.saves.getDone(SAVE_KEY, data.id);
    this.past = !!file.date && file.date < londonDay(deps.now());
    this.state = init(data, shuffle(allTiles(data), deps.random), {
      ranked: isRanked(deps.store, deps.now()),
      rec,
    });
    const restored = this.state.restored && !!rec;
    this.phase = restored ? 'finished' : 'start';
    this.info = restored ? reopenInfo(this.state.p, rec, deps.store) : null;
    this.shown = restored ? recordTime(rec) : null;
    this.committed = this.state.restored;
    if (!restored) {
      const r = resumeRound(this.state, deps.store.getItem(SAVE_KEY), (t) =>
        shuffle(t, deps.random),
      );
      if (r) {
        this.state = r.state;
        this.acc = r.secs * 1000;
        this.dirty = true;
        this.resumed = { found: r.state.solved.length, secs: r.secs };
      }
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getVersion = () => this.version;
  /** Something on screen may have changed (also the clock's own repaint). */
  poke = () => {
    this.version++;
    this.listeners.forEach((fn) => fn());
  };
  setReduced(on: boolean) {
    this.reduced = on;
  }
  dispose() {
    this.timers.forEach((t) => this.clearT(t));
    this.timers = [];
  }

  /** Whole seconds played (the page's secs()). */
  secs(at = this.deps.now()): number {
    return Math.floor((this.acc + (this.clockAt !== null ? at - this.clockAt : 0)) / 1000);
  }

  /** The clock as the page keeps it, "MM:SS" (the saved record's form). */
  clock(at = this.deps.now()): string {
    if (this.shown !== null) return this.shown;
    return timerText(this.secs(at));
  }

  /** The bar's clock, the house way ("0:42"); dimmed while it waits (`waiting`). */
  get waiting(): boolean {
    return this.shown === null && !this.state.over && this.clockAt === null;
  }

  /** The app went to the background or inactive: stop the clock and keep the round. */
  away() {
    if (this.state.timer === 'running' && !this.state.over) {
      this.stop();
      this.awayPaused = true;
      this.poke();
    }
    this.keep();
  }

  /** The app is back: carry on where it stopped. */
  back() {
    if (!this.awayPaused || this.state.over) return;
    this.awayPaused = false;
    this.clockAt = this.deps.now();
    this.poke();
  }

  private stop(at = this.deps.now()) {
    if (this.clockAt !== null) this.acc += at - this.clockAt;
    this.clockAt = null;
  }

  /** curSave: write the round to digi-link-v1 › cur (quietly: a failed write is let go). */
  private keep(at = this.deps.now()) {
    const c = roundToKeep(this.state, this.secs(at), at, this.dirty);
    if (c) this.writeRound(c);
  }

  private writeRound(c: Parameters<typeof withRound>[1]) {
    try {
      const next = withRound(this.deps.store.getItem(SAVE_KEY), c);
      if (next !== null) this.deps.store.setItem(SAVE_KEY, next);
    } catch {
      /* the page's curWrite is quiet on failure */
    }
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(this.setT(fn, ms));
  }

  private step(move: Move, at = this.deps.now()) {
    const before = this.state;
    this.state = apply(before, move);
    const s = this.state;
    if (s.replayStarted !== before.replayStarted || (move.t === 'again' && s !== before)) {
      // Play again: a fresh board and clock (the page's start()).
      this.acc = 0;
      this.clockAt = null;
      this.awayPaused = false;
      this.dirty = false;
    }
    if (s.timer === 'running' && before.timer !== 'running') {
      this.awayPaused = false;
      this.clockAt = at;
    } else if (s.timer === 'running' && this.clockAt === null) this.clockAt = at;
    if (s.timer === 'stopped' && before.timer === 'running') this.stop(at);
    if (s.guesses.length > before.guesses.length) this.dirty = true;
    // curSave after a counted guess that isn't a right four (that one keeps on landing),
    // and after a landing that doesn't end the round; the fourth mistake clears it.
    if (move.t === 'submit' && s.guesses.length > before.guesses.length && !s.settling) {
      if (s.over) this.writeRound(null);
      else this.keep(at);
    }
    if (move.t === 'land' && before.settling && !s.over) this.keep(at);
    if (s.settling && !before.settling)
      this.later(() => this.step({ t: 'land' }), this.reduced ? 0 : SETTLE_MS);
    if (s.revealing && !before.revealing) {
      const rest = 4 - s.solved.length;
      this.later(
        () => this.step({ t: 'revealed' }),
        REVEAL_STEP_MS + (this.reduced ? 0 : REVEAL_STEP_MS * rest),
      );
    }
    if (finishing(s) && !this.committed) {
      this.committed = true;
      const f = commitFinish(s, this.clock(at), this.deps.saves, this.deps.store, at);
      this.writeRound(null); // curClear
      if (f.first) this.deps.announce(f);
      this.state = afterFinish(s, f);
      this.info = f;
      this.later(
        () => {
          this.phase = 'finished';
          this.poke();
        },
        this.reduced ? 0 : f.won ? 1200 : 500,
      );
    }
    this.poke();
  }

  play() {
    this.phase = 'play';
    this.step({ t: 'play' });
  }

  dispatch(m: ScreenMove) {
    if (m.t === 'shuffle')
      return this.step({ t: 'shuffle', order: shuffle(this.state.live.slice(), this.deps.random) });
    if (m.t === 'again') {
      if (!this.state.over || this.state.won) return;
      this.committed = false;
      this.shown = null;
      this.phase = 'play';
      return this.step({ t: 'again', order: shuffle(allTiles(this.file.data), this.deps.random) });
    }
    this.step(m);
  }
}
