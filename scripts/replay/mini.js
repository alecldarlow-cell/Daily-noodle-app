/**
 * The Mini's half of scripts/replay.js: its pages, controls (squares, the on-screen
 * keyboard, the clue bar, ‹ ›, Check word, Check all, Reveal word: the controls a
 * phone has), board reader and finish reader.
 */
const model = require('../../src/features/puzzles/mini/model.ts');
const { scenario, startAt, VARIANTS } = require('../../src/features/puzzles/mini/oracle.ts');
const { simulate } = require('../../src/features/puzzles/mini/simulate.ts');

const KB = 'QWERTYUIOPASDFGHJKLZXCVBNM';

/** The board as the page paints it, in simulate.ts's snapshot shape. */
const webSnapshot = (p) =>
  p.evaluate(() => {
    const cells = [...document.querySelectorAll('#grid .cell')].map((c) => {
      if (c.classList.contains('block')) return '#';
      const l = (c.querySelector('.ltr').textContent || '').trim() || '.';
      const has = (k) => c.classList.contains(k);
      return (
        l +
        (has('active') ? '*' : '') +
        (has('inword') ? '+' : '') +
        (has('good') ? 'g' : has('bad') ? 'b' : '')
      );
    });
    return {
      cells: cells.join(' '),
      bar: (document.getElementById('cluebar').textContent || '').trim(),
      timer: document.getElementById('timer').textContent,
      win: document.body.classList.contains('win'),
    };
  });

async function drive(p, move, H) {
  const tap = (loc) => H.tap(p, loc);
  switch (move.t) {
    case 'cell':
      return tap(p.locator('#grid .cell').nth(move.r * 5 + move.c));
    case 'key':
      return tap(p.locator('#kb .key').nth(KB.indexOf(move.ch.toUpperCase())));
    case 'del':
      return tap(p.locator('#kb .key').nth(26));
    case 'bar':
      return tap(p.locator('#cluebar'));
    case 'step':
      return tap(p.locator(move.delta > 0 ? '#nextClue' : '#prevClue'));
    case 'checkWord':
    case 'checkAll':
    case 'revealWord':
      return tap(p.locator(`#${move.t}`));
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
      save: ls('digi-mini-v1'),
      streak: ls('digi-mini-streak'),
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      hero: txt('#winTime'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      stats: [...document.querySelectorAll('.fin-stats > div > b')].map((b) =>
        (b.textContent || '').trim(),
      ),
      open: !!document.querySelector('#winModal.fin-open'),
    };
  });

module.exports = {
  type: 'mini',
  label: 'Mini',
  pattern: /^(\d{4}-\d{2}-\d{2})-crossword-mini(?:-\d+)?\.html$/,
  VARIANTS,
  validate: model.validate,
  scenario,
  startAt,
  native: (pg, sc, t) => simulate(pg.data, sc, t.firstAt, pg.date),
  webSnapshot,
  drive,
  finishRead,
  finalPairs: (w, n) => [
    ['digi-mini-v1', w.save, n.save],
    ['digi-mini-streak', w.streak, n.streak],
    ['share line', w.share, n.share],
    ['finish note', w.note, n.note],
    ['finish time', w.hero, n.hero],
    ['finish title', w.title, n.title],
    ['finish kicker', w.kick, n.kick],
    ['finish stats', w.stats, n.stats],
  ],
  reopenPairs: (r, nr) => [
    ['reopened share line', r.share, nr.share],
    ['reopened note', r.note, nr.note],
    ['reopened time', r.hero, nr.hero],
    ['reopened stats', r.stats, nr.stats],
  ],
  refused: async (p) => (await p.locator('#grid .cell').count()) !== 25,
};
