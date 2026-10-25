/**
 * Differential replay for Link (WP10): the native model against engines/link.js.
 * Run through scripts/replay.js:
 *
 *   node scripts/replay.js --type link --sample 20 --site ../dailynoodle
 *   node scripts/replay.js --type link --all --site ../dailynoodle [--workers 4] [--only 0078]
 *
 * For every Link page in the site clone with window.DN_PUZZLE and every oracle variant
 * (src/features/puzzles/link/oracle.ts), the page is played in headless Chromium on a
 * paused fake clock through its real controls with jittered taps (Play on the start
 * card, the tiles, Shuffle, Deselect, Submit, Play again): the phone's controls. The
 * page deals the board with Math.random, so its order is read after loading and after
 * every Shuffle or Play again and handed to the model (simulate.ts), which plays the
 * same moves on the same clock. A right four's settle runs on real time in the page
 * (Web Animations), so the replay moves the fake clock on by the settle's 1080 ms,
 * waits for the flight to land, then lets the rest of the step's time pass.
 *
 * After every move the board must match (bands, tiles in order and held, spent pips,
 * message and its tone, clock, the replay label, Share result in place of the
 * controls, disabled controls, the sheet); at the end the saved digi-link-v1 and
 * digi-link-streak, every dn:puzzle_end, the sheet's share line, note, title, kicker,
 * guess squares, stats and Play again; for reopening variants the reloaded board and
 * sheet, and no second puzzle_end. Pages the model refuses must fail on the web too.
 */
require('./ts-register');

const L = require('./replay-lib');
const model = require('../src/features/puzzles/link/model.ts');
const { scenario, startAt, VARIANTS } = require('../src/features/puzzles/link/oracle.ts');
const { simulate, snapshot, heroCode } = require('../src/features/puzzles/link/simulate.ts');
const { isRanked, reopenInfo } = require('../src/features/puzzles/link/finishing.ts');

const LOAD_MS = 1200;

/**
 * Differences that are site bugs, reported rather than ported. Each is printed as KNOWN
 * and does not fail the run; it fails again if it stops matching the bug as described.
 * - The sheet after "Play again (not recorded)": finish.js's show() removes the previous
 *   sheet, and with it the engine's #winTitle, #winTime, #winStreak and #winBest that
 *   sheet had adopted, so the replay's sheet has no title and three blank stats
 *   (engines/link.js showEnd fills them first, then finishSheet builds the new sheet).
 *   The app shows the replay's real title and stats.
 */
const KNOWN = {
  'replay sheet title': (web) => web === '',
  'replay sheet stats': (web) => Array.isArray(web) && web.every((x) => x === ''),
};

const webDeal = (p) =>
  p.evaluate(() => [...document.querySelectorAll('#board .tile')].map((t) => t.dataset.w));

const webSnapshot = (p) =>
  p.evaluate(() => {
    const $ = (s) => document.querySelector(s);
    const dis = (id) => !!(document.getElementById(id) || {}).disabled;
    const sh = document.getElementById('shareAgain');
    return {
      bands: [...document.querySelectorAll('#board .band')]
        .map((b) => (/\br(\d)\b/.exec(b.className) || [])[1])
        .join(' '),
      tiles: [...document.querySelectorAll('#board .tile')]
        .map((t) => t.dataset.w + (t.classList.contains('sel') ? '*' : ''))
        .join(' '),
      pips: document.querySelectorAll('#pips .pip.gone').length,
      msg: `${$('#msg').textContent}|${$('#msg')
        .className.replace(/\bmsg\b/, '')
        .trim()}`,
      timer: $('#timer').textContent,
      rank: $('#rank').textContent,
      share: !!sh && sh.style.display !== 'none',
      // hidden controls (Share result in their place) are not compared
      off:
        sh && sh.style.display !== 'none'
          ? ''
          : ['submit', 'clear', 'shuffle'].filter(dis).join(' '),
      sheet: !!document.querySelector('#winModal.fin-open'),
    };
  });

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
      save: ls('digi-link-v1'),
      streak: ls('digi-link-streak'),
      ends: window.__ends || [],
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      hero: [...document.querySelectorAll('.fin-guess i')]
        .map((i) => (i.className === 'fin-gx' ? 'x' : i.className.replace('fin-', '')))
        .join(' '),
      stats: [...document.querySelectorAll('.fin-stats > div > b')].map((b) =>
        (b.textContent || '').trim(),
      ),
      again: [...document.querySelectorAll('.fin > .fin-link')].some(
        (a) => a.textContent === 'Play again (not recorded)',
      ),
      open: !!document.querySelector('#winModal.fin-open'),
      startCard: !!document.querySelector('.dn-start:not([hidden])'),
    };
  });

async function drive(H, p, move) {
  const tap = (loc) => H.tap(p, loc);
  switch (move.t) {
    case 'play':
      return tap(p.locator('#dnPlay'));
    case 'tile': {
      const i = (await webDeal(p)).indexOf(move.w);
      if (i < 0) throw new Error(`no tile ${move.w} on the board`);
      return tap(p.locator('#board .tile').nth(i));
    }
    case 'submit':
      return tap(p.locator('#submit'));
    case 'deselect':
      return tap(p.locator('#clear'));
    case 'shuffle':
      return tap(p.locator('#shuffle'));
    case 'again':
      return tap(p.locator('.fin > .fin-link').first());
    default:
      throw new Error(`replay: no control for move ${JSON.stringify(move)}`);
  }
}

/** The settle runs on real time: wait for the flight to land (the fake clock stays put). */
async function landed(p) {
  for (let i = 0; i < 200; i++) {
    const busy = await p.evaluate(
      () => !!document.querySelector('.ghost, #board .band.arriving, #board .tile.hit'),
    );
    if (!busy) return;
    await p.waitForTimeout(20);
  }
  throw new Error('the settle never landed');
}

async function replayOne(H, browser, pg, variant) {
  const sc = scenario(pg.data, variant, pg.date);
  const t = startAt(sc, pg.date, LOAD_MS);
  const diffs = [];
  const notes = [];
  const web = [];
  const deals = [];
  const sheets = [];
  const { ctx, p } = await L.newPage(H, browser, sc.seed, t, { reduced: sc.reduced });
  let w;
  let reopened = null;
  try {
    await p.goto(`https://dailynoodle.co.uk/reports/${pg.file}`);
    await p.clock.runFor(LOAD_MS);
    deals.push(await webDeal(p));
    for (let i = 0; i < sc.steps.length; i++) {
      const step = sc.steps[i];
      try {
        await drive(H, p, step.move);
      } catch (e) {
        throw new Error(`move ${i + 1} ${JSON.stringify(step.move)}: ${e.message}`);
      }
      if (step.settles && !sc.reduced) {
        await p.clock.runFor(model.SETTLE_MS);
        await landed(p);
        await p.clock.runFor(step.ms - model.SETTLE_MS);
      } else await p.clock.runFor(step.ms);
      if (step.move.t === 'shuffle' || step.move.t === 'again') deals.push(await webDeal(p));
      const snap = await webSnapshot(p);
      // Each sheet is read as it rises (Play again takes it down for the replay's own).
      if (snap.sheet && !(web.length && web[web.length - 1].sheet))
        sheets.push(await finishRead(p));
      web.push(snap);
    }
    w = await finishRead(p);
    if (sc.reopen) {
      await p.reload();
      await H.wait(p, 1500);
      reopened = { ...(await finishRead(p)), board: await webSnapshot(p) };
    }
    if (p.errs.length) diffs.push({ at: 'page errors', web: p.errs, native: [] });
  } finally {
    await ctx.close();
  }
  const native = simulate(pg.data, sc, t + LOAD_MS, pg.date, deals, t);
  for (let i = 0; i < sc.steps.length; i++) {
    if (!L.same(web[i], native.snaps[i])) {
      diffs.push({
        at: `move ${i + 1} ${JSON.stringify(sc.steps[i].move)}`,
        web: web[i],
        native: native.snaps[i],
      });
      break; // later boards follow from this one
    }
  }
  const n = native.final;
  L.compare(diffs, [
    ['digi-link-v1', w.save, n.save],
    ['digi-link-streak', w.streak, n.streak],
    ['dn:puzzle_end', w.ends, n.ends],
    ['sheets shown', sheets.length, n.sheets.length],
  ]);
  sheets.forEach((ws, i) => {
    const ns = n.sheets[i] || {};
    const pre = i ? 'replay sheet' : 'sheet';
    for (const k of ['share', 'note', 'title', 'kick', 'hero', 'stats', 'again']) {
      if (L.same(ws[k], ns[k])) continue;
      const known = KNOWN[`${pre} ${k}`];
      if (known && known(ws[k])) {
        notes.push(`${pre} ${k}`);
        continue;
      }
      diffs.push({ at: `${pre} ${k}`, web: ws[k], native: ns[k] });
    }
  });
  if (!w.open) diffs.push({ at: 'finish sheet open', web: w.open, native: true });
  if (reopened && native.reopened) {
    const nr = native.reopened;
    // The reopened board: the model's restore from the saved record.
    const rec = w.save && w.save.done && w.save.done[pg.data.id];
    const kv = { getItem: (k) => (k === 'digi-link-streak' ? JSON.stringify(w.streak) : null) };
    const st = model.init(pg.data, [], { ranked: isRanked(kv, t), rec });
    const nb = snapshot(st, rec.t, true);
    const ri = reopenInfo(st.p, rec, kv);
    L.compare(diffs, [
      ['reopened board', reopened.board, nb],
      ['reopened share line', reopened.share, nr.share],
      ['reopened note', reopened.note, nr.note],
      ['reopened title', reopened.title, nr.title],
      ['reopened squares', reopened.hero, heroCode(ri.squares)],
      ['reopened stats', reopened.stats, nr.stats],
      ['reopened Play again', reopened.again, nr.again],
      ['reopened: no second puzzle_end', reopened.ends.length, 0],
      ['reopened: sheet up, no start card', reopened.open && !reopened.startCard, true],
    ]);
  }
  return { diffs, notes, moves: sc.steps.length };
}

async function refusedOne(H, browser, pg) {
  const { ctx, p } = await L.newPage(H, browser, {}, Date.parse(`${pg.date}T08:15:00Z`));
  try {
    await p.goto(`https://dailynoodle.co.uk/reports/${pg.file}`);
    await H.wait(p, LOAD_MS);
    const tiles = await p.locator('#board .tile').count();
    return p.errs.length > 0 || tiles !== 16;
  } finally {
    await ctx.close();
  }
}

async function main(o) {
  const { H, parseDnPuzzle } = L.site(o.site);
  const { list, without } = L.pages(o.site, 'word-link', parseDnPuzzle);
  let chosen = L.part(o.all ? list : L.sample(list, o.sample), o.part);
  if (o.only) chosen = list.filter((pg) => pg.file.includes(o.only) || pg.data.id.includes(o.only));
  const vars = (o.variants || VARIANTS.join(',')).split(',');
  const jobs = [];
  for (const pg of chosen) {
    const v = model.validate(pg.data);
    if (!v.ok) jobs.push({ pg, refused: v, label: `${pg.file} refused` });
    else for (const variant of vars) jobs.push({ pg, variant, label: `${pg.file} ${variant}` });
  }
  console.log(
    `replay link: ${chosen.length} of ${list.length} Link pages with data (${without} older pages without DN_PUZZLE play on the bridge), ` +
      `${jobs.length} runs, variants ${vars.join(', ')}, site ${o.site}`,
  );
  if (!jobs.length) {
    console.error('replay: nothing to replay (no Link pages with data found); refusing to pass');
    return 1;
  }
  return L.runAll({
    name: 'link',
    jobs,
    workers: o.workers,
    verbose: o.verbose,
    launch: () => H.launch(),
    units: `${chosen.length} Links`,
    one: async (browser, job) => {
      if (!job.refused) return replayOne(H, browser, job.pg, job.variant);
      const fails = await refusedOne(H, browser, job.pg);
      return {
        diffs: fails ? [] : [{ at: 'validate', web: 'plays', native: job.refused.checks }],
        moves: 0,
      };
    },
  });
}

module.exports = { main };
