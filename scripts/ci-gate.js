#!/usr/bin/env node
// Publishes only green commits (hardening G1). Before `eas update`, the Release and Update
// production workflows run this with the commit they are about to publish: it asks GitHub's
// REST API for that commit's CI runs (ci.yml: check, replay plan, the replays and their
// summary) and fails unless every one of them finished green. With --tip it also checks the
// commit is still the branch's tip; if the branch has moved on it says so and writes
// `publish=false` (the newer commit publishes after its own CI) instead of failing.
//
// Usage: node scripts/ci-gate.js <sha> [--tip main] [--wait <seconds>]
// Env:   GITHUB_TOKEN (the workflow's token, with actions: read), GITHUB_REPOSITORY,
//        GITHUB_API_URL (optional), GITHUB_OUTPUT (optional, for publish=true|false)
const fs = require('fs');

const CI_WORKFLOW = 'ci.yml';

/**
 * The decision for one commit, from its CI runs (the API's workflow_runs, latest attempt
 * each) and the branch tip (or null when not asked). `publish`: go ahead; `fail`: stop red.
 */
function verdict(runs, sha, tip) {
  const short = sha.slice(0, 7);
  if (tip && tip !== sha)
    return {
      publish: false,
      fail: false,
      why: `main has moved on to ${tip.slice(0, 7)}; that commit publishes after its own CI, not ${short}.`,
    };
  const mine = runs.filter((r) => r.head_sha === sha);
  if (!mine.length) return { publish: false, fail: true, why: `No CI run found for ${short}.` };
  const open = mine.find((r) => r.status !== 'completed');
  if (open)
    return {
      publish: false,
      fail: true,
      why: `CI for ${short} is still ${open.status} (${open.html_url}).`,
    };
  const red = mine.find((r) => r.conclusion !== 'success');
  if (red)
    return {
      publish: false,
      fail: true,
      why: `CI for ${short} concluded ${red.conclusion} (${red.html_url}); nothing is published.`,
    };
  return { publish: true, fail: false, why: `CI for ${short} is green (${mine.length} run(s)).` };
}

async function api(path, { token, base, fetchFn }) {
  const res = await fetchFn(`${base}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res.json();
}

/**
 * Looks the commit up (waiting up to `waitMs` while its CI is still running) and returns the
 * verdict. Network or permission failures throw: no answer is never a green light.
 */
async function gate({
  sha,
  repo,
  token,
  tipBranch = null,
  waitMs = 0,
  base = 'https://api.github.com',
  fetchFn = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  pollMs = 20_000,
}) {
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error(`Not a full commit sha: "${sha}"`);
  if (!repo || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');
  const o = { token, base, fetchFn };
  let waited = 0;
  for (;;) {
    const tip = tipBranch
      ? (await api(`/repos/${repo}/branches/${encodeURIComponent(tipBranch)}`, o)).commit.sha
      : null;
    const { workflow_runs: runs = [] } = await api(
      `/repos/${repo}/actions/workflows/${CI_WORKFLOW}/runs?head_sha=${sha}&per_page=100`,
      o,
    );
    const v = verdict(runs, sha, tip);
    const running = v.fail && runs.some((r) => r.head_sha === sha && r.status !== 'completed');
    if (!running || waited >= waitMs) return v;
    await sleep(pollMs);
    waited += pollMs;
  }
}

function args(argv) {
  const out = { sha: argv[0], tip: null, wait: 0 };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--tip') out.tip = argv[++i];
    else if (argv[i] === '--wait') out.wait = Number(argv[++i]) || 0;
  }
  return out;
}

if (require.main === module) {
  const a = args(process.argv.slice(2));
  gate({
    sha: a.sha,
    repo: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
    tipBranch: a.tip,
    waitMs: a.wait * 1000,
    base: process.env.GITHUB_API_URL || 'https://api.github.com',
  }).then(
    (v) => {
      if (process.env.GITHUB_OUTPUT)
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `publish=${v.publish}\n`);
      console.log(v.fail ? `::error::${v.why}` : v.publish ? v.why : `::notice::${v.why}`);
      process.exit(v.fail ? 1 : 0);
    },
    (e) => {
      console.log(`::error::Couldn't check CI: ${e.message}`);
      process.exit(1);
    },
  );
}

module.exports = { verdict, gate, args };
