/**
 * Cryptic's half of scripts/replay.js: its pages, controls (the on-screen keys, Enter, Delete,
 * Hint, Clear and the squares: the controls a phone has), board reader and finish reader.
 */
const model = require('../../src/features/puzzles/cryptic/model.ts');
const { scenario, startAt, VARIANTS } = require('../../src/features/puzzles/cryptic/oracle.ts');
const { simulate } = require('../../src/features/puzzles/cryptic/simulate.ts');

/** The board as the page paints it, in simulate.ts's snapshot shape. */
const webSnapshot = (p) =>
  p.evaluate(() => {
    const sq = [...document.querySelectorAll('#grid .sq')];
    const panel = document.getElementById('hintPanel');
    const txt = (sel) => ((panel.querySelector(sel) || {}).textContent || '').trim();
    return {
      letters: sq.map((b) => b.textContent),
      cur: sq.findIndex((b) => b.classList.contains('cur')),
      locks: sq.filter((b) => b.classList.contains('lock')).length,
      def: [...document.querySelectorAll('#clue .cr-d')].map((e) => e.textContent).join(''),
      hint: document.getElementById('hintBtn').textContent.trim(),
      hintOff: document.getElementById('hintBtn').disabled,
      panel: panel.hidden ? '' : `${txt('.cr-chip')}|${txt('.cr-tip')}|${txt('.cr-used')}`,
      msg: document.getElementById('msg').textContent,
      timer: document.getElementById('timer').textContent,
      streak: document.getElementById('streakn').textContent,
      sheet: !!document.querySelector('#winModal.fin-open'),
    };
  });

async function drive(p, move, H) {
  switch (move.t) {
    case 'type':
      return H.tap(p, p.locator(`#kb .key[data-k="${move.ch}"]`));
    case 'del':
      return H.tap(p, p.locator('#kDel'));
    case 'enter':
      return H.tap(p, p.locator('#kEnter'));
    case 'hint':
      return H.tap(p, p.locator('#hintBtn'));
    case 'clear':
      return H.tap(p, p.locator('#clearBtn'));
    case 'select':
      return H.tap(p, p.locator('#grid .sq').nth(move.i));
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
      save: ls('digi-cryptic-v1'),
      streak: ls('digi-cryptic-streak'),
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      hero: txt('#winTime'),
      hints: txt('#rHints'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      recap: [
        txt('.fin-cryptic .cr-rc-tiles'),
        ...[...document.querySelectorAll('.fin-cryptic dd')].map((d) => d.textContent.trim()),
        txt('.fin-cryptic .cr-rc-type'),
      ],
      open: !!document.querySelector('#winModal.fin-open'),
    };
  });

module.exports = {
  type: 'cryptic',
  label: 'Cryptic',
  pattern: /^(\d{4}-\d{2}-\d{2})-word-cryptic(?:-\d+)?\.html$/,
  VARIANTS,
  validate: model.validate,
  scenario,
  startAt,
  native: (pg, sc, t) => simulate(pg.data, sc, t.openAt, t.playAt, t.firstAt),
  webSnapshot,
  drive,
  finishRead,
  finalPairs: (w, n) => [
    ['digi-cryptic-v1', w.save, n.save],
    ['digi-cryptic-streak', w.streak, n.streak],
    ['share line', w.share, n.share],
    ['finish note', w.note, n.note],
    ['finish time', w.hero, n.hero],
    ['finish hints', w.hints, n.hints],
    ['finish title', w.title, n.title],
    ['finish kicker', w.kick, n.kick],
    ['finish recap', w.recap, n.recap],
  ],
  reopenPairs: (r, nr) => [
    ['reopened share line', r.share, nr.share],
    ['reopened time', r.hero, nr.hero],
    ['reopened hints', r.hints, nr.hints],
    ['reopened recap', r.recap, nr.recap],
  ],
  refused: (p) => p.evaluate(() => document.querySelectorAll('#grid .sq').length === 0),
};
