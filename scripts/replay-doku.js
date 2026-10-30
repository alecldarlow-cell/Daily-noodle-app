#!/usr/bin/env node
/**
 * Differential replay for the Doku: the native model against engines/doku.js.
 *
 *   node scripts/replay.js --type doku --sample 20 --site ../dailynoodle
 *   node scripts/replay.js --type doku --all --site ../dailynoodle [--workers 2]
 *        [--only 0104] [--variants solve,seed] [--shard 1/3] [--verbose]
 *
 * (scripts/replay.js hands `--type doku` to this file.) For every Doku page in the site
 * clone's reports/ that carries window.DN_PUZZLE (read with the site's
 * tools/puzzle-json.js), and every oracle variant (src/features/puzzles/doku/oracle.ts):
 *   web     the site's harness (tools/tests/harness.js) serves the clone as
 *           dailynoodle.co.uk in headless Chromium, as a phone, on a paused fake clock;
 *           the oracle's moves go through the page's real controls with jittered taps
 *           (bank tiles, squares, Hints) and the keyboard (letters, Backspace, space,
 *           into the hidden input a tapped square focuses);
 *   native  the model plays the same moves on the same clock, then core's putDone,
 *           Doku's seeded streak, bumpSolveStreak and shareDoku
 *           (src/features/puzzles/doku/simulate.ts).
 * First the vendored word list and gate tables must equal the page's own; then, per run,
 * the streak document after the page's load (the seed), the board after Play, and after
 * every move the board: letters, cursor, highlighted word, green squares, given and
 * placed squares, the bank and the chosen tile, the message line, Hints, the clock,
 * whether the puzzle is won and whether the keyboard is up. At the end the saved
 * digi-doku-v1 and digi-doku-streak documents, the dn:puzzle_end detail, the share line,
 * the finish sheet's kicker, title, time, note, stats and recap line; for reopening
 * variants, the reloaded sheet and no second puzzle_end. Pages the model refuses
 * (validate) must fail on the web too. Any difference prints both sides; exit code 1.
 */
require('./ts-register');
const fs = require('fs');
const path = require('path');

const model = require('../src/features/puzzles/doku/model.ts');
const { scenario, startAt, VARIANTS } = require('../src/features/puzzles/doku/oracle.ts');
const { simulate, snapshot } = require('../src/features/puzzles/doku/simulate.ts');
const ENGINE = require('../src/features/puzzles/doku/engine-words.json');

const LOAD_MS = 1200;
const PLAY_MS = 500;

function options(argv) {
  const args = argv.slice(2);
  const opt = (name, dflt) => {
    const i = args.indexOf(`--${name}`);
    return i < 0 ? dflt : args[i + 1];
  };
  const all = args.includes('--all');
  const shard = /^(\d+)\/(\d+)$/.exec(opt('shard', '1/1')) || [0, 1, 1];
  return {
    site: path.resolve(opt('site', '../dailynoodle')),
    all,
    sample: Number(opt('sample', all ? 0 : 20)),
    workers: Number(opt('workers', 2)),
    only: opt('only', null),
    vars: (opt('variants', '') || VARIANTS.join(',')).split(','),
    shard: [Number(shard[1]), Number(shard[2])],
    verbose: args.includes('--verbose'),
  };
}

/** Every Doku page with its data and day, oldest first. */
function pages(site, parseDnPuzzle) {
  const dir = path.join(site, 'reports');
  const out = [];
  let without = 0;
  for (const file of fs.readdirSync(dir).sort()) {
    if (!/^(?:\d{4}-\d{2}-\d{2}-logic-doku|digi-doku)(?:-\d+)?\.html$/.test(file)) continue;
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    const data = parseDnPuzzle(html, file);
    if (!data) {
      without++;
      continue;
    }
    const date = (/name="dn:date"\s+content="([^"]+)"/.exec(html) || [])[1] || file.slice(0, 10);
    out.push({ file, data, date });
  }
  return { list: out, without };
}

/** n pages spread evenly over the list, always including the newest. */
function sample(list, n) {
  if (!n || n >= list.length) return list;
  const picked = new Set();
  for (let i = 0; i < n; i++) picked.add(Math.round(((list.length - 1) * i) / Math.max(1, n - 1)));
  return [...picked].map((i) => list[i]);
}

const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(x) {
  if (Array.isArray(x)) return x.map(sortKeys);
  if (x && typeof x === 'object')
    return Object.fromEntries(
      Object.keys(x)
        .sort()
        .map((k) => [k, sortKeys(x[k])]),
    );
  return x;
}

/** The board as the page paints it, in simulate.ts's snapshot shape. */
const webSnapshot = (p) =>
  p.evaluate(() => {
    const cells = [...document.querySelectorAll('#grid .cell')].map((c) => {
      if (c.classList.contains('block')) return '#';
      const has = (k) => c.classList.contains(k);
      const l = ((c.querySelector('.ltr') || {}).textContent || '').trim() || '.';
      return (
        l +
        (has('active') ? '*' : '') +
        (has('inword') ? '+' : '') +
        (has('good') ? 'g' : '') +
        (has('locked') ? 'L' : has('placed') ? 'p' : '')
      );
    });
    return {
      cells: cells.join(' '),
      bank: [...document.querySelectorAll('#bank .tile')]
        .map((t) => t.dataset.id + (t.classList.contains('sel') ? '*' : ''))
        .join(' '),
      msg: (document.getElementById('msg').textContent || '').trim(),
      timer: document.getElementById('timer').textContent,
      hints: (document.getElementById('toggleHints').textContent || '').trim(),
      win: document.body.classList.contains('win'),
      kbd: document.activeElement === document.getElementById('hidden'),
    };
  });

function makeDrive(H) {
  return async function drive(p, move) {
    const tap = (loc) => H.tap(p, loc);
    switch (move.t) {
      case 'tile':
        return tap(p.locator(`#bank .tile[data-id="${move.id}"]`));
      case 'cell':
        return tap(p.locator('#grid .cell').nth(move.r * 5 + move.c));
      case 'key':
        return p.keyboard.press(move.ch);
      case 'del':
        return p.keyboard.press('Backspace');
      case 'space':
        return p.keyboard.press(' ');
      case 'hints':
        return tap(p.locator('#toggleHints'));
      default:
        throw new Error(`replay: no control for move ${JSON.stringify(move)}`);
    }
  };
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
      save: ls('digi-doku-v1'),
      streak: ls('digi-doku-streak'),
      ends: window.__ends || [],
      share: txt('.fin-share-text'),
      note: txt('.fin-note'),
      hero: txt('#winTime'),
      title: txt('#winTitle'),
      kick: txt('.fin-kick'),
      // AF-019 (site #40): the three stats became one line under the score
      streakLine: txt('.fin-streak'),
      recap: txt('.fin-recap-sub'),
      open: !!document.querySelector('#winModal.fin-open'),
      startCard: !!document.querySelector('.dn-start:not([hidden])'),
    };
  });

async function newPage(H, browser, seed, t) {
  const ctx = await H.newPhone(browser, {});
  await ctx.addInitScript((seed) => {
    window.__ends = [];
    document.addEventListener('dn:puzzle_end', (e) => window.__ends.push(e.detail));
    try {
      if (!sessionStorage.getItem('__replaySeeded')) {
        for (const k of Object.keys(seed)) localStorage.setItem(k, JSON.stringify(seed[k]));
        sessionStorage.setItem('__replaySeeded', '1');
      }
    } catch (_e) {}
  }, seed);
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  // Install a little early: real time flows until pauseAt, which can't go backwards.
  await p.clock.install({ time: new Date(t - 60_000) });
  await p.clock.pauseAt(new Date(t));
  return { ctx, p };
}

/** The vendored word list and gate tables against the page's own globals. */
async function tablesMatch(H, browser, pg) {
  const { ctx, p } = await newPage(H, browser, {}, Date.parse(`${pg.date}T08:15:00Z`));
  try {
    await p.goto(`https://dailynoodle.co.uk/reports/${pg.file}`);
    await H.wait(p, LOAD_MS);
    // eslint-disable-next-line no-undef
    const web = await p.evaluate(() => ({ WORDS, BLOCKED, BANDS, DENSITY }));
    const diffs = [];
    for (const k of ['WORDS', 'BLOCKED', 'BANDS', 'DENSITY'])
      if (!same(web[k], ENGINE[k]))
        diffs.push({
          at: `vendored ${k} (node scripts/vendor-doku-words.js --site …)`,
          web: '(the page’s)',
          native: 'differs',
        });
    return diffs;
  } finally {
    await ctx.close();
  }
}

/** One page, one variant: returns a list of differences (empty when identical). */
async function replayOne(H, drive, browser, pg, variant) {
  const sc = scenario(pg.data, variant, pg.date);
  const t = startAt(sc, pg.date, LOAD_MS + PLAY_MS);
  const native = simulate(pg.data, sc, t + LOAD_MS + PLAY_MS, pg.date);
  const diffs = [];
  const { ctx, p } = await newPage(H, browser, sc.seed, t);
  try {
    await p.goto(`https://dailynoodle.co.uk/reports/${pg.file}`);
    await H.wait(p, LOAD_MS);
    const opened = await p.evaluate(() => JSON.parse(localStorage.getItem('digi-doku-streak')));
    if (!same(opened, native.opened))
      diffs.push({ at: 'digi-doku-streak after load', web: opened, native: native.opened });
    await H.tap(p, p.locator('#dnPlay'));
    await H.wait(p, PLAY_MS);
    const first = await webSnapshot(p);
    const nfirst = snapshot(model.init(pg.data), 0);
    if (!same(first, nfirst)) diffs.push({ at: 'board after Play', web: first, native: nfirst });
    for (let i = 0; i < sc.steps.length && !diffs.length; i++) {
      const step = sc.steps[i];
      try {
        await drive(p, step.move);
      } catch (e) {
        throw new Error(`move ${i + 1} ${JSON.stringify(step.move)}: ${e.message}`);
      }
      await p.clock.runFor(step.ms);
      const web = await webSnapshot(p);
      const nat = native.snaps[i];
      if (!same(web, nat)) {
        diffs.push({ at: `move ${i + 1} ${JSON.stringify(step.move)}`, web, native: nat });
        break; // later boards follow from this one
      }
    }
    const w = await finishRead(p);
    const n = native.final;
    const end = w.ends.length === 1 ? w.ends[0] : { count: w.ends.length, ends: w.ends };
    for (const [k, a, b] of [
      ['digi-doku-v1', w.save, n.save],
      ['digi-doku-streak', w.streak, n.streak],
      ['dn:puzzle_end', end, n.end],
      ['share line', w.share, n.share],
      ['finish note', w.note, n.note],
      ['finish time', w.hero, n.hero],
      ['finish title', w.title, n.title],
      ['finish kicker', w.kick, n.kick],
      ['finish streak line', w.streakLine, n.streakLine],
      ['finish recap line', w.recap, n.recap],
    ])
      if (!same(a, b)) diffs.push({ at: k, web: a, native: b });
    if (!w.open) diffs.push({ at: 'finish sheet open', web: w.open, native: true });
    if (sc.reopen && native.reopened) {
      await p.reload();
      await H.wait(p, 1500);
      const r = await finishRead(p);
      const nr = native.reopened;
      for (const [k, a, b] of [
        ['reopened share line', r.share, nr.share],
        ['reopened note', r.note, nr.note],
        ['reopened time', r.hero, nr.hero],
        ['reopened streak line', r.streakLine, nr.streakLine],
        ['reopened: no second puzzle_end', r.ends.length, 0],
        ['reopened: sheet up, no start card', r.open && !r.startCard, true],
      ])
        if (!same(a, b)) diffs.push({ at: k, web: a, native: b });
    }
    if (p.errs.length) diffs.push({ at: 'page errors', web: p.errs, native: [] });
  } finally {
    await ctx.close();
  }
  return { diffs, moves: sc.steps.length };
}

/** A page the model refuses: the web player must refuse it too (ship gate, or an error). */
async function refusedOne(H, browser, pg) {
  const { ctx, p } = await newPage(H, browser, {}, Date.parse(`${pg.date}T08:15:00Z`));
  try {
    await p.goto(`https://dailynoodle.co.uk/reports/${pg.file}`);
    await H.wait(p, LOAD_MS);
    const gate = await p.evaluate(() => !document.getElementById('gate').hidden);
    const cells = await p.locator('#grid .cell').count();
    return p.errs.length > 0 || gate || cells !== 25;
  } finally {
    await ctx.close();
  }
}

async function main(o) {
  if (!fs.existsSync(path.join(o.site, 'tools/tests/harness.js'))) {
    console.error(`replay: ${o.site} is not a dailynoodle clone (no tools/tests/harness.js)`);
    return 2;
  }
  const H = require(path.join(o.site, 'tools/tests/harness.js'));
  const { parseDnPuzzle } = require(path.join(o.site, 'tools/puzzle-json.js'));
  const drive = makeDrive(H);
  const t0 = Date.now();
  const { list, without } = pages(o.site, parseDnPuzzle);
  let chosen = o.all ? list : sample(list, o.sample);
  if (o.only) chosen = list.filter((pg) => pg.file.includes(o.only) || pg.data.id.includes(o.only));
  const [k, nShards] = o.shard;
  if (nShards > 1) chosen = chosen.filter((_, i) => i % nShards === k - 1);
  const jobs = [];
  for (const pg of chosen) {
    const v = model.validate(pg.data);
    if (!v.ok) jobs.push({ pg, refused: v });
    else for (const variant of o.vars) jobs.push({ pg, variant });
  }
  console.log(
    `replay doku: ${chosen.length} of ${list.length} Doku pages with data (${without} older pages without DN_PUZZLE play on the bridge)` +
      `${nShards > 1 ? `, shard ${k}/${nShards}` : ''}, ${jobs.length} runs, variants ${o.vars.join(', ')}, site ${o.site}`,
  );
  if (!jobs.length) {
    console.error('replay: nothing to replay (no Doku pages with data found); refusing to pass');
    return 1;
  }
  const browser = await H.launch();
  let okRuns = 0;
  let moves = 0;
  const failures = [];
  try {
    const tables = await tablesMatch(H, browser, chosen[chosen.length - 1]);
    if (tables.length) failures.push({ label: 'engine tables', diffs: tables });
    let next = 0;
    const worker = async () => {
      for (;;) {
        const job = jobs[next++];
        if (!job) return;
        const label = `${job.pg.file} ${job.variant || 'refused'}`;
        try {
          if (job.refused) {
            if (await refusedOne(H, browser, job.pg)) okRuns++;
            else
              failures.push({
                label,
                diffs: [{ at: 'validate', web: 'plays', native: job.refused.checks }],
              });
            continue;
          }
          const r = await replayOne(H, drive, browser, job.pg, job.variant);
          moves += r.moves;
          if (r.diffs.length) failures.push({ label, diffs: r.diffs });
          else okRuns++;
          if (o.verbose || r.diffs.length)
            console.log(`${r.diffs.length ? 'DIFF' : 'ok  '} ${label} (${r.moves} moves)`);
        } catch (e) {
          failures.push({
            label,
            diffs: [{ at: 'error', web: String((e && e.stack) || e), native: '' }],
          });
          console.log(`ERR  ${label}: ${e && e.message}`);
        }
        const done = okRuns + failures.length;
        if (done % 50 === 0)
          console.log(`  … ${done}/${jobs.length} runs, ${Math.round((Date.now() - t0) / 1000)} s`);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, o.workers) }, worker));
  } finally {
    await browser.close();
  }
  for (const f of failures) {
    console.log(`\nDIFFERS: ${f.label}`);
    for (const d of f.diffs) {
      console.log(`  at ${d.at}`);
      console.log(`    web:    ${JSON.stringify(d.web)}`);
      console.log(`    native: ${JSON.stringify(d.native)}`);
    }
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  const summary =
    `replay doku: ${okRuns}/${jobs.length} runs identical (${moves} moves compared) across ${chosen.length} Dokus in ${secs} s` +
    (failures.length ? `; ${failures.length} differ` : '');
  console.log(`\n${summary}`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::${failures.length ? 'error' : 'notice'} title=replay doku::${summary}`);
    for (const f of failures.slice(0, 10))
      console.log(`::error title=replay differs::${f.label} at ${f.diffs[0].at}`);
  }
  return failures.length ? 1 : 0;
}

module.exports = { main, options };

if (require.main === module)
  main(options(process.argv))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
