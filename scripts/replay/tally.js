/**
 * Tally's half of scripts/replay.js: its pages, controls (a tap on a square, the keypad,
 * Notes, Erase and Undo: the controls a phone has), board reader and finish reader.
 */
const model = require('../../src/features/puzzles/tally/model.ts');
const { scenario, startAt, VARIANTS } = require('../../src/features/puzzles/tally/oracle.ts');
const { simulate } = require('../../src/features/puzzles/tally/simulate.ts');

/** The board as the page paints it, in simulate.ts's snapshot shape. */
const webSnapshot = (p) =>
  p.evaluate(() => {
    const cells = [...document.querySelectorAll('#grid .cell')].map((c) => {
      const has = (k) => c.classList.contains(k);
      const notes = [...c.querySelectorAll('.notes span')].reduce(
        (bits, s, i) => (s.classList.contains('on') ? bits | (1 << (i + 1)) : bits),
        0,
      );
      const clue = c.querySelector('.clue');
      const cs = clue && clue.classList;
      return (
        ((c.querySelector('.val').textContent || '').trim() || '.') +
        (has('bad') ? '!' : '') +
        (has('sel') ? '*' : '') +
        (has('cage') ? 'c' : '') +
        (has('peer') ? 'p' : '') +
        (has('same') ? '=' : '') +
        (notes ? `n${notes}` : '') +
        (cs && cs.contains('ok') ? ':ok' : cs && cs.contains('bad') ? ':bad' : '')
      );
    });
    return {
      cells: cells.join(' '),
      notesOn: document.getElementById('notesBtn').getAttribute('aria-pressed') === 'true',
      undoOff: document.getElementById('undoBtn').disabled,
      msg: document.getElementById('msg').textContent,
      timer: document.getElementById('timer').textContent,
      streak: document.getElementById('streakn').textContent,
      sheet: !!document.querySelector('#modal.fin-open'),
    };
  });

async function drive(p, move, H) {
  switch (move.t) {
    case 'cell':
      return H.tap(p, p.locator('#grid .cell').nth(move.i));
    case 'digit':
      return H.tap(p, p.locator('#keys button').nth(move.d - 1));
    case 'notes':
      return H.tap(p, p.locator('#notesBtn'));
    case 'erase':
      return H.tap(p, p.locator('#eraseBtn'));
    case 'undo':
      return H.tap(p, p.locator('#undoBtn'));
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
      save: ls('digi-tally-v1'),
      streak: ls('digi-tally-streak'),
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      hero: txt('#statTime'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      streakLine: txt('.fin-streak'),
      open: !!document.querySelector('#modal.fin-open'),
    };
  });

module.exports = {
  type: 'tally',
  label: 'Tally',
  pattern: /^(\d{4}-\d{2}-\d{2})-logic-tally(?:-\d+)?\.html$/,
  VARIANTS,
  validate: model.validate,
  scenario,
  startAt,
  native: (pg, sc, t) => simulate(pg.data, sc, t.openAt, t.playAt, t.firstAt),
  webSnapshot,
  drive,
  finishRead,
  finalPairs: (w, n) => [
    ['digi-tally-v1', w.save, n.save],
    ['digi-tally-streak', w.streak, n.streak],
    ['share line', w.share, n.share],
    ['finish note', w.note, n.note],
    ['finish time', w.hero, n.hero],
    ['finish title', w.title, n.title],
    ['finish kicker', w.kick, n.kick],
    ['finish streak line', w.streakLine, n.streakLine],
  ],
  reopenPairs: (r, nr) => [
    ['reopened share line', r.share, nr.share],
    ['reopened note', r.note, nr.note],
    ['reopened time', r.hero, nr.hero],
    ['reopened streak line', r.streakLine, nr.streakLine],
  ],
  refused: (p) => p.evaluate(() => document.querySelectorAll('#grid .cell').length !== 16),
};
