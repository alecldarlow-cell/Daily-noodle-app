import type { KV, SaveStore } from '@noodle/core';

import type { PuzzleFile } from '../../types';
import { commitFinish, isRanked, reopenInfo, type Finished, type FinishInfo } from '../finishing';
import {
  afterFinish,
  allTiles,
  apply,
  finishing,
  init,
  recordTime,
  REVEAL_STEP_MS,
  SAVE_KEY,
  SETTLE_MS,
  shuffle,
  timerText,
  type LinkData,
  type LinkState,
  type Move,
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
 */
export class LinkGame {
  state: LinkState;
  phase: Phase;
  info: FinishInfo | null;
  private clockAt: number | null = null;
  private frozen = 0;
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
    this.state = init(data, shuffle(allTiles(data), deps.random), {
      ranked: isRanked(deps.store, deps.now()),
      rec,
    });
    const restored = this.state.restored && !!rec;
    this.phase = restored ? 'finished' : 'start';
    this.info = restored ? reopenInfo(this.state.p, rec, deps.store) : null;
    this.shown = restored ? recordTime(rec) : null;
    this.committed = this.state.restored;
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

  /** The clock as the page's #timer shows it. */
  clock(at = this.deps.now()): string {
    if (this.shown !== null) return this.shown;
    if (this.state.timer === 'running' && this.clockAt !== null)
      return timerText((at - this.clockAt) / 1000);
    return timerText(this.state.timer === 'idle' ? 0 : this.frozen);
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(this.setT(fn, ms));
  }

  private step(move: Move) {
    const before = this.state;
    const at = this.deps.now();
    this.state = apply(before, move);
    const s = this.state;
    if (
      s.timer === 'running' &&
      (before.timer !== 'running' || s.replayStarted !== before.replayStarted)
    )
      this.clockAt = at;
    if (s.timer === 'stopped' && before.timer === 'running')
      this.frozen = Math.floor((at - (this.clockAt ?? at)) / 1000);
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
