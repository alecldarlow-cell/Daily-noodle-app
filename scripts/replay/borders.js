/**
 * Borders' half of scripts/replay.js: its pages, controls (Play / Resume, the four
 * names, Show on map, Next / See result, Pause, Resume, Back to start; a reload closes
 * and reopens the page), board reader and finish reader. The clock is timed by the
 * page's animation frames, as Reckon's is (see replay/reckon.js).
 */
const model = require('../../src/features/puzzles/borders/model.ts');
const { scenario, startAt, VARIANTS } = require('../../src/features/puzzles/borders/oracle.ts');
const { simulate } = require('../../src/features/puzzles/borders/simulate.ts');

const webSnapshot = async (p) => {
  const saved = p.__reloaded;
  p.__reloaded = false;
  return p.evaluate((saved) => {
    const $ = (id) => document.getElementById(id);
    const tx = (id) => ($(id).textContent || '').trim();
    const vis = ([...document.querySelectorAll('.screen.vis')][0] || {}).id || '';
    const out = { view: vis, paused: $('pause').classList.contains('on') };
    if (vis === 'home')
      out.home = {
        date: tx('dateLine'),
        status: tx('playStatus'),
        button: tx('playGo'),
        stats: [...document.querySelectorAll('#hStats b')].map((b) => b.textContent),
      };
    if (vis === 'quiz') {
      const land = document.querySelector('#qmap .land');
      const hint = $('hintBtn');
      const mark = (b) =>
        b.classList.contains('right')
          ? 'right'
          : b.classList.contains('wrong')
            ? 'wrong'
            : b.classList.contains('dim')
              ? 'dim'
              : '';
      out.quiz = {
        ticks: [...$('ticks').children].map((i) => i.className).join(' '),
        pts: tx('pts'),
        plate: tx('nameplate'),
        opts: [...document.querySelectorAll('#opts .opt')].map(
          (b) => `${b.textContent}:${mark(b)}`,
        ),
        hint: (hint.hidden ? 'hidden' : 'shown') + (hint.disabled ? ' disabled' : ''),
        next: $('nextBtn').hidden ? '' : tx('nextBtn'),
        inset: $('inset').classList.contains('on'),
        coach: $('coach').classList.contains('off'),
        revealed: $('sheet').classList.contains('revealed'),
        land: land ? land.getAttribute('d') : '',
        fill: land ? land.getAttribute('fill') : '',
      };
    }
    if (saved) {
      try {
        out.saved = JSON.parse(localStorage.getItem('digi-borders-v1'));
      } catch (_e) {
        out.saved = null;
      }
    }
    return out;
  }, saved);
};

async function drive(p, move, H) {
  const tap = (sel, k = 0) => H.tap(p, p.locator(sel).nth(k));
  switch (move.t) {
    case 'play':
      return tap('#playCard');
    case 'answer':
      return tap('#opts .opt', move.k);
    case 'hint':
      return tap('#hintBtn');
    case 'next':
      return tap('#nextBtn');
    case 'pause':
      return tap('#pauseBtn');
    case 'resume':
      return tap('#resumePause');
    case 'quit':
      return tap('#quitBtn');
    case 'reload':
      await p.reload();
      p.__reloaded = true;
      return;
    default:
      throw new Error(`replay: no control for move ${JSON.stringify(move)}`);
  }
}

const finishRead = (p) =>
  p.evaluate(() => {
    const txt = (sel) => ((document.querySelector(sel) || {}).textContent || '').trim();
    const ls = (k) => {
      try {
        return JSON.parse(localStorage.getItem(k));
      } catch (_e) {
        return null;
      }
    };
    return {
      save: ls('digi-borders-v1'),
      atlas: ls('digi-borderline-v1'),
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      hero: txt('#rBig'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      // AF-019 (site #40): the three stats became one line under the score
      streakLine: txt('.fin-streak'),
      tiles: [...document.querySelectorAll('.fin-outl figure')].map(
        (f) => `${f.className}:${f.querySelector('figcaption').textContent}`,
      ),
      open: !!document.querySelector('#winModal.fin-open'),
    };
  });

module.exports = {
  type: 'borders',
  label: 'Borders',
  pattern: /^(\d{4}-\d{2}-\d{2})-geo-borders-\d+\.html$/,
  VARIANTS,
  validate: (d) => model.validate(d),
  scenario,
  startAt,
  probe: (p, t) => p.evaluate((t) => performance.now() - (Date.now() - t), t),
  begin: async () => {},
  native: (pg, sc, t) => simulate(pg.data, sc, t.openAt, t.probe, t.firstAt - t.openAt),
  webSnapshot,
  drive,
  finishRead,
  finalPairs: (w, n) => [
    ['digi-borders-v1', w.save, n.save],
    ['digi-borderline-v1 (the atlas)', w.atlas, n.atlas],
    ['share line', w.share, n.share],
    ['finish note', w.note, n.note],
    ['finish result', w.hero, n.hero],
    ['finish title', w.title, n.title],
    ['finish kicker', w.kick, n.kick],
    ['finish streak line', w.streakLine, n.streakLine],
    ['recap outlines', w.tiles, n.tiles],
  ],
  reopenPairs: (r, nr) => [
    ['reopened share line', r.share, nr.share],
    ['reopened note', r.note, nr.note],
    ['reopened result', r.hero, nr.hero],
    ['reopened streak line', r.streakLine, nr.streakLine],
    ['reopened outlines', r.tiles, nr.tiles],
  ],
  refused: (p) => p.evaluate(() => !!(window.__bordersGate && window.__bordersGate.length)),
};
