'use strict';
/**
 * Which puzzle types a change needs replayed on its pull request (CI's replay job).
 * A type's own code (its feature folder, its replay script) replays that type; code
 * every type shares (the core package, the shared sheets, the replay runner, the
 * dependencies, this workflow) replays them all; anything else (docs, leagues, account,
 * the WebView bridge, store assets) replays none. Every puzzle is still replayed in full
 * before a type is first switched on, and whenever the site changes its engine.
 *
 *   git diff --name-only origin/main...HEAD | node scripts/replay-select.js
 *   → ["mini","sweep"]   (JSON on stdout)
 */
const fs = require('node:fs');
const path = require('node:path');

/** Types with a native player: a folder under src/features/puzzles with a replay to run. */
function nativeTypes(root = path.join(__dirname, '..')) {
  const dir = path.join(root, 'src/features/puzzles');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'model.ts')))
    .map((d) => d.name)
    .sort();
}

const SHARED = [
  /^packages\/core\//,
  /^src\/shared\/(finish-sheet|start-card|results|storage|time|theme)\//,
  /^src\/features\/puzzles\/(components|api|types)\b/,
  /^scripts\/(replay\.js|replay-lib\.js|replay-select\.js|ts-register\.js|vendor-[\w-]+\.js)$/,
  /^package(-lock)?\.json$/,
  /^\.github\/workflows\/ci\.yml$/,
];

function select(files, types) {
  const want = new Set();
  for (const raw of files) {
    const f = raw.trim();
    if (!f) continue;
    if (SHARED.some((re) => re.test(f))) return [...types];
    // scripts/replay/<name>.js: a type's own module, or a helper they all share
    const m = /^scripts\/replay\/(.+)$/.exec(f);
    if (m && !types.some((t) => m[1] === `${t}.js`)) return [...types];
    for (const t of types) {
      if (
        f.startsWith(`src/features/puzzles/${t}/`) ||
        f === `scripts/replay/${t}.js` ||
        f === `scripts/replay-${t}.js`
      )
        want.add(t);
    }
  }
  return types.filter((t) => want.has(t));
}

module.exports = { select, nativeTypes, SHARED };

if (require.main === module) {
  const types = nativeTypes();
  const all = process.argv.includes('--all');
  const files = all ? [] : fs.readFileSync(0, 'utf8').split('\n');
  process.stdout.write(JSON.stringify(all ? types : select(files, types)) + '\n');
}
