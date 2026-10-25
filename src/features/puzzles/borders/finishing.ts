/**
 * What happens when a Borders ten is done, and what a reopened one shows: the save,
 * the streak and the finish sheet's words, exactly as engines/borders.js finish() and
 * showResult() do them, and what dn-track.js reads off the result box for
 * `dn:puzzle_end`. Borders counts every finished round towards its streak, on
 * whichever day it is played (the engine's rule; Tangle and Reckon count only a
 * round played on its own day). The screen and the differential replay both call
 * these, so the replay proves the code the app runs.
 */
import { bumpRoundStreak, dayBefore, shareBorders, type KV, type SaveStore } from '@noodle/core';

import {
  atlasAdd,
  bestOf,
  finishRecord,
  liveStreakOf,
  mmss,
  noteFor,
  NQ,
  recapTiles,
  SAVE_KEY,
  type BordersRecord,
  type BordersSave,
  type BordersState,
  type Host,
} from './model';

export interface FinishInfo {
  id: string;
  /** "7 of 10" */
  hero: string;
  note: string;
  share: string;
  points: number;
  streak: number;
  best: number;
  time: string;
  tiles: ReturnType<typeof recapTiles>;
  rec: BordersRecord;
}

export interface Finished extends FinishInfo {
  detail: Record<string, unknown>;
  state: BordersState;
}

/** The host the model saves through: the save rules, and the atlas in the same storage. */
export function saveHost(
  saves: SaveStore,
  kv: KV,
  id: string,
  now: () => number,
  today: () => string,
): Host {
  return {
    now,
    today,
    persist: (save, report) => saves.saveProgress(SAVE_KEY, save, id, report) as BordersSave,
    atlasAdd: (name) => atlasAdd(kv, name),
  };
}

export function sheetInfo(s: BordersState, rec: BordersRecord, t: string): FinishInfo {
  const n = liveStreakOf(s.save, t, dayBefore);
  return {
    id: s.P.id,
    hero: rec.c + ' of ' + NQ,
    note: noteFor(s.P, rec),
    share: shareBorders(s.P.id, rec.c, NQ, rec.p, n),
    points: rec.p,
    streak: n,
    best: bestOf(s.save),
    time: mmss(rec.secs),
    tiles: recapTiles(s.P, rec),
    rec,
  };
}

function trackedSecs(t: string): number | null {
  const m = /(\d+):(\d{2})(?::(\d{2}))?/.exec(t);
  if (!m) return null;
  return m[3] ? +m[1]! * 3600 + +m[2]! * 60 + +m[3] : +m[1]! * 60 + +m[2]!;
}

/** The detail dn-track.js builds when the result box gains "on". */
export function endDetail(info: FinishInfo, hints: number): Record<string, unknown> {
  return {
    type: 'geo-borders',
    tv: 3,
    outcome: 'scored',
    secs: trackedSecs(info.time),
    checks: 0,
    reveals: 0,
    hints,
    got: info.rec.c,
    of: NQ,
    score: info.rec.p,
  };
}

/** The engine's finish(): the record (dated `on` today), the streak, the round closed. */
export function commitFinish(prev: BordersState, host: Host): Finished {
  const s: BordersState = { ...prev, save: JSON.parse(JSON.stringify(prev.save)) };
  const aliased = !!prev.cur && prev.cur === prev.save.cur;
  s.cur = aliased ? s.save.cur : prev.cur;
  s.ending = true;
  s.finishing = false;
  const t = host.today();
  const rec = finishRecord(s, t);
  s.save.done[s.P.id] = rec;
  s.save.cur = null;
  s.save.streak = bumpRoundStreak(s.save.streak || { last: null, n: 0, best: 0 }, t);
  s.save = host.persist(s.save, true);
  s.cur = null;
  s.shown = rec;
  s.view = 'winModal';
  const info = sheetInfo(s, rec, t);
  return { ...info, detail: endDetail(info, s.hints), state: s };
}

export function reopenInfo(s: BordersState, t: string): FinishInfo | null {
  return s.shown ? sheetInfo(s, s.shown, t) : null;
}

export function readSave(kv: KV): unknown {
  try {
    return JSON.parse(kv.getItem(SAVE_KEY) || 'null') as unknown;
  } catch {
    return null;
  }
}
