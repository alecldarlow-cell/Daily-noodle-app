/**
 * Sweep's half of scripts/replay.js: its pages, controls (a tap on a square, a long
 * press, Dig and Flag, Hint, and the finish sheet's Play again: the controls a phone
 * has), board reader and finish reader.
 */
const model = require('../../src/features/puzzles/sweep/model.ts');
const {
  scenario,
  startAt,
  VARIANTS,
  PRESS_HOLD_MS,
} = require('../../src/features/puzzles/sweep/oracle.ts');
const { simulate } = require('../../src/features/puzzles/sweep/simulate.ts');

/** The board as the page paints it, in simulate.ts's snapshot shape. */
const webSnapshot = (p) =>
  p.evaluate(() => {
    const cells = [...document.querySelectorAll('#grid .cell')].map((c) => {
      const has = (k) => c.classList.contains(k);
      const v = c.querySelector('.val');
      let code;
      if (has('boom')) code = 'x';
      else if (has('open'))
        code = 'o' + (v.textContent || '') + (v.classList.contains('over') ? '~' : '');
      else if (has('flag')) code = 'f';
      else code = 'h' + (has('locked') ? 'L' : '');
      return code + (has('hint') ? '!' : '') + (has('why') ? '@' : '');
    });
    const left = document.getElementById('mleft');
    return {
      cells: cells.join(' '),
      left: left.textContent,
      neg: left.classList.contains('neg'),
      flagMode: document.getElementById('modeFlag').classList.contains('on'),
      msg: (document.getElementById('msg').textContent || '').trim(),
      rank: document.getElementById('rank').textContent,
      timer: document.getElementById('timer').textContent,
      streak: document.getElementById('streak').textContent,
      win: document.body.classList.contains('win'),
      sheet: !!document.querySelector('#winModal.fin-open'),
    };
  });

/** A long press: down, held on the fake clock past the page's 350 ms, a little jitter, up. */
async function press(p, loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox();
  if (!b) throw new Error('press: element not visible');
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await p.mouse.move(x, y);
  await p.mouse.down();
  await p.mouse.move(x + 1.5, y - 1);
  await p.clock.runFor(PRESS_HOLD_MS);
  await p.mouse.move(x + 2, y + 1);
  await p.mouse.up();
}

async function drive(p, move, H) {
  const cell = (i) => p.locator('#grid .cell').nth(i);
  switch (move.t) {
    case 'tap':
      return H.tap(p, cell(move.i));
    case 'press':
      return press(p, cell(move.i));
    case 'mode':
      return H.tap(p, p.locator(move.flag ? '#modeFlag' : '#modeDig'));
    case 'hint':
      return H.tap(p, p.locator('#hint'));
    case 'again':
      return H.tap(p, p.locator('.fin > .fin-link').first());
    default:
      throw new Error(`replay: no control for move ${JSON.stringify(move)}`);
  }
}

const finishRead = (p) =>
  p.evaluate(() => {
    const ls = (k) => {
      try {
        return JSON.parse(localStorage.getItem(k));
      } catch (_e) {
        return null;
      }
    };
    const txt = (sel) => ((document.querySelector(sel) || {}).textContent || '').trim();
    return {
      save: ls('digi-sweep-v1'),
      streak: ls('digi-sweep-streak'),
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      hero: txt('#winTime'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      stats: [...document.querySelectorAll('.fin-stats > div > b')].map((b) =>
        (b.textContent || '').trim(),
      ),
      again: txt('.fin > .fin-link') === 'Play again (not recorded)',
      bar: [txt('#streak'), txt('#best')],
      open: !!document.querySelector('#winModal.fin-open'),
    };
  });

module.exports = {
  type: 'sweep',
  label: 'Sweep',
  pattern: /^(\d{4}-\d{2}-\d{2})-logic-sweep(?:-\d+)?\.html$/,
  VARIANTS,
  validate: model.validate,
  scenario,
  startAt,
  native: (pg, sc, t) => simulate(pg.data, sc, t.openAt, t.firstAt, pg.date, pg.n),
  webSnapshot,
  drive,
  finishRead,
  finalPairs: (w, n) => [
    ['digi-sweep-v1', w.save, n.save],
    ['digi-sweep-streak', w.streak, n.streak],
    ['share line', w.share, n.share],
    ['finish note', w.note, n.note],
    ['finish kicker', w.kick, n.kick],
    ['Play again offered', w.again, n.again],
    ...(n.round === 1
      ? [
          ['finish time', w.hero, n.hero],
          ['finish title', w.title, n.title],
          ['finish stats', w.stats, n.stats],
        ]
      : // Site defect (25 Oct 2026): after Play again, finish.js show() removes the first
        // sheet with the #winTitle, #winTime, #winStreak and #winBest it adopted, so the
        // replay round's sheet shows no title, time or streaks. The native sheet shows
        // them: the time is checked in #msg on every move, the streaks here from the
        // page's own #streak and #best, and the title must be the page's empty one.
        [
          ['replay-round sheet: the page drops its title and time', [w.title, w.hero], ['', '']],
          ['replay-round streaks (#streak, #best) and played', [...w.bar, w.stats[2]], n.stats],
        ]),
  ],
  reopenPairs: (r, nr) => [
    ['reopened share line', r.share, nr.share],
    ['reopened note', r.note, nr.note],
    ['reopened time', r.hero, nr.hero],
    ['reopened title', r.title, nr.title],
    ['reopened stats', r.stats, nr.stats],
    ['reopened: Play again offered', r.again, nr.again],
  ],
  refused: (p) =>
    p.evaluate(
      () =>
        document.querySelectorAll('#grid .cell').length !== 36 ||
        /Refused to render/.test((document.querySelector('main') || {}).textContent || ''),
    ),
};
