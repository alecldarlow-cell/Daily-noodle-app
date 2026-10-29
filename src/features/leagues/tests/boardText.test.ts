import {
  dayName,
  boardLink,
  inviteLink,
  mmss,
  puzzleOn,
  result,
  shareAll,
  shareDay,
  weekDays,
  weekLabel,
} from '../hooks/boardText';
import type { DayRow } from '../types';

const row = (o: Partial<DayRow>): DayRow => ({
  nick: 'Alec',
  me: false,
  outcome: 'solved',
  secs: 87,
  mistakes: null,
  streak: 0,
  ...o,
});

describe('GIVEN a Tangle result, always a 90-second round (AF-025)', () => {
  it('THEN it reads points only: no time under the row, none in brackets in the share', () => {
    expect(result('tangle', row({ outcome: 'scored', score: 29, secs: 90 }))).toEqual({
      big: '29 pts',
      small: '',
    });
    const ranked = [
      row({ rank: 1, nick: 'Martin', outcome: 'scored', score: 29, secs: 90 }),
      row({ rank: 2, nick: 'Mumby', outcome: 'scored', score: 24, secs: 90 }),
    ];
    const text = shareDay('tangle', 'Tangle 22', '2026-10-28', ranked, {
      name: 'Noodlers',
      code: 'ABCD2345',
    });
    expect(text.split('\n').slice(1, 3)).toEqual(['🥇 Martin 29 pts', '🥈 Mumby 24 pts']);
    expect(text).not.toMatch(/1:30/);
  });

  it('THEN Borders and Reckon keep their time, which varies', () => {
    const r = [row({ rank: 1, nick: 'Jo', outcome: 'scored', score: 650, secs: 75 })];
    expect(shareDay('borders', 'Borders 24', '2026-10-28', r, { name: 'N', code: 'C' })).toMatch(
      /🥇 Jo 650 pts \(1:15\)/,
    );
  });
});

describe('GIVEN results on a board', () => {
  it('THEN times, scores and losses read as board.html writes them', () => {
    expect(result('mini', row({ secs: 87 }))).toEqual({ big: '1:27', small: '' });
    expect(result('link', row({ secs: 134, mistakes: 1 }))).toEqual({
      big: '2:14',
      small: '1 mistake',
    });
    expect(result('link', row({ mistakes: null }))).toEqual({ big: '1:27', small: '0 mistakes' });
    expect(result('link', row({ outcome: 'failed' }))).toEqual({
      big: 'Out of guesses',
      small: '',
    });
    expect(result('sweep', row({ outcome: 'failed' }))).toEqual({
      big: 'Didn’t finish',
      small: '',
    });
    expect(result('sweep', row({ outcome: 'revealed' }))).toEqual({ big: 'Revealed', small: '' });
    expect(result('borders', row({ outcome: 'scored', score: 640, secs: 75 }))).toEqual({
      big: '640 pts',
      small: '1:15',
    });
    expect(result('tangle', row({ outcome: 'scored', score: null, secs: null }))).toEqual({
      big: '– pts',
      small: '',
    });
    expect(result('reckon', row({ outcome: 'scored', score: 7, secs: 61 }))).toEqual({
      big: '7 pts',
      small: '1:01',
    });
    expect(mmss(3725)).toBe('1:02:05');
    expect(mmss(null)).toBe('');
  });

  it('THEN days are Today, Yesterday, or a short date, and a week is labelled and counted', () => {
    expect(dayName('2026-10-24', '2026-10-24')).toBe('Today');
    expect(dayName('2026-10-23', '2026-10-24')).toBe('Yesterday');
    expect(dayName('2026-09-22', '2026-10-24')).toBe('Tue 22 Sep');
    expect(weekLabel('2026-10-19', '2026-10-25')).toBe('19 Oct – 25 Oct');
    expect(weekDays('2026-10-21', '2026-10-19')).toBe(24);
    expect(weekDays('2026-10-30', '2026-10-19')).toBe(56);
  });

  it('THEN shares list the top five and end with the league’s invite link', () => {
    const ranked = [1, 2, 3, 4, 5, 6].map((n) => row({ rank: n, nick: `P${n}`, secs: 60 + n }));
    expect(
      shareDay('mini', 'Mini 105', '2026-10-24', ranked, { name: 'Family', code: 'ABCD2345' }),
    ).toBe(
      [
        '🏆 ✏️ Mini 105 · Sat 24 Oct',
        '🥇 P1 1:01',
        '🥈 P2 1:02',
        '🥉 P3 1:03',
        '4. P4 1:04',
        '5. P5 1:05',
        '+1 more',
        'Family leaderboard:',
        'https://dailynoodle.co.uk/board.html?join=ABCD2345&v=2&p=mini&d=2026-10-24',
      ].join('\n'),
    );
    expect(
      shareDay('link', null, '2026-10-24', [row({ rank: 1, mistakes: 2 })], {
        name: 'F',
        code: 'C',
      }),
    ).toContain('🥇 Alec 1:27 (2 mistakes)');
    expect(
      shareAll(
        '2026-10-24',
        [{ rank: 1, nick: 'Ma', me: false, points: 1, played: 1, completed: 1 }],
        { name: 'F', code: 'C' },
      ),
    ).toBe(
      '🏆 All puzzles · Sat 24 Oct\n🥇 Ma 1 pt (1/8)\nF leaderboard:\nhttps://dailynoodle.co.uk/board.html?join=C&v=2&p=all&d=2026-10-24',
    );
    expect(inviteLink('AB CD')).toBe('https://dailynoodle.co.uk/join.html?c=AB%20CD');
    expect(boardLink('AB CD')).toBe('https://dailynoodle.co.uk/board.html?join=AB%20CD&v=2');
  });

  it('THEN a day’s puzzle is found among the site’s cards', () => {
    const cards = [
      {
        path: 'reports/2026-10-24-crossword-mini-0105.html',
        type: 'mini',
        id: 'x',
        date: '2026-10-24',
        headline: 'Mini 105',
      },
    ];
    expect(puzzleOn(cards, 'mini', '2026-10-24')?.headline).toBe('Mini 105');
    expect(puzzleOn(undefined, 'mini', '2026-10-24')).toBeNull();
  });
});
