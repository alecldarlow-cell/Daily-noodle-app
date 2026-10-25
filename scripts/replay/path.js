/**
 * Path's half of scripts/replay.js: its pages, controls (a tap on a square, Undo and
 * Hint: the controls a phone has), board reader and finish reader.
 */
const model = require('../../src/features/puzzles/path/model.ts');
const { scenario, startAt, VARIANTS } = require('../../src/features/puzzles/path/oracle.ts');
const { simulate } = require('../../src/features/puzzles/path/simulate.ts');

/** The board as the page paints it, in simulate.ts's snapshot shape. */
const webSnapshot = (p) =>
  p.evaluate(() => {
    const cells = [...document.querySelectorAll('#grid .cell')].map((c) => {
      const has = (k) => c.classList.contains(k);
      return (
        ((c.querySelector('.num').textContent || '').trim() || '.') +
        (has('active') ? '*' : has('endsel') ? '^' : '') +
        (has('shake') ? '~' : '')
      );
    });
    return {
      cells: cells.join(' '),
      lines: [...document.querySelectorAll('#lines polyline')].map(
        (l) => `${l.getAttribute('stroke')} ${l.getAttribute('points')}`,
      ),
      msg: document.getElementById('msg').textContent,
      timer: document.getElementById('timer').textContent,
      streak: document.getElementById('streakn').textContent,
      sheet: !!document.querySelector('#modal.fin-open'),
    };
  });

async function drive(p, move, H) {
  switch (move.t) {
    case 'cell':
      return H.tap(p, p.locator('#grid .cell').nth(move.r * 6 + move.c));
    case 'undo':
      return H.tap(p, p.locator('#undoBtn'));
    case 'hint':
      return H.tap(p, p.locator('#hintBtn'));
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
      save: ls('digi-path-v1'),
      streak: ls('digi-path-streak'),
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      hero: txt('#statTime'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      stats: [...document.querySelectorAll('.fin-stats > div > b')].map((b) =>
        (b.textContent || '').trim(),
      ),
      open: !!document.querySelector('#modal.fin-open'),
    };
  });

module.exports = {
  type: 'path',
  label: 'Path',
  pattern: /^(\d{4}-\d{2}-\d{2})-logic-path(?:-\d+)?\.html$/,
  VARIANTS,
  validate: model.validate,
  scenario,
  startAt,
  native: (pg, sc, t) => simulate(pg.data, sc, t.openAt, t.playAt, t.firstAt, pg.date),
  webSnapshot,
  drive,
  finishRead,
  finalPairs: (w, n) => [
    ['digi-path-v1', w.save, n.save],
    ['digi-path-streak', w.streak, n.streak],
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
  refused: (p) => p.evaluate(() => document.querySelectorAll('#grid .cell').length !== 36),
};
