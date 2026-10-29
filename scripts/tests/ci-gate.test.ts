// eslint-disable-next-line @typescript-eslint/no-require-imports
const { verdict, gate, args } = require('../ci-gate') as {
  verdict: (runs: Run[], sha: string, tip: string | null) => Verdict;
  gate: (o: Record<string, unknown>) => Promise<Verdict>;
  args: (argv: string[]) => { sha: string; tip: string | null; wait: number };
};

interface Run {
  head_sha: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}
interface Verdict {
  publish: boolean;
  fail: boolean;
  why: string;
}

const SHA = 'a'.repeat(40);
const NEWER = 'b'.repeat(40);
const run = (o: Partial<Run> = {}): Run => ({
  head_sha: SHA,
  status: 'completed',
  conclusion: 'success',
  html_url: 'https://github.com/x/y/actions/runs/1',
  ...o,
});

/** GitHub's REST API in miniature: main's tip and the commit's CI runs, answer by answer. */
function github(tip: string, runsByCall: Run[][]) {
  let call = 0;
  const fetchFn = jest.fn(async (url: string) => {
    if (url.includes('/branches/main'))
      return { ok: true, json: async () => ({ commit: { sha: tip } }) };
    if (url.includes('/actions/workflows/ci.yml/runs?head_sha=')) {
      const runs = runsByCall[Math.min(call++, runsByCall.length - 1)];
      return { ok: true, json: async () => ({ workflow_runs: runs }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  return fetchFn;
}

describe('GIVEN a commit about to be published as an EAS Update', () => {
  describe('WHEN its CI is red, cancelled, still running or missing', () => {
    it.each([
      ['failed', [run({ conclusion: 'failure' })]],
      ['one of two runs failed', [run(), run({ conclusion: 'failure' })]],
      ['cancelled', [run({ conclusion: 'cancelled' })]],
      ['still running', [run({ status: 'in_progress', conclusion: null })]],
      ['no run at all', []],
      ['only another commit’s run', [run({ head_sha: NEWER })]],
    ])('THEN it can’t publish (%s)', (_name, runs) => {
      expect(verdict(runs as Run[], SHA, null)).toMatchObject({ publish: false, fail: true });
    });
  });

  describe('WHEN every CI run for it is green', () => {
    it('THEN it publishes', () => {
      expect(verdict([run(), run()], SHA, null)).toMatchObject({ publish: true, fail: false });
      expect(verdict([run()], SHA, SHA)).toMatchObject({ publish: true });
    });
  });

  describe('WHEN main has moved on to a newer commit', () => {
    it('THEN it doesn’t publish and doesn’t fail: the newer commit publishes after its own CI', () => {
      expect(verdict([run()], SHA, NEWER)).toMatchObject({ publish: false, fail: false });
    });
  });
});

describe('GIVEN the gate asking GitHub', () => {
  const base = { sha: SHA, repo: 'o/r', token: 't', base: 'https://api' };

  it('THEN a red commit is refused, asked about by its exact sha with the token', async () => {
    const fetchFn = github(SHA, [[run({ conclusion: 'failure' })]]);
    await expect(gate({ ...base, tipBranch: 'main', fetchFn })).resolves.toMatchObject({
      publish: false,
      fail: true,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      `https://api/repos/o/r/actions/workflows/ci.yml/runs?head_sha=${SHA}&per_page=100`,
      { headers: expect.objectContaining({ Authorization: 'Bearer t' }) },
    );
  });

  it('THEN with a wait it polls while CI runs, and publishes once it is green', async () => {
    const sleep = jest.fn(async () => undefined);
    const fetchFn = github(SHA, [[run({ status: 'in_progress', conclusion: null })], [run()]]);
    await expect(
      gate({ ...base, fetchFn, sleep, waitMs: 60_000, pollMs: 20_000 }),
    ).resolves.toMatchObject({ publish: true });
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('THEN the wait is bounded: still running after it is a refusal', async () => {
    const sleep = jest.fn(async () => undefined);
    const fetchFn = github(SHA, [[run({ status: 'queued', conclusion: null })]]);
    await expect(
      gate({ ...base, fetchFn, sleep, waitMs: 40_000, pollMs: 20_000 }),
    ).resolves.toMatchObject({ publish: false, fail: true });
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('THEN no answer is never a green light', async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }));
    await expect(gate({ ...base, fetchFn })).rejects.toThrow('GitHub API 403');
    await expect(gate({ ...base, sha: 'main', fetchFn })).rejects.toThrow('Not a full commit sha');
    await expect(gate({ ...base, token: '', fetchFn })).rejects.toThrow('GITHUB_TOKEN');
  });

  it('THEN its command line takes the sha, --tip and --wait', () => {
    expect(args([SHA, '--tip', 'main', '--wait', '900'])).toEqual({
      sha: SHA,
      tip: 'main',
      wait: 900,
    });
    expect(args([SHA])).toEqual({ sha: SHA, tip: null, wait: 0 });
  });
});
