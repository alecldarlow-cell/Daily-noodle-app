/**
 * Reckon's half of scripts/replay.js: its pages, controls (Play / Resume, the scale
 * dragged with the pointer, − and + tapped or held, Lock in / Next, ‹ ›, the pips,
 * Pause, Resume, Back to start, the recap rows; a reload closes and reopens the page),
 * board reader and finish reader.
 *
 * The page's active-time clock adds up animation frames, which the paused browser
 * clock fires every 16 ms of `performance.now()`. That clock starts a few ms off the
 * wall clock (real time passes while Playwright installs it), so `probe` reads the
 * offset once the page has opened and the native side plays on the same frames.
 */
const model = require('../../src/features/puzzles/reckon/model.ts');
const { scenario, startAt, VARIANTS } = require('../../src/features/puzzles/reckon/oracle.ts');
const { simulate } = require('../../src/features/puzzles/reckon/simulate.ts');

/** The screen as the page paints it, in simulate.ts's snapshot shape. */
const webSnapshot = async (p) => {
  const saved = p.__reloaded;
  p.__reloaded = false;
  return p.evaluate((saved) => {
    const $ = (id) => document.getElementById(id);
    const tx = (id) => $(id).textContent || '';
    const vis = ([...document.querySelectorAll('.scr.vis')][0] || {}).id || '';
    const out = { view: vis, paused: !$('pause').hidden };
    if (vis === 'home')
      out.home = {
        date: tx('dateLine'),
        streak: tx('homeStreak'),
        status: tx('playStatus'),
        button: tx('playCard'),
        stats: ['sStreak', 'sBest', 'sPlayed'].map(tx),
      };
    if (vis === 'play') {
      const zoneOf = (st) => {
        const m = /--pc:\s*var\(--z(\d|m)\)/.exec(st || '');
        return m ? (m[1] === 'm' ? '4' : m[1]) : '';
      };
      const fb = $('fb');
      out.play = {
        qn: tx('qn'),
        sc: tx('sc'),
        chip: tx('pchip'),
        q: tx('q'),
        ru: tx('ru'),
        rv: tx('rv'),
        now: $('slz').getAttribute('aria-valuenow'),
        text: $('slz').getAttribute('aria-valuetext'),
        prev: $('prevB').disabled,
        fwd: $('fwdB').disabled,
        rvt: $('rvt').hidden ? null : tx('rvt'),
        pauseHidden: $('pauseBtn').style.visibility === 'hidden',
        fb: fb.hidden
          ? null
          : {
              v: tx('fbV'),
              p: tx('fbP'),
              l: tx('fbL'),
              n: $('fbN').hidden ? null : tx('fbN'),
              a: tx('av'),
              u: tx('au'),
            },
        act: tx('act'),
        nudge: $('minus').disabled,
        tip: $('tip').hidden,
        pips: [...$('pips').children]
          .map(
            (b) =>
              (b.classList.contains('view') ? 'v' : '') +
              (b.classList.contains('live') ? 'l' : '') +
              zoneOf(b.getAttribute('style')) +
              (b.disabled ? 'd' : ''),
          )
          .join(' '),
        labs: [...$('labs').children].map((e) => e.textContent).join(' '),
      };
    }
    if (saved) {
      try {
        out.saved = JSON.parse(localStorage.getItem('digi-reckon-v1'));
      } catch (_e) {
        out.saved = null;
      }
    }
    return out;
  }, saved);
};

const centre = async (loc) => {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox();
  if (!b) throw new Error('not visible');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
};

async function drive(p, move, H) {
  const tap = (sel, k = 0) => H.tap(p, p.locator(sel).nth(k));
  switch (move.t) {
    case 'play':
      return tap('#playCard');
    case 'drag': {
      // down a little short of the mark, slide, let go on it: as a finger does
      const { b, y } = await centre(p.locator('#trk'));
      const x = b.x + move.fr * b.width;
      await p.mouse.move(x - 7, y);
      await p.mouse.down();
      await p.mouse.move(x - 3, y - 1);
      await p.mouse.move(x, y + 1);
      return p.mouse.up();
    }
    case 'nudge': {
      const sel = move.d > 0 ? '#plus' : '#minus';
      if (!move.hold) return tap(sel);
      const { x, y } = await centre(p.locator(sel));
      await p.mouse.move(x, y);
      await p.mouse.down();
      await p.clock.runFor(move.hold);
      return p.mouse.up();
    }
    case 'act':
      return tap('#act');
    case 'nav':
      return tap(move.d > 0 ? '#fwdB' : '#prevB');
    case 'pip':
      return tap('#pips button', move.k);
    case 'pause':
      return tap('#pauseBtn');
    case 'resume':
      return tap('#resumeBtn');
    case 'quit':
      return tap('#quitBtn');
    case 'recap':
      return tap('.fin-rk button', move.k);
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
    let save = null;
    try {
      save = JSON.parse(localStorage.getItem('digi-reckon-v1'));
    } catch (_e) {}
    return {
      save,
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      hero: txt('#rBig'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      // AF-019 (site #40): the three stats became one line under the score
      streakLine: txt('.fin-streak'),
      rows: [...document.querySelectorAll('.fin-rk button')].map((b) => b.textContent || ''),
      open: !!document.querySelector('#winModal.fin-open'),
    };
  });

module.exports = {
  type: 'reckon',
  label: 'Reckon',
  pattern: /^(\d{4}-\d{2}-\d{2})-quiz-reckon-\d+\.html$/,
  VARIANTS,
  validate: (d) => model.validate(d),
  scenario,
  startAt,
  /** The page clock's reading at wall time t. */
  probe: (p, t) => p.evaluate((t) => performance.now() - (Date.now() - t), t),
  begin: async () => {},
  native: (pg, sc, t) => simulate(pg.data, sc, t.openAt, t.probe, t.firstAt - t.openAt),
  webSnapshot,
  drive,
  finishRead,
  finalPairs: (w, n) => [
    ['digi-reckon-v1', w.save, n.save],
    ['share line', w.share, n.share],
    ['finish note', w.note, n.note],
    ['finish points', w.hero, n.hero],
    ['finish title', w.title, n.title],
    ['finish kicker', w.kick, n.kick],
    ['finish streak line', w.streakLine, n.streakLine],
    ['recap rows', w.rows, n.rows],
  ],
  reopenPairs: (r, nr) => [
    ['reopened share line', r.share, nr.share],
    ['reopened note', r.note, nr.note],
    ['reopened points', r.hero, nr.hero],
    ['reopened streak line', r.streakLine, nr.streakLine],
    ['reopened recap rows', r.rows, nr.rows],
  ],
  refused: (p) => p.evaluate(() => !!(window.__reckonGate && window.__reckonGate.length)),
};
