import {
  allTiles,
  apply,
  init,
  readRound,
  resumeRound,
  roundToKeep,
  WAIT_HINT,
  withRound,
} from '../model';
import { link78 } from './fixtures';

const G = link78.groups.map((g) => g.members.map((m) => m.toUpperCase()));
const fresh = () => init(link78, allTiles(link78), { ranked: true, rec: null });
const pick = (s: ReturnType<typeof fresh>, ws: string[]) =>
  apply(
    ws.reduce((x, w) => apply(x, { t: 'tile', w }), s),
    { t: 'submit' },
  );

describe('GIVEN a fresh Link (AF-028)', () => {
  it('THEN it waits with the hint, which the first tap (or Play) clears', () => {
    const s = fresh();
    expect(s.msg).toEqual({ text: WAIT_HINT, tone: 'wait' });
    expect(apply(s, { t: 'play' }).msg).toEqual({ text: '', tone: '' });
    expect(apply(s, { t: 'tile', w: G[0]![0]! }).msg.text).toBe('');
  });
});

describe('GIVEN a round to keep (engines/link.js curSave)', () => {
  it('THEN it is kept in the page’s shape once a guess is made or time has passed', () => {
    const s = pick(apply(fresh(), { t: 'play' }), [G[1]![0]!, G[1]![1]!, G[1]![2]!, G[2]![0]!]);
    const c = roundToKeep(s, 12, 1000, true)!;
    expect(c).toEqual({
      id: link78.id,
      f: [],
      m: 1,
      g: s.guesses,
      tr: s.tried,
      l: s.live,
      s: 12,
      at: 1000,
    });
    expect(roundToKeep(fresh(), 0, 1, false)).toBeNull();
    expect(roundToKeep(fresh(), 3, 1, false)).not.toBeNull();
  });
  it('THEN nothing is kept for a finished board, a replay or a puzzle with a result', () => {
    const s = fresh();
    expect(roundToKeep({ ...s, over: true }, 5, 1, true)).toBeNull();
    expect(roundToKeep({ ...s, replayStarted: true }, 5, 1, true)).toBeNull();
    expect(roundToKeep({ ...s, hasRecord: true }, 5, 1, true)).toBeNull();
  });
});

describe('GIVEN the save document (curWrite)', () => {
  const c = roundToKeep(fresh(), 4, 9, true)!;
  it('THEN the round goes in beside done, which is left as it was', () => {
    const doc = { v: 1, done: { X: { o: 'win' } } };
    expect(JSON.parse(withRound(JSON.stringify(doc), c)!)).toEqual({ ...doc, cur: c });
    expect(JSON.parse(withRound(null, c)!)).toEqual({ v: 1, cur: c });
  });
  it('THEN clearing writes cur null only when there was one, and a save it can’t read is never touched', () => {
    expect(withRound(JSON.stringify({ v: 1, done: {} }), null)).toBeNull();
    expect(JSON.parse(withRound(JSON.stringify({ v: 1, cur: c }), null)!)).toEqual({
      v: 1,
      cur: null,
    });
    expect(withRound('{oops', c)).toBeNull();
    expect(withRound(JSON.stringify({ v: 2 }), c)).toBeNull();
  });
});

describe('GIVEN a kept round read back (curRead / curRestore)', () => {
  const doc = (cur: Record<string, unknown>, done = {}) => JSON.stringify({ v: 1, done, cur });
  const base = {
    id: link78.id,
    f: [link78.groups[0]!.rank],
    m: 2,
    g: [],
    tr: ['A|B'],
    l: [...G[3]!, ...G[2]!, ...G[1]!],
    s: 90,
    at: 1,
  };
  it('THEN the board comes back as it was, nothing held, paused at its time', () => {
    const r = resumeRound(fresh(), doc(base), (t) => t)!;
    expect(r.secs).toBe(90);
    expect(r.state).toMatchObject({
      solved: [0],
      mistakes: 2,
      tried: ['A|B'],
      sel: [],
      live: base.l,
      timer: 'idle',
      msg: { text: 'Paused at 1:30 · tap a word to carry on', tone: 'wait' },
    });
  });
  it('THEN a kept order that no longer fits is dealt again', () => {
    const r = resumeRound(fresh(), doc({ ...base, l: ['NOPE'] }), (t) => t.slice().reverse())!;
    expect(r.state.live).toHaveLength(12);
  });
  it('THEN a right guess saved mid-flight counts as found', () => {
    const rank = link78.groups[1]!.rank;
    const r = readRound(fresh().p, doc({ ...base, g: [[rank, rank, rank, rank]] }))!;
    expect(r.found).toEqual([0, 1]);
  });
  it.each([
    ['another puzzle', { id: 'DP·LINK·0001' }],
    ['four found', { f: [1, 2, 3, 4] }],
    ['a repeated rank', { f: [1, 1] }],
    ['an unknown rank', { f: [9] }],
    ['four mistakes', { m: 4 }],
    ['a bad time', { s: -1 }],
  ])('THEN %s is not a round', (_n, change) => {
    expect(readRound(fresh().p, doc({ ...base, ...change }))).toBeNull();
  });
  it('THEN a finished puzzle, or an unreadable save, has none', () => {
    expect(readRound(fresh().p, doc(base, { [link78.id]: { o: 'win' } }))).toBeNull();
    expect(readRound(fresh().p, '{')).toBeNull();
    expect(resumeRound({ ...fresh(), hasRecord: true }, doc(base), (t) => t)).toBeNull();
  });
});
