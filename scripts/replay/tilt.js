/**
 * Tilt's half of scripts/replay.js: its pages, controls (the two turn buttons and Undo: the
 * controls a phone has), board reader and finish reader.
 */
const model = require('../../src/features/puzzles/tilt/model.ts');
const { scenario, startAt, VARIANTS } = require('../../src/features/puzzles/tilt/oracle.ts');
const { simulate } = require('../../src/features/puzzles/tilt/simulate.ts');

/** The board as the page paints it, in simulate.ts's snapshot shape. */
const webSnapshot = (p) =>
  p.evaluate(() => {
    const cells = [...document.querySelectorAll('#maze .cell')];
    const trail = cells
      .map((c, i) => (c.classList.contains('trail') ? i : -1))
      .filter((i) => i >= 0)
      .join(' ');
    const tr = (document.querySelector('#maze .ballg').getAttribute('transform') || '').match(
      /[-\d.]+/g,
    ) || ['0', '0'];
    const rot = (document.getElementById('maze').style.transform.match(/-?\d+/) || ['0'])[0];
    return {
      trail,
      ball: tr.map((v) => Math.round(Number(v) * 10) / 10).join(' '),
      rot: Number(rot) / 90,
      turns: document.getElementById('turns').textContent,
      undoOff: document.getElementById('undoBtn').disabled,
      msg: document.getElementById('msg').textContent,
      timer: document.getElementById('timer').textContent,
      streak: document.getElementById('streakn').textContent,
      sheet: !!document.querySelector('#modal.fin-open'),
    };
  });

async function drive(p, move, H) {
  switch (move.t) {
    case 'turn':
      return H.tap(p, p.locator(move.dir > 0 ? '#rightBtn' : '#leftBtn'));
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
      save: ls('digi-tilt-v1'),
      streak: ls('digi-tilt-streak'),
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
  type: 'tilt',
  label: 'Tilt',
  pattern: /^(\d{4}-\d{2}-\d{2})-logic-tilt(?:-\d+)?\.html$/,
  VARIANTS,
  validate: model.validate,
  scenario,
  startAt,
  native: (pg, sc, t) => simulate(pg.data, sc, t.openAt, t.playAt, t.firstAt),
  webSnapshot,
  drive,
  finishRead,
  finalPairs: (w, n) => [
    ['digi-tilt-v1', w.save, n.save],
    ['digi-tilt-streak', w.streak, n.streak],
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
  refused: (p) => p.evaluate(() => document.querySelectorAll('#maze .cell').length === 0),
};
