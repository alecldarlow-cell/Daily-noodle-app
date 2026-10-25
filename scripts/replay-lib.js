/**
 * Shared pieces of the differential replays (scripts/replay.js and the per-type
 * scripts it hands over to, such as replay-link.js and replay-tangle.js): the site
 * clone's pages with their data, sampling, the phone page on a paused fake clock,
 * deep comparison and the run loop with its summary.
 */
const fs = require('fs');
const path = require('path');

function options(argv) {
  const args = argv.slice(2);
  const opt = (name, dflt) => {
    const i = args.indexOf(`--${name}`);
    return i < 0 ? dflt : args[i + 1];
  };
  const flag = (name) => args.includes(`--${name}`);
  const all = flag('all');
  return {
    type: opt('type', 'mini'),
    site: path.resolve(opt('site', '../dailynoodle')),
    all,
    sample: Number(opt('sample', all ? 0 : 50)),
    workers: Number(opt('workers', 2)),
    only: opt('only', null),
    variants: opt('variants', ''),
    verbose: flag('verbose'),
    /** "k/n": only the k-th of n equal slices of the pages (for long runs in parts). */
    part: opt('shard', null) || opt('part', null),
  };
}

/** The k-th of n slices of a list ("2/4"), or the whole list. */
function part(list, spec) {
  if (!spec) return list;
  const m = /^(\d+)\/(\d+)$/.exec(spec);
  if (!m || +m[1] < 1 || +m[1] > +m[2]) throw new Error(`replay: --shard wants k/n, not ${spec}`);
  const size = Math.ceil(list.length / +m[2]);
  return list.slice((+m[1] - 1) * size, +m[1] * size);
}

function site(dir) {
  if (!fs.existsSync(path.join(dir, 'tools/tests/harness.js'))) {
    console.error(`replay: ${dir} is not a dailynoodle clone (no tools/tests/harness.js)`);
    process.exit(2);
  }
  return {
    H: require(path.join(dir, 'tools/tests/harness.js')),
    parseDnPuzzle: require(path.join(dir, 'tools/puzzle-json.js')).parseDnPuzzle,
  };
}

/** Every page of a type (by file-name slug) with its data and day, oldest first. */
function pages(dir, slug, parseDnPuzzle) {
  const out = [];
  let without = 0;
  const re = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})-${slug}(?:-\\d+)?\\.html$`);
  for (const file of fs.readdirSync(path.join(dir, 'reports')).sort()) {
    const m = re.exec(file);
    if (!m) continue;
    const html = fs.readFileSync(path.join(dir, 'reports', file), 'utf8');
    const data = parseDnPuzzle(html, file);
    if (!data) {
      without++;
      continue;
    }
    const date = (/name="dn:date"\s+content="([^"]+)"/.exec(html) || [])[1] || m[1];
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
const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

/**
 * A phone page on a fake clock paused at `t`, with `seed` written to localStorage
 * before the first page load only, and every dn:puzzle_end collected in window.__ends.
 * `init` is an extra init script (a function) for the type.
 */
async function newPage(H, browser, seed, t, { reduced = false, init = null } = {}) {
  const ctx = await H.newPhone(browser, { reduced });
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
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  // Install a little early: real time flows until pauseAt, which can't go backwards.
  await p.clock.install({ time: new Date(t - 60_000) });
  await p.clock.pauseAt(new Date(t));
  return { ctx, p };
}

/** Run every job on `workers` pages at once; prints differences and exits 0 only if none. */
async function runAll({ name, jobs, workers, verbose, launch, one, units }) {
  const t0 = Date.now();
  const browser = await launch();
  let okRuns = 0;
  let moves = 0;
  const failures = [];
  const known = new Map();
  let next = 0;
  async function worker() {
    for (;;) {
      const job = jobs[next++];
      if (!job) return;
      try {
        const r = await one(browser, job);
        moves += r.moves || 0;
        for (const k of r.notes || []) known.set(k, (known.get(k) || 0) + 1);
        if (r.diffs.length) failures.push({ label: job.label, diffs: r.diffs });
        else okRuns++;
        if (verbose || r.diffs.length)
          console.log(`${r.diffs.length ? 'DIFF' : 'ok  '} ${job.label} (${r.moves || 0} moves)`);
      } catch (e) {
        failures.push({
          label: job.label,
          diffs: [{ at: 'error', web: String((e && e.stack) || e), native: '' }],
        });
        console.log(`ERR  ${job.label}: ${e && e.message}`);
      }
      const done = okRuns + failures.length;
      if (done % 50 === 0)
        console.log(`  … ${done}/${jobs.length} runs, ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.max(1, workers) }, worker));
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
  for (const [k, n] of known) console.log(`KNOWN site bug, not ported: ${k} (${n} runs)`);
  const secs = Math.round((Date.now() - t0) / 1000);
  const summary =
    `replay ${name}: ${okRuns}/${jobs.length} runs identical (${moves} moves compared) across ${units} in ${secs} s` +
    (failures.length ? `; ${failures.length} differ` : '');
  console.log(`\n${summary}`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::${failures.length ? 'error' : 'notice'} title=replay::${summary}`);
    for (const f of failures.slice(0, 10))
      console.log(`::error title=replay differs::${f.label} at ${f.diffs[0].at}`);
  }
  return failures.length ? 1 : 0;
}

/** Compare a list of [label, web, native] triples into diffs. */
function compare(diffs, rows) {
  for (const [k, a, b] of rows) if (!same(a, b)) diffs.push({ at: k, web: a, native: b });
}

module.exports = { options, site, pages, part, sample, same, sortKeys, newPage, runAll, compare };
