/**
 * Redact's half of scripts/replay.js: its pages, controls (a tap on a letter, Undo and Clear:
 * the controls a phone has), board reader and finish reader.
 */
const model = require('../../src/features/puzzles/redact/model.ts');
const { scenario, startAt, VARIANTS } = require('../../src/features/puzzles/redact/oracle.ts');
const { simulate } = require('../../src/features/puzzles/redact/simulate.ts');

/** The board as the page paints it, in simulate.ts's snapshot shape. */
const webSnapshot = (p) =>
  p.evaluate(() => {
    const cells = [...document.querySelectorAll('#grid .cell')].map(
      (c) =>
        (c.textContent || '').trim() +
        (c.classList.contains('black') ? '#' : '') +
        (c.classList.contains('good') ? 'g' : ''),
    );
    return {
      cells: cells.join(' '),
      count: document.getElementById('count').textContent,
      undoOff: document.getElementById('undoBtn').disabled,
      clearOff: document.getElementById('clearBtn').disabled,
      msg: document.getElementById('msg').textContent,
      timer: document.getElementById('timer').textContent,
      streak: document.getElementById('streakn').textContent,
      sheet: !!document.querySelector('.fin-box.fin-open'),
    };
  });

async function drive(p, move, H) {
  switch (move.t) {
    case 'cell':
      return H.tap(p, p.locator('#grid .cell').nth(move.i));
    case 'undo':
      return H.tap(p, p.locator('#undoBtn'));
    case 'clear':
      return H.tap(p, p.locator('#clearBtn'));
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
      save: ls('digi-redact-v1'),
      streak: ls('digi-redact-streak'),
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      hero: txt('#statTime'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      streakLine: txt('.fin-streak'),
      open: !!document.querySelector('.fin-box.fin-open'),
    };
  });

module.exports = {
  type: 'redact',
  label: 'Redact',
  pattern: /^(\d{4}-\d{2}-\d{2})-word-redact(?:-\d+)?\.html$/,
  VARIANTS,
  validate: model.validate,
  scenario,
  startAt,
  native: (pg, sc, t) => simulate(pg.data, sc, t.openAt, t.playAt, t.firstAt),
  webSnapshot,
  drive,
  finishRead,
  finalPairs: (w, n) => [
    ['digi-redact-v1', w.save, n.save],
    ['digi-redact-streak', w.streak, n.streak],
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
  refused: (p) =>
    p.evaluate(() => /failed its check/.test(document.getElementById('msg').textContent || '')),
};
