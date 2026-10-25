/**
 * What happens when a Reckon's ten are done, and what a reopened one shows: the save,
 * the streak and the finish sheet's words, exactly as engines/reckon.js finish(),
 * noteFor(), showResult() and shareText() do them, and what dn-track.js reads off the
 * result box for `dn:puzzle_end`. The screen and the differential replay both call
 * these, so the replay proves the code the app runs.
 */
import { bumpRoundStreak, dayBefore, shareReckon, type KV, type SaveStore } from '@noodle/core';

import {
  bestScore,
  finishRecord,
  liveStreak,
  mmss,
  noteFor,
  recapRows,
  SAVE_KEY,
  type Host,
  type ReckonRecord,
  type ReckonSave,
  type ReckonState,
} from './model';

/** Everything the finish sheet shows. */
export interface FinishInfo {
  id: string;
  /** The points, shown big with "pts" after them. */
  points: number;
  /** The time stat ("1:27"). */
  time: string;
  note: string;
  share: string;
  streak: number;
  best: number;
  rows: ReturnType<typeof recapRows>;
  rec: ReckonRecord;
}

export interface Finished extends FinishInfo {
  /** The `dn:puzzle_end` detail the site's tracker sends. */
  detail: Record<string, unknown>;
  state: ReckonState;
}

/** The host the model saves through: the app's (or the replay's) save rules. */
export function saveHost(
  saves: SaveStore,
  id: string,
  now: () => number,
  today: () => string,
): Host {
  return {
    now,
    today,
    persist: (save, report) => saves.saveProgress(SAVE_KEY, save, id, report) as ReckonSave,
  };
}

/** The sheet's words for a record, with today's streak (showResult). */
export function sheetInfo(s: ReckonState, rec: ReckonRecord, t: string): FinishInfo {
  const n = liveStreak(s.save, t, dayBefore);
  return {
    id: s.P.id,
    points: rec.p,
    time: mmss(rec.secs),
    note: noteFor(s.P, rec),
    share: shareReckon(s.P.id, rec.z, rec.p, n),
    streak: n,
    best: bestScore(s.save),
    rows: recapRows(s.P, rec),
    rec,
  };
}

/** dn-track.js's mmss: the shown time back to seconds. */
function trackedSecs(t: string): number | null {
  const m = /(\d+):(\d{2})(?::(\d{2}))?/.exec(t);
  if (!m) return null;
  return m[3] ? +m[1]! * 3600 + +m[2]! * 60 + +m[3] : +m[1]! * 60 + +m[2]!;
}

/** The detail dn-track.js builds when the result box gains "on". */
export function endDetail(info: FinishInfo): Record<string, unknown> {
  return {
    type: 'quiz-reckon',
    tv: 3,
    outcome: 'scored',
    secs: trackedSecs(info.time),
    checks: 0,
    reveals: 0,
    hints: 0,
    score: info.rec.p,
    bulls: info.rec.b,
    zones:
      info.rec.z
        .join('')
        .replace(/[^0-4]/g, '')
        .slice(0, 10) || null,
  };
}

/**
 * The engine's finish(): the first result per puzzle stands (putDone), the streak
 * counts only a round finished on its own London day, best score, the round closed.
 */
export function commitFinish(prev: ReckonState, saves: SaveStore, host: Host): Finished {
  const s: ReckonState = { ...prev, save: JSON.parse(JSON.stringify(prev.save)) };
  const aliased = !!prev.R && prev.R === prev.save.cur;
  s.R = aliased ? s.save.cur : prev.R;
  s.ending = true;
  s.finishing = false;
  const t = host.today();
  const rec = finishRecord(s);
  const kept = saves.putDone(SAVE_KEY, s.P.id, { ...rec }) as ReckonRecord | null;
  let st = s.save.streak || { last: null, n: 0, best: 0 };
  if (s.P.date === t && st.last !== t) st = bumpRoundStreak(st, t);
  s.save.streak = st;
  s.save.done[s.P.id] = kept || Object.assign(rec, { d: t });
  s.save.best = Math.max(+s.save.best || 0, rec.p);
  s.save.cur = null;
  s.save = host.persist(s.save, true);
  s.R = null;
  s.VR = null;
  s.shown = s.save.done[s.P.id]!;
  s.view = 'winModal';
  const info = sheetInfo(s, s.shown, t);
  return { ...info, detail: endDetail(info), state: s };
}

/** A Reckon reopened from its save: the sheet for its first record. */
export function reopenInfo(s: ReckonState, t: string): FinishInfo | null {
  return s.shown ? sheetInfo(s, s.shown, t) : null;
}

export function readSave(kv: KV): unknown {
  try {
    return JSON.parse(kv.getItem(SAVE_KEY) || 'null') as unknown;
  } catch {
    return null;
  }
}
