import { BACKFILL_BATCH, backfillCalls } from '@noodle/core';

import { isMonday, recapRows, shareRecap } from '../hooks/boardText';
import type { OverallRow } from '../types';

const row = (rank: number, nick: string, points: number) =>
  ({ rank, nick, points, me: false, played: 9, completed: 9 }) as OverallRow;

describe('GIVEN last week’s table', () => {
  const week = [row(1, 'Ann', 40), row(2, 'Bob', 30), row(3, 'Cy', 20), row(4, 'Di', 1)];

  it('WHEN the day is asked THEN only Mondays are recap days', () => {
    expect(isMonday('2026-11-09')).toBe(true);
    expect(isMonday('2026-11-10')).toBe(false);
  });

  it('WHEN shared THEN it has the medal places, how many more, and a link to that week', () => {
    expect(shareRecap({ name: 'Family', code: 'ABC' }, '2026-11-02', '2026-11-08', week)).toBe(
      '🏆 Family · 2 Nov – 8 Nov\n🥇 Ann 40 pts\n🥈 Bob 30 pts\n🥉 Cy 20 pts\n+1 more\nFamily leaderboard:\nhttps://dailynoodle.co.uk/join.html?c=ABC&p=all&d=2026-11-08',
    );
  });

  it('WHEN several tie THEN the card still stops at five', () => {
    expect(recapRows(Array.from({ length: 8 }, (_, i) => row(1, `P${i}`, 5)))).toHaveLength(5);
  });
});

describe('GIVEN a long history', () => {
  it('WHEN it goes to the board THEN every call is within the server’s limit and none is lost', () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ path: `p${i}`, outcome: 'solved' }));
    const calls = backfillCalls({ rows, aids: ['a'], n: 2500, done: [] });
    expect(calls.map((c) => c.rows.length)).toEqual([BACKFILL_BATCH, BACKFILL_BATCH, 500]);
    expect(calls.map((c) => c.aid)).toEqual(['a', null, null]);
    expect(calls.flatMap((c) => c.rows)).toEqual(rows);
  });
});
