/**
 * Differential replay for Tangle (WP10): the native engine against engines/tangle.js.
 * Run through scripts/replay.js:
 *
 *   node scripts/replay.js --type tangle --sample 20 --site ../dailynoodle
 *   node scripts/replay.js --type tangle --all --site ../dailynoodle [--workers 4] [--only 0019]
 *
 * For every Tangle page in the site clone and every oracle variant
 * (src/features/puzzles/tangle/oracle.ts), the page is played in headless Chromium on a
 * paused fake clock through its real controls: the home card, the board's back arrow,
 * and tracing through the board's own pointer events (press on a tile's centre, one
 * pointermove per tile passed through, release; taps with a touchscreen's jitter). The
 * tiles' rectangles are read from the page before every gesture and handed, with the
 * same points, to the native engine (simulate.ts), which hit-tests and walks them
 * itself. Leaving is a reload (pagehide saves). The phone has no element full screen
 * (as on an iPhone, and in the app), so the count-in is 3-2-1 with no "Ready" beat.
 *
 * After every move the visible screen must match (home: number, date, head, status,
 * button, streak, best, played; board: score, words, star pill, clock and its low mark,
 * the found list, the traced word, lit tiles, the toast, the count-in, the hidden
 * board and the veil) and so must the saved digi-tangle-v1, left to the last float;
 * at the end every dn:puzzle_end and the result sheet (kicker, title, score, note,
 * share line, stats, time, star line, meter, every word list, the rarer words); for
 * reopening variants the reloaded sheet and no second puzzle_end. Pages the model
 * refuses (the engine's GATE) must fail on the web too.
 */
require('./ts-register');

const L = require('./replay-lib');
const model = require('../src/features/puzzles/tangle/model.ts');
const { scenario, VARIANTS, LOAD_MS } = require('../src/features/puzzles/tangle/oracle.ts');
const { simulate } = require('../src/features/puzzles/tangle/simulate.ts');

/** No element full screen: an iPhone's Safari, and the app. */
function noFullscreen() {
  for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled'])
    try {
      Object.defineProperty(Document.prototype, k, { get: () => false, configurable: true });
    } catch (_e) {}
}

const rectsOf = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('#board .tile')].map((t) => {
      const r = t.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }),
  );
const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];

const webSnapshot = (p) =>
  p.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const txt = (id) => ($(id) ? $(id).textContent : '');
    const vis = document.querySelector('.screen.vis');
    const view = vis ? vis.id : '';
    const out = { view, home: null, play: null };
    if (view === 'home')
      out.home = {
        num: txt('numLabel'),
        date: txt('dateLine'),
        head: txt('playHead'),
        status: txt('playStatus'),
        go: txt('playGo'),
        streak: +txt('hStreak'),
        best: +txt('hBest'),
        played: +txt('hPlayed'),
      };
    if (view === 'play') {
      const tiles = [...document.querySelectorAll('#board .tile')];
      const cw = $('curWord');
      out.play = {
        score: +txt('score'),
        words: txt('nWords'),
        star: txt('starPill'),
        clock: txt('clock'),
        low: $('clock').classList.contains('low'),
        list: [...document.querySelectorAll('#list .grp')]
          .map(
            (g) =>
              [...g.querySelectorAll('h3 span')].map((s) => s.textContent).join('/') +
              ':' +
              [...g.querySelectorAll('.w')]
                .map(
                  (w) =>
                    w.dataset.w +
                    (w.classList.contains('star') ? '★' : '') +
                    (w.classList.contains('bon') ? '~' : '') +
                    (w.classList.contains('new') ? '+' : ''),
                )
                .join(','),
          )
          .join(' | '),
        cur: cw.textContent + (cw.classList.contains('idle') ? '|idle' : ''),
        tiles: tiles
          .map((t) => (t.classList.contains('last') ? 'L' : t.classList.contains('on') ? 'o' : '.'))
          .join(''),
        toast: `${txt('toast')}|${$('toast').className}`,
        count: $('count').hidden ? '' : txt('count'),
        hide: $('board').classList.contains('hide'),
        veil: !$('veil').hidden,
      };
    }
    try {
      out.save = JSON.parse(localStorage.getItem('digi-tangle-v1'));
    } catch (_e) {
      out.save = null;
    }
    return out;
  });

const sheetRead = (p) =>
  p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const txt = (s) => ((q(s) || {}).textContent || '').trim();
    const bar = q('.fin-bar i');
    return {
      ends: window.__ends || [],
      open: !!q('#winModal.fin-open'),
      sheet: {
        kick: txt('.fin-kick'),
        title: txt('#winTitle'),
        hero: txt('#rBig'),
        note: txt('.fin-note'),
        share: txt('.fin-share-text'),
        // AF-019 (site #40): the three stats became one line under the score
        streakLine: txt('.fin-streak'),
        time: txt('#winTime'),
        star: txt('#rStar'),
        meter:
          [...document.querySelectorAll('.fin-meter span')].map((s) => s.textContent).join('|') +
          '|' +
          parseInt((bar && bar.style.width) || '0', 10),
        lists: [...document.querySelectorAll('.fin-wl')].map(
          (wl) =>
            [...wl.querySelectorAll('h4 span')].map((s) => s.textContent).join('/') +
            ':' +
            [...wl.querySelectorAll('.fin-w')]
              .map(
                (w) =>
                  w.firstChild.textContent +
                  w.querySelector('sup').textContent +
                  (w.classList.contains('miss') ? '-' : '') +
                  (w.classList.contains('star') ? '★' : ''),
              )
              .join(','),
        ),
        rare: `${txt('.fin-rare summary')}|${txt('.fin-rare p')}`,
      },
    };
  });

async function gesture(p, move) {
  const rects = await rectsOf(p);
  let points;
  if (move.t === 'tap') {
    const [x, y] = centre(rects[move.i]);
    points = [
      [x, y],
      [x + 1.5, y - 1],
      [x + 2, y + 1],
    ];
  } else points = move.tiles.map((i) => centre(rects[i]));
  await p.mouse.move(points[0][0], points[0][1]);
  await p.mouse.down();
  for (const [x, y] of points.slice(1)) await p.mouse.move(x, y);
  await p.mouse.up();
  return { rects, points };
}

async function replayOne(H, browser, pg, variant) {
  const sc = scenario(pg.data, variant);
  const diffs = [];
  const web = [];
  const gestures = [];
  const { ctx, p } = await L.newPage(H, browser, sc.seed, sc.open, { init: noFullscreen });
  let fin;
  let re = null;
  try {
    await p.goto(`https://dailynoodle.co.uk/reports/${pg.file}`);
    await p.clock.runFor(LOAD_MS);
    for (let i = 0; i < sc.steps.length; i++) {
      const { move, ms } = sc.steps[i];
      try {
        if (move.t === 'play') await H.tap(p, p.locator('#playCard'));
        else if (move.t === 'home') await H.tap(p, p.locator('#homeBtn'));
        else if (move.t === 'leave') await p.reload();
        else if (move.t === 'trace' || move.t === 'tap') gestures.push(await gesture(p, move));
      } catch (e) {
        throw new Error(`move ${i + 1} ${JSON.stringify(move)}: ${e.message}`);
      }
      await p.clock.runFor(ms);
      web.push(await webSnapshot(p));
    }
    fin = await sheetRead(p);
    if (sc.reopen) {
      await p.reload();
      await H.wait(p, 1500);
      re = await sheetRead(p);
    }
    if (p.errs.length) diffs.push({ at: 'page errors', web: p.errs, native: [] });
  } finally {
    await ctx.close();
  }
  const native = simulate(pg.data, sc, gestures);
  for (let i = 0; i < sc.steps.length; i++) {
    if (!L.same(web[i], native.snaps[i])) {
      const m = sc.steps[i].move;
      diffs.push({
        at: `move ${i + 1} ${m.t}${m.tiles ? ' ' + m.tiles.join('-') : m.i != null ? ' ' + m.i : ''}`,
        web: web[i],
        native: native.snaps[i],
      });
      break; // later screens follow from this one
    }
  }
  L.compare(diffs, [
    ['dn:puzzle_end', fin.ends, native.ends],
    ['result sheet open', fin.open, !!native.sheet],
  ]);
  if (native.sheet)
    for (const k of Object.keys(native.sheet))
      L.compare(diffs, [[`sheet ${k}`, fin.sheet[k], native.sheet[k]]]);
  if (re && native.reopened) {
    for (const k of Object.keys(native.reopened))
      L.compare(diffs, [[`reopened ${k}`, re.sheet[k], native.reopened[k]]]);
    L.compare(diffs, [
      ['reopened: no second puzzle_end', re.ends.length, 0],
      ['reopened: sheet up', re.open, true],
    ]);
  }
  return { diffs, moves: sc.steps.length };
}

async function refusedOne(H, browser, pg) {
  const { ctx, p } = await L.newPage(H, browser, {}, Date.parse(`${pg.date}T08:15:00Z`));
  try {
    await p.goto(`https://dailynoodle.co.uk/reports/${pg.file}`);
    await H.wait(p, 1200);
    const gate = await p.evaluate(() => window.__tangleGate || null);
    return p.errs.length > 0 || !Array.isArray(gate) || gate.length > 0;
  } finally {
    await ctx.close();
  }
}

async function main(o) {
  const { H, parseDnPuzzle } = L.site(o.site);
  const { list, without } = L.pages(o.site, 'word-tangle', parseDnPuzzle);
  let chosen = L.part(o.all ? list : L.sample(list, o.sample), o.part);
  if (o.only) chosen = list.filter((pg) => pg.file.includes(o.only) || pg.data.id.includes(o.only));
  const vars = (o.variants || VARIANTS.join(',')).split(',');
  const jobs = [];
  for (const pg of chosen) {
    const v = model.validate(pg.data, pg.date);
    if (!v.ok) jobs.push({ pg, refused: v, label: `${pg.file} refused` });
    else for (const variant of vars) jobs.push({ pg, variant, label: `${pg.file} ${variant}` });
  }
  console.log(
    `replay tangle: ${chosen.length} of ${list.length} Tangle pages with data (${without} older pages without DN_PUZZLE play on the bridge), ` +
      `${jobs.length} runs, variants ${vars.join(', ')}, site ${o.site}`,
  );
  if (!jobs.length) {
    console.error('replay: nothing to replay (no Tangle pages with data found); refusing to pass');
    return 1;
  }
  return L.runAll({
    name: 'tangle',
    jobs,
    workers: o.workers,
    verbose: o.verbose,
    launch: () => H.launch(),
    units: `${chosen.length} Tangles`,
    one: async (browser, job) => {
      if (!job.refused) return replayOne(H, browser, job.pg, job.variant);
      const fails = await refusedOne(H, browser, job.pg);
      return {
        diffs: fails ? [] : [{ at: 'validate', web: 'plays', native: job.refused.fails }],
        moves: 0,
      };
    },
  });
}

module.exports = { main };
