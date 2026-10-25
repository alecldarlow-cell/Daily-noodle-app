#!/usr/bin/env node
/**
 * Differential replay: a native puzzle model against the site's own engine.
 *
 *   node scripts/replay.js --type mini --sample 50 --site ../dailynoodle
 *   node scripts/replay.js --type sweep --all --site ../dailynoodle [--workers 2] [--only 0105]
 *   node scripts/replay.js --type path --all --shard 2/4 ...   (the second quarter of the runs)
 *   node scripts/replay.js --type link|tangle|doku … [--shard 1/2] [--variants a,b]
 *
 * For every page of the type in the site clone's reports/ that carries
 * window.DN_PUZZLE (read with the site's tools/puzzle-json.js), and every oracle
 * variant (src/features/puzzles/<type>/oracle.ts):
 *   web     the site's harness (tools/tests/harness.js) serves the clone as
 *           dailynoodle.co.uk in headless Chromium on a paused fake clock; the
 *           oracle's moves are driven through the page's real controls with
 *           jittered taps (the controls a phone has);
 *   native  the model plays the same moves on the same clock, then the type's
 *           finishing code: core's putDone, the streak rule, the share line
 *           (src/features/puzzles/<type>/simulate.ts).
 * After every move the board must match; at the end the saved result and streak
 * documents, the dn:puzzle_end detail, the share line and the finish sheet; for
 * reopening variants, the reloaded sheet and no second puzzle_end. Pages the model
 * refuses (validate) must fail on the web too. Any difference prints both sides and
 * the exit code is 1.
 *
 * Each type's page reading, controls, board reader and finish reader live in
 * scripts/replay/<type>.js; this file runs them. Link, Tangle and Doku have their own
 * scripts (replay-link.js, replay-tangle.js on the shared replay-lib.js; replay-doku.js
 * with its own options), which this one hands over to.
 *
 * Needs the site clone's dev dependencies (npm ci --ignore-scripts there): its
 * Playwright and pinned Chromium. Nothing reaches the network: the harness answers
 * every request from the clone and blocks Supabase.
 */
require('./ts-register');
const fs = require('fs');
const path = require('path');

const TYPES = {
  mini: () => require('./replay/mini'),
  sweep: () => require('./replay/sweep'),
  path: () => require('./replay/path'),
};

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? dflt : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);
const TYPE = opt('type', 'mini');
const SITE = path.resolve(opt('site', '../dailynoodle'));
const ALL = flag('all');
const SAMPLE = Number(opt('sample', ALL ? 0 : 50));
const WORKERS = Number(opt('workers', 2));
const ONLY = opt('only', null);
const VERBOSE = flag('verbose');
const SHARD = (() => {
  const m = /^(\d+)\/(\d+)$/.exec(opt('shard', '1/1'));
  return m && +m[1] >= 1 && +m[1] <= +m[2] ? { k: +m[1], n: +m[2] } : null;
})();

/** Types whose replay lives in its own script (scripts/replay-<type>.js, on replay-lib.js). */
const OWN = { link: './replay-link', tangle: './replay-tangle', doku: './replay-doku' };
const own = OWN[TYPE] ? require(OWN[TYPE]) : null;
if (own)
  own
    .main((own.options || require('./replay-lib').options)(process.argv))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
else if (!TYPES[TYPE]) {
  const known = [...Object.keys(TYPES), ...Object.keys(OWN)].join(', ');
  console.error(`replay: no native player for "${TYPE}" yet (${known})`);
  process.exit(2);
}
if (!SHARD && !OWN[TYPE]) {
  console.error('replay: --shard takes k/n, 1 ≤ k ≤ n');
  process.exit(2);
}
if (!fs.existsSync(path.join(SITE, 'tools/tests/harness.js'))) {
  console.error(`replay: ${SITE} is not a dailynoodle clone (no tools/tests/harness.js)`);
  process.exit(2);
}

const H = require(path.join(SITE, 'tools/tests/harness.js'));
const { parseDnPuzzle } = require(path.join(SITE, 'tools/puzzle-json.js'));
const A = OWN[TYPE] ? null : TYPES[TYPE]();
const VARS = A ? (opt('variants', '') || A.VARIANTS.join(',')).split(',') : [];

/** Every page of the type with its data, day and number, oldest first. */
function pages() {
  const dir = path.join(SITE, 'reports');
  const out = [];
  let without = 0;
  for (const file of fs.readdirSync(dir).sort()) {
    const m = A.pattern.exec(file);
    if (!m) continue;
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    const data = parseDnPuzzle(html, file);
    if (!data) {
      without++;
      continue;
    }
    const date = (/name="dn:date"\s+content="([^"]+)"/.exec(html) || [])[1] || m[1];
    const headline = (/name="dn:headline"\s+content="([^"]+)"/.exec(html) || [])[1] || '';
    const n = parseInt((/(\d+)\s*$/.exec(headline) || [])[1], 10) || '';
    out.push({ file, data, date, n });
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

/** Move the page's paused fake clock on (the harness's wait() also idles 30 ms of real time). */
const run = (p, ms) => p.clock.runFor(ms);
const LOAD_MS = 1200;
const PLAY_MS = 500;

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

async function newPage(browser, seed, t) {
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

/** What every type's finish reader returns besides its own fields. */
const common = (p) =>
  p.evaluate(() => ({
    ends: window.__ends || [],
    startCard: !!document.querySelector('.dn-start:not([hidden])'),
  }));

/** One page, one variant: returns a list of differences (empty when identical). */
async function replayOne(browser, pg, variant) {
  const sc = A.scenario(pg.data, variant, pg.date);
  const t = A.startAt(sc, pg.date, LOAD_MS + PLAY_MS);
  const native = A.native(pg, sc, {
    openAt: t,
    playAt: t + LOAD_MS,
    firstAt: t + LOAD_MS + PLAY_MS,
  });
  const diffs = [];
  const { ctx, p } = await newPage(browser, sc.seed, t);
  try {
    await p.goto(`https://dailynoodle.co.uk/reports/${pg.file}`);
    await H.wait(p, LOAD_MS);
    await H.tap(p, p.locator('#dnPlay'));
    await H.wait(p, PLAY_MS);
    for (let i = 0; i < sc.steps.length; i++) {
      const step = sc.steps[i];
      try {
        await A.drive(p, step.move, H);
      } catch (e) {
        throw new Error(`move ${i + 1} ${JSON.stringify(step.move)}: ${e.message}`);
      }
      await run(p, step.ms);
      const web = await A.webSnapshot(p);
      const nat = native.snaps[i];
      if (!same(web, nat)) {
        diffs.push({ at: `move ${i + 1} ${JSON.stringify(step.move)}`, web, native: nat });
        break; // later boards follow from this one
      }
    }
    const w = { ...(await A.finishRead(p)), ...(await common(p)) };
    const n = native.final;
    const end = w.ends.length === 1 ? w.ends[0] : { count: w.ends.length, ends: w.ends };
    for (const [k, a, b] of [['dn:puzzle_end', end, n.end], ...A.finalPairs(w, n)])
      if (!same(a, b)) diffs.push({ at: k, web: a, native: b });
    if (!w.open) diffs.push({ at: 'finish sheet open', web: w.open, native: true });
    if (sc.reopen && native.reopened) {
      await p.reload();
      await H.wait(p, 1500);
      const r = { ...(await A.finishRead(p)), ...(await common(p)) };
      for (const [k, a, b] of [
        ...A.reopenPairs(r, native.reopened),
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

/** A page the model refuses: the web player must fail on it too. */
async function refusedOne(browser, pg) {
  const { ctx, p } = await newPage(browser, {}, Date.parse(`${pg.date}T08:15:00Z`));
  try {
    await p.goto(`https://dailynoodle.co.uk/reports/${pg.file}`);
    await H.wait(p, LOAD_MS);
    return p.errs.length > 0 || (await A.refused(p));
  } finally {
    await ctx.close();
  }
}

async function main() {
  const t0 = Date.now();
  const { list, without } = pages();
  let chosen = ALL ? list : sample(list, SAMPLE);
  if (ONLY) chosen = list.filter((pg) => pg.file.includes(ONLY) || pg.data.id.includes(ONLY));
  let jobs = [];
  for (const pg of chosen) {
    const v = A.validate(pg.data);
    if (!v.ok) jobs.push({ pg, refused: v });
    else for (const variant of VARS) jobs.push({ pg, variant });
  }
  const total = jobs.length;
  if (SHARD.n > 1) jobs = jobs.filter((_, i) => i % SHARD.n === SHARD.k - 1);
  const shardNote = SHARD.n > 1 ? ` (shard ${SHARD.k}/${SHARD.n} of ${total})` : '';
  console.log(
    `replay ${TYPE}: ${chosen.length} of ${list.length} ${A.label} pages with data (${without} older pages without DN_PUZZLE play on the bridge), ` +
      `${jobs.length} runs${shardNote}, variants ${VARS.join(', ')}, site ${SITE}`,
  );
  if (!jobs.length) {
    console.error(
      `replay: nothing to replay (no ${A.label} pages with data found); refusing to pass`,
    );
    process.exit(1);
  }
  const browser = await H.launch();
  let okRuns = 0;
  let moves = 0;
  const failures = [];
  let next = 0;
  async function worker() {
    for (;;) {
      const job = jobs[next++];
      if (!job) return;
      const label = `${job.pg.file} ${job.variant || 'refused'}`;
      try {
        if (job.refused) {
          const fails = await refusedOne(browser, job.pg);
          if (fails) okRuns++;
          else
            failures.push({
              label,
              diffs: [{ at: 'validate', web: 'plays', native: job.refused.checks }],
            });
          continue;
        }
        const r = await replayOne(browser, job.pg, job.variant);
        moves += r.moves;
        if (r.diffs.length) failures.push({ label, diffs: r.diffs });
        else okRuns++;
        if (VERBOSE || r.diffs.length)
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
  }
  try {
    await Promise.all(Array.from({ length: Math.max(1, WORKERS) }, worker));
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
    `replay ${TYPE}: ${okRuns}/${jobs.length} runs identical (${moves} moves compared) across ${chosen.length} ${A.label}s${shardNote} in ${secs} s` +
    (failures.length ? `; ${failures.length} differ` : '');
  console.log(`\n${summary}`);
  // On GitHub, the result as an annotation too, so it can be read from the check run.
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::${failures.length ? 'error' : 'notice'} title=replay ${TYPE}::${summary}`);
    for (const f of failures.slice(0, 10))
      console.log(`::error title=replay differs::${f.label} at ${f.diffs[0].at}`);
  }
  process.exit(failures.length ? 1 : 0);
}

if (A)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
