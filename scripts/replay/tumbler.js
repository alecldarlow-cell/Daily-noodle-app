/**
 * Tumbler's half of scripts/replay.js: its pages, controls (each wheel's down arrow and
 * Submit: the controls a phone has), board reader and finish reader.
 */
const model = require('../../src/features/puzzles/tumbler/model.ts');
const { scenario, startAt, VARIANTS } = require('../../src/features/puzzles/tumbler/oracle.ts');
const { simulate } = require('../../src/features/puzzles/tumbler/simulate.ts');

/** The board as the page paints it, in simulate.ts's snapshot shape. */
const webSnapshot = (p) =>
  p.evaluate(() => ({
    wheels: [...document.querySelectorAll('#board .wheel')].map((w) =>
      [...w.children].map((t) => t.textContent).join(''),
    ),
    tries: [...document.querySelectorAll('#tries .r')].map(
      (r) =>
        [...r.querySelectorAll('b')].map((b) => b.textContent + b.className).join('') +
        '|' +
        (r.querySelector('small') || {}).textContent,
    ),
    msg: document.getElementById('msg').textContent,
    timer: document.getElementById('timer').textContent,
    streak: document.getElementById('streakn').textContent,
    sheet: !!document.querySelector('#modal.fin-open'),
  }));

async function drive(p, move, H) {
  switch (move.t) {
    case 'turn':
      return H.tap(p, p.locator(`#down${move.k + 1}`));
    case 'submit':
      return H.tap(p, p.locator('#submitBtn'));
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
      save: ls('digi-tumbler-v1'),
      streak: ls('digi-tumbler-streak'),
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      hero: txt('#statTime'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      recap: [...document.querySelectorAll('.fin-tumbler .r')].map((r) =>
        [...r.querySelectorAll('b')]
          .map((b) => b.textContent)
          .join('')
          .toLowerCase(),
      ),
      open: !!document.querySelector('#modal.fin-open'),
    };
  });

module.exports = {
  type: 'tumbler',
  label: 'Tumbler',
  pattern: /^(\d{4}-\d{2}-\d{2})-word-tumbler(?:-\d+)?\.html$/,
  VARIANTS,
  validate: model.validate,
  scenario,
  startAt,
  native: (pg, sc, t) => simulate(pg.data, sc, t.openAt, t.playAt, t.firstAt),
  webSnapshot,
  drive,
  finishRead,
  finalPairs: (w, n) => [
    ['digi-tumbler-v1', w.save, n.save],
    ['digi-tumbler-streak', w.streak, n.streak],
    ['share line', w.share, n.share],
    ['finish note', w.note, n.note],
    ['finish time', w.hero, n.hero],
    ['finish title', w.title, n.title],
    ['finish kicker', w.kick, n.kick],
    ['finish recap', w.recap, n.recap],
  ],
  reopenPairs: (r, nr) => [
    ['reopened share line', r.share, nr.share],
    ['reopened note', r.note, nr.note],
    ['reopened time', r.hero, nr.hero],
    ['reopened recap', r.recap, nr.recap],
  ],
  refused: (p) => p.evaluate(() => document.querySelectorAll('#board .wheel').length === 0),
};
