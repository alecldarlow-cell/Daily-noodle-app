import { dayBefore } from '@noodle/core';

import {
  apply,
  defaults,
  fmt,
  fmtA,
  fractionOf,
  frame,
  gate,
  grp,
  holdSteps,
  homeView,
  init,
  ladder,
  ladderOf,
  loadSave,
  mmss,
  noteFor,
  offText,
  playView,
  recapRows,
  scaleMarks,
  shortLab,
  trim,
  validate,
  withU,
  zone,
  type Host,
  type Move,
  type ReckonSave,
  type ReckonState,
} from '../model';
import { clone, reckon2 } from './fixtures';

/** A host that keeps the save in memory and runs on a clock the test moves. */
function testHost() {
  const h = { t: 1000, saved: [] as ReckonSave[] };
  const host: Host = {
    now: () => h.t,
    today: () => '2026-10-21',
    persist: (s) => {
      h.saved.push(JSON.parse(JSON.stringify(s)));
      return s;
    },
  };
  return { h, host };
}

function play(moves: Move[], s0: ReckonState = init(reckon2, null, 0)) {
  const { h, host } = testHost();
  let s = s0;
  for (const m of moves) {
    s = apply(s, m, host);
    h.t += 500;
  }
  return { s, h, host };
}

describe('GIVEN Reckon’s ship gate', () => {
  it('THEN the published day passes and broken ones fail as the engine says', () => {
    expect(gate(reckon2, '2026-10-21')).toEqual([]);
    expect(validate(reckon2).ok).toBe(true);
    expect(gate(null)).toEqual(['no puzzle object']);
    expect(gate({ ...reckon2, qs: reckon2.qs.slice(0, 9) })).toEqual(['expected 10 questions']);
    const bad = clone(reckon2);
    bad.id = 'DP·RECK·2';
    bad.qs[0]!.e = 0;
    bad.qs[1]!.lo = 9;
    bad.qs[2]!.k = bad.qs[3]!.k;
    bad.qs[4]!.a = -1;
    bad.qs[5]!.q = 'short';
    bad.qs[6]!.f = bad.qs[7]!.f;
    expect(gate(bad, '2026-10-22')).toEqual([
      'id DP·RECK·2',
      'dn:date 2026-10-22 != 2026-10-21',
      'q2 zones off the scale',
      'q4 pack',
      'q5 answer',
      'q6 question',
      'q8 fact id',
      'opener is not an easy one',
    ]);
  });
});

describe('GIVEN Ballpark’s numbers', () => {
  it('THEN they read as the game writes them', () => {
    expect(grp(1234567)).toBe('1,234,567');
    expect(trim(2.3456)).toBe('2.35');
    expect(fmt(2.5e12)).toBe('2.5 trillion');
    expect(fmt(3.2e9)).toBe('3.2 billion');
    expect(fmt(15e6)).toBe('15 million');
    expect(fmt(21000)).toBe('21,000');
    expect(fmt(8.75)).toBe('8.75');
    expect(fmtA(299792)).toBe('299,792');
    expect(fmtA(2.5e6)).toBe('2.5 million');
    expect(fmtA(34)).toBe('34');
    expect(withU('34', '%')).toBe('34%');
    expect(withU('34', 'km')).toBe('34 km');
    expect(withU('34', '')).toBe('34');
    expect([1e12, 2e9, 3e6, 4000, 30].map(shortLab)).toEqual(['1tn', '2bn', '3M', '4k', '30']);
    expect(mmss(83)).toBe('1:23');
    expect(mmss(3723)).toBe('1:02:03');
  });

  it('THEN zones and the words for a gap follow the bands, from the smaller number', () => {
    expect([100, 114, 130, 160, 300, 301].map((g) => zone(g, 100))).toEqual([0, 0, 1, 2, 3, 4]);
    expect(zone(50, 100)).toBe(zone(200, 100));
    expect(offText(100.2, 100)).toBe('Spot on.');
    expect(offText(80, 100)).toBe('The answer was 25% more than your guess.');
    expect(offText(120, 100)).toBe('Your guess was 20% more than the answer.');
    expect(offText(25, 100)).toBe('The answer was about 4× your guess.');
    expect(offText(310, 100)).toBe('Your guess was about 3.1× the answer.');
  });

  it('THEN the scale has its steps and marks, whole numbers only where asked', () => {
    const lad = ladder(0, false);
    expect(lad[0]).toBe(1);
    expect(lad.at(-1)).toBe(100);
    expect(ladder(-0.5, true).every((v) => v >= 1 && Number.isInteger(v))).toBe(true);
    const m = scaleMarks(0);
    expect(m.labels.map((l) => l.text)).toEqual(['3', '10', '30']);
    expect(m.ticks.filter((t) => t.kind === 'mj')).toHaveLength(3);
  });
});

describe('GIVEN the save', () => {
  it('THEN a stored v1 document is laid over the defaults and anything else is ignored', () => {
    expect(loadSave(null)).toEqual(defaults());
    expect(loadSave({ v: 2, best: 9 })).toEqual(defaults());
    const s = loadSave({ v: 1, best: 9, snd: false, done: 'x' });
    expect(s).toMatchObject({ best: 9, snd: false, done: {}, tip: 0, fs: true });
  });
});

describe('GIVEN a round being played', () => {
  describe('WHEN Play is tapped', () => {
    it('THEN the first question shows with the coach tip and the marker mid-scale', () => {
      const { s, h } = play([{ t: 'play' }]);
      expect(s.view).toBe('play');
      expect(s.save.cur).toMatchObject({ id: reckon2.id, i: 0, ph: 'g', secs: 0 });
      expect(s.R).toBe(s.save.cur);
      const v = playView(s);
      expect(v).toMatchObject({
        qn: '1/10',
        score: 0,
        guessing: true,
        tipHidden: false,
        action: 'Lock in',
      });
      expect(v.chip.name).toBe('Space');
      expect(h.saved).toHaveLength(1);
    });
  });

  describe('WHEN the scale is dragged, nudged and held', () => {
    it('THEN the guess moves by steps, a hold repeats, and the tip goes', () => {
      let { s, host } = play([{ t: 'play' }]);
      const lad = ladderOf(s);
      s = apply(s, { t: 'drag', fr: fractionOf(s, 10) }, host);
      expect(s.CI).toBe(10);
      expect(s.R!.cur).toBe(lad[10]);
      expect(s.tipHidden).toBe(true);
      expect(s.save.tip).toBe(1);
      s = apply(s, { t: 'nudge', d: 1 }, host);
      expect(s.CI).toBe(11);
      s = apply(s, { t: 'nudge', d: -1, hold: 380 + 75 * 3 + 5 }, host);
      expect(s.CI).toBe(8);
      s = apply(s, { t: 'nudge', d: -1, hold: 400 }, host);
      expect(s.CI).toBe(8); // held, no repeat yet: the click does nothing
      s = apply(s, { t: 'repeat', d: 1 }, host);
      s = apply(s, { t: 'release' }, host);
      expect(s.CI).toBe(9);
      s = apply(s, { t: 'drag', fr: -3 }, host);
      expect(s.CI).toBe(0);
      s = apply(s, { t: 'nudge', d: -1 }, host);
      expect(s.CI).toBe(0);
      expect([holdSteps(undefined), holdSteps(200), holdSteps(379), holdSteps(455)]).toEqual([
        1, 1, 1, 1,
      ]);
    });
  });

  describe('WHEN a guess is locked in and Next is tapped', () => {
    it('THEN it scores, a Next too soon is ignored, and the next question comes', () => {
      const { h, host } = testHost();
      let s = apply(init(reckon2, null, 0), { t: 'play' }, host);
      const a = reckon2.qs[0]!.a;
      const lad = ladderOf(s);
      const best = lad.reduce(
        (b, v, i) => (Math.abs(Math.log10(v / a)) < Math.abs(Math.log10(lad[b]! / a)) ? i : b),
        0,
      );
      s = apply(s, { t: 'drag', fr: fractionOf(s, best) }, host);
      s = apply(s, { t: 'act' }, host);
      expect(s.R).toMatchObject({ ph: 'r', z: [0], cur: null });
      let v = playView(s);
      expect(v.feedback).toMatchObject({
        verdict: 'Bullseye',
        pts: '+100',
        answer: '299,792',
        unit: 'km/s',
      });
      expect(v.action).toBe('Next');
      expect(v.bands).toHaveLength(4);
      h.t += 300;
      s = apply(s, { t: 'act' }, host);
      expect(s.R!.i).toBe(0);
      h.t += 500;
      s = apply(s, { t: 'act' }, host);
      expect(s.R!.i).toBe(1);
      v = playView(s);
      expect(v).toMatchObject({ qn: '2/10', score: 100, tipHidden: true });
      expect(v.pips[0]).toMatchObject({ zone: 0, view: false, disabled: false });
      expect(v.pips[1]).toMatchObject({ live: true, view: true });
      expect(v.pips[2]!.disabled).toBe(true);
    });
  });

  describe('WHEN an answered question is looked back at', () => {
    it('THEN it shows read-only, and the action goes back to the live question', () => {
      const { h, host } = testHost();
      let s = init(reckon2, null, 0);
      for (const m of [{ t: 'play' }, { t: 'act' }] as Move[]) s = apply(s, m, host);
      h.t += 1000;
      s = apply(s, { t: 'act' }, host);
      s = apply(s, { t: 'nav', d: -1 }, host);
      let v = playView(s);
      expect(v).toMatchObject({
        qn: '1/10',
        reviewing: 'Reviewing',
        action: 'Back to question 2',
        nudgeDisabled: true,
      });
      const at = s.CI;
      s = apply(s, { t: 'drag', fr: 0.1 }, host);
      s = apply(s, { t: 'nudge', d: 1 }, host);
      expect(s.CI).toBe(at); // a reviewed question can't be changed
      s = apply(s, { t: 'pip', k: 1 }, host);
      expect(s.Q).toBe(1);
      s = apply(s, { t: 'pip', k: 5 }, host);
      expect(s.Q).toBe(1);
      s = apply(s, { t: 'nav', d: -1 }, host);
      s = apply(s, { t: 'act' }, host);
      v = playView(s);
      expect(v).toMatchObject({ qn: '2/10', guessing: true, reviewing: null });
    });
  });

  describe('WHEN it is paused, left, and resumed', () => {
    it('THEN paused time doesn’t count, Back to start keeps the round, Resume returns to it', () => {
      const { h, host } = testHost();
      let s = apply(init(reckon2, null, 0), { t: 'play' }, host);
      frame(s, 1016);
      frame(s, 1032);
      expect(s.R!.secs).toBeCloseTo(0.032, 9);
      s = apply(s, { t: 'pause' }, host);
      frame(s, 5000);
      expect(s.R!.secs).toBeCloseTo(0.032, 9);
      s = apply(s, { t: 'act' }, host);
      expect(s.R!.ph).toBe('g');
      h.t = 9000;
      s = apply(s, { t: 'quit' }, host);
      expect(s.view).toBe('home');
      expect(homeView(s, '2026-10-21', dayBefore)).toMatchObject({
        status: 'Question 1 of 10, 0 points so far.',
        button: 'Resume',
      });
      s = apply(s, { t: 'play' }, host);
      expect(s.view).toBe('play');
      expect(s.last).toBe(9000);
      frame(s, 99_000);
      expect(s.R!.secs).toBeCloseTo(0.282, 9); // at most a quarter of a second a frame
      s = apply(s, { t: 'pause' }, host);
      s = apply(s, { t: 'resume' }, host);
      expect(s.paused).toBe(false);
    });
  });

  describe('WHEN the tenth is locked in and Next tapped', () => {
    it('THEN the round is ready to finish', () => {
      const { h, host } = testHost();
      let s = apply(init(reckon2, null, 0), { t: 'play' }, host);
      for (let i = 0; i < 10; i++) {
        s = apply(s, { t: 'act' }, host);
        h.t += 1000;
        if (i === 9) expect(playView(s).action).toBe('See result');
        s = apply(s, { t: 'act' }, host);
      }
      expect(s.finishing).toBe(true);
    });
  });
});

describe('GIVEN a finished round', () => {
  const rec = (z: number[], g: number[]) => ({
    p: 0,
    b: z.filter((x) => x === 0).length,
    z,
    g,
    secs: 60,
  });
  const ans = reckon2.qs.map((q) => q.a);

  it('THEN the note counts bullseyes and spot-on guesses, or names the closest miss', () => {
    expect(noteFor(reckon2, rec(Array(10).fill(0), ans))).toBe('Ten bullseyes. Perfect.');
    const g = ans.map((a, i) => (i < 3 ? a : a * 1.1));
    expect(noteFor(reckon2, rec([0, 0, 0, 0, 1, 1, 1, 1, 1, 1], g))).toBe(
      'Four bullseyes, three of them spot on.',
    );
    expect(
      noteFor(
        reckon2,
        rec(
          [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          ans.map((a, i) => (i ? a * 1.1 : a)),
        ),
      ),
    ).toBe('One bullseye, and it was spot on.');
    expect(noteFor(reckon2, rec([0, 0, 0, 1, 1, 1, 1, 1, 1, 1], g))).toBe(
      'Three bullseyes, all spot on.',
    );
    expect(
      noteFor(
        reckon2,
        rec(
          [0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
          ans.map((a, i) => (i ? a * 1.1 : a)),
        ),
      ),
    ).toBe('Five bullseyes, one of them spot on.');
    expect(
      noteFor(
        reckon2,
        rec(
          [0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
          g.map((x) => x * 1.12),
        ),
      ),
    ).toBe('Two bullseyes.');
    expect(
      noteFor(
        reckon2,
        rec(
          Array(10).fill(1),
          ans.map((a) => a * 1.2),
        ),
      ),
    ).toBe('No bullseyes today. Your closest was 20% out.');
  });

  it('THEN the recap lists each question with the guess, the answer and the points', () => {
    const rows = recapRows(
      reckon2,
      rec(
        Array(10).fill(4),
        ans.map((a) => a * 10),
      ),
    );
    expect(rows[0]).toEqual({
      q: reckon2.qs[0]!.q,
      line: 'You 3 million km/s · answer 299,792 km/s',
      pts: 0,
      z: 4,
    });
  });

  it('THEN a recap row reopens its question for review, and Back to results returns', () => {
    const { host } = testHost();
    let s = init(
      reckon2,
      { v: 1, done: { [reckon2.id]: { ...rec(Array(10).fill(2), ans), p: 500 } } },
      0,
    );
    expect(s.view).toBe('winModal');
    s = apply(s, { t: 'recap', k: 3 }, host);
    expect(playView(s)).toMatchObject({
      qn: '4/10',
      reviewing: 'Reviewing your round',
      action: 'Back to results',
      pauseHidden: true,
    });
    s = apply(s, { t: 'pip', k: 9 }, host);
    expect(s.Q).toBe(9);
    s = apply(s, { t: 'pause' }, host);
    expect(s.paused).toBe(false);
    s = apply(s, { t: 'act' }, host);
    expect(s.view).toBe('winModal');
  });

  it('THEN a reload is the caller’s to make', () => {
    const { host } = testHost();
    expect(() => apply(init(reckon2, null, 0), { t: 'reload' }, host)).toThrow();
  });
});
