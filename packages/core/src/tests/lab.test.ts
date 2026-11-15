import { PUZZLE_TYPES, typeOfId } from '../ids';
import {
  isLabType,
  LAB_TYPES,
  labelOf,
  labPlayed,
  labRunning,
  labSaveKey,
  labTypeOfId,
  readLabVotes,
  withLabVote,
} from '../lab';

describe('GIVEN the Lab types', () => {
  it('THEN none is a daily type, and daily ids are not Lab ids', () => {
    for (const t of LAB_TYPES) expect((PUZZLE_TYPES as readonly string[]).includes(t)).toBe(false);
    expect(labTypeOfId('DP·MINI·0105')).toBeNull();
    expect(typeOfId('DP·REDA·0024')).toBeNull();
  });
  it.each([
    ['DP·TILT·0024', 'tilt'],
    ['DP·REDA·0024', 'redact'],
    ['DP·TUMB·0024', 'tumbler'],
  ])('THEN %s is the Lab type %s', (id, type) => {
    expect(labTypeOfId(id)).toBe(type);
    expect(isLabType(type)).toBe(true);
  });
  it('THEN anything else is not a Lab type', () => {
    expect(isLabType('mini')).toBe(false);
    expect(isLabType(3)).toBe(false);
    expect(labTypeOfId('REDA 24')).toBeNull();
  });
});

describe('GIVEN a trial whose newest puzzle has a date', () => {
  it('WHEN it is today or yesterday THEN it is running', () => {
    expect(labRunning('2026-11-11', '2026-11-11')).toBe(true);
    expect(labRunning('2026-11-10', '2026-11-11')).toBe(true);
    expect(labRunning('2026-11-01', '2026-11-01')).toBe(true);
  });
  it('WHEN it is older, or there is none THEN it is retired', () => {
    expect(labRunning('2026-11-09', '2026-11-11')).toBe(false);
    expect(labRunning(undefined, '2026-11-11')).toBe(false);
  });
  it('WHEN the day before crosses a month THEN it still counts', () => {
    expect(labRunning('2026-10-31', '2026-11-01')).toBe(true);
  });
});

describe('GIVEN the kept votes', () => {
  it('WHEN read THEN only real answers for Lab types are kept', () => {
    const raw = JSON.stringify({
      redact: { v: 'yes', at: 5 },
      tilt: { v: 'maybe', at: 1 },
      tumbler: { v: 'no' },
      mini: { v: 'yes', at: 1 },
    });
    expect(readLabVotes(raw)).toEqual({ redact: { v: 'yes', at: 5 }, tumbler: { v: 'no', at: 0 } });
  });
  it('WHEN missing, broken or not an object THEN there are none', () => {
    expect(readLabVotes(null)).toEqual({});
    expect(readLabVotes('{oops')).toEqual({});
    expect(readLabVotes('[1]')).toEqual({});
  });
  it('WHEN an answer is given THEN it is set and the rest kept', () => {
    const raw = JSON.stringify({ tilt: { v: 'no', at: 1 }, other: 1 });
    expect(JSON.parse(withLabVote(raw, 'redact', 'yes', 9)!)).toEqual({
      tilt: { v: 'no', at: 1 },
      other: 1,
      redact: { v: 'yes', at: 9 },
    });
  });
  it('WHEN the same answer is given again THEN nothing changes', () => {
    const raw = JSON.stringify({ redact: { v: 'yes', at: 1 } });
    expect(withLabVote(raw, 'redact', 'yes', 9)).toBeNull();
    expect(JSON.parse(withLabVote(raw, 'redact', 'no', 9)!)).toEqual({
      redact: { v: 'no', at: 9 },
    });
  });
  it('WHEN the document is broken THEN a new one is written', () => {
    expect(JSON.parse(withLabVote('{oops', 'tilt', 'no', 2)!)).toEqual({
      tilt: { v: 'no', at: 2 },
    });
    expect(JSON.parse(withLabVote('[]', 'tilt', 'no', 2)!)).toEqual({ tilt: { v: 'no', at: 2 } });
  });
});

describe('GIVEN a Lab type’s save', () => {
  const ID = 'DP·REDA·0024';
  it('WHEN the puzzle is done THEN its card says the time', () => {
    expect(labPlayed(ID, { v: 1, done: { [ID]: { t: '1:42', s: 102 } } })).toEqual({
      done: true,
      lost: false,
      text: 'Solved in 1:42',
    });
    expect(labPlayed(ID, { v: 1, done: { [ID]: { t: 'x' } } })).toEqual({
      done: true,
      lost: false,
      text: 'Played',
    });
  });
  it('WHEN a round is kept for it THEN it is in progress; another puzzle’s round is not', () => {
    expect(labPlayed(ID, { v: 1, cur: { id: ID } } as never)).toEqual({ done: false });
    expect(labPlayed(ID, { v: 1, cur: { id: 'DP·REDA·0023' } } as never)).toBeNull();
    expect(labPlayed(ID, null)).toBeNull();
  });
  it('THEN its key is the one it would keep as a daily', () => {
    expect(labSaveKey('tumbler')).toBe('digi-tumbler-v1');
  });
});

describe('GIVEN any type', () => {
  it('THEN its name is the daily or Lab name', () => {
    expect(labelOf('mini')).toBe('Mini');
    expect(labelOf('tumbler')).toBe('Tumbler');
  });
});
