declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };

const read = (name: string) => readFileSync(`${__dirname}/../../.github/workflows/${name}`, 'utf8');

/** The workflow's `on:` block: from `on:` to the next top-level key. */
const triggers = (yml: string) => (/^on:\n((?: {2}.*\n|\n)*)/m.exec(yml) ?? [])[1] ?? '';

/** The CLI pin the env block sets, e.g. "eas-cli@25.3.0". */
const easPin = (yml: string) => (/^ {2}EAS: npx --yes (eas-cli@\S+)$/m.exec(yml) ?? [])[1];

describe('GIVEN the production update workflow', () => {
  const yml = read('update-production.yml');

  describe('WHEN something is merged to main', () => {
    it('THEN nothing publishes to production: it runs only from "Run workflow"', () => {
      const on = triggers(yml);
      expect(on).toMatch(/^ {2}workflow_dispatch:/m);
      expect(on).not.toMatch(/^ {2}(push|pull_request|schedule|workflow_run):/m);
    });
  });

  describe('WHEN it is run', () => {
    it('THEN it stops unless it is on main', () => {
      expect(yml).toContain("github.ref != 'refs/heads/main'");
    });

    it('THEN it publishes to the production channel with the production profile’s env', () => {
      expect(yml).toContain('eval "$(node scripts/eas-profile-env.js production)"');
      expect(yml).toMatch(
        /\$EAS update --channel production --environment production --message "\$MESSAGE" --non-interactive/,
      );
    });

    it('THEN it publishes from Linux, as the builds’ fingerprints are computed there', () => {
      expect(yml).toMatch(/^ {4}runs-on: ubuntu-latest$/m);
    });

    it('THEN it uses the same eas-cli as the Release workflow', () => {
      expect(easPin(yml)).toBe('eas-cli@25.3.0');
      expect(easPin(yml)).toBe(easPin(read('release.yml')));
    });
  });
});

describe('GIVEN the Release workflow', () => {
  describe('WHEN something is merged to main', () => {
    // Changed with hardening G1: it used to run on the push itself, before CI had finished.
    it('THEN its automatic update still goes to preview only, and only after CI completes', () => {
      const yml = read('release.yml');
      const on = triggers(yml);
      expect(on).toMatch(
        /^ {2}workflow_run:\n {4}workflows: \[CI\]\n {4}types: \[completed\]\n {4}branches: \[main\]$/m,
      );
      expect(on).not.toMatch(/^ {2}push:/m);
      expect(yml).toContain('update --channel preview --environment preview');
      expect(yml).not.toMatch(/--channel production/);
    });

    it('THEN only a push whose CI passed publishes, from that exact commit', () => {
      const yml = read('release.yml');
      expect(yml).toContain("github.event.workflow_run.event == 'push'");
      expect(yml).toContain("github.event.workflow_run.conclusion == 'success'");
      expect(yml).toContain('ref: ${{ github.event.workflow_run.head_sha }}');
      expect(yml).toContain('MESSAGE: ${{ github.event.workflow_run.head_commit.message }}');
    });
  });
});

/** The job's steps in order: each `- ` item under `steps:` as one string. */
const steps = (yml: string) =>
  yml
    .split(/^ {6}- /m)
    .slice(1)
    .map((s) => s.split(/^ {2}\S/m)[0]!);

describe.each([
  [
    'release.yml',
    'node scripts/ci-gate.js "$SHA" --tip main',
    'github.event.workflow_run.head_sha',
  ],
  ['update-production.yml', 'node scripts/ci-gate.js "$SHA" --wait 900', 'github.sha'],
])('GIVEN %s and a red commit', (file, command, sha) => {
  const yml = read(file);
  const list = steps(yml);
  const gateAt = list.findIndex((s) => s.includes('node scripts/ci-gate.js'));
  const updateAt = list.findIndex((s) => /\$EAS update /.test(s));

  describe('WHEN it would publish an update', () => {
    it('THEN the CI gate runs first, on the commit being published, with the workflow’s token', () => {
      expect(gateAt).toBeGreaterThanOrEqual(0);
      expect(updateAt).toBeGreaterThan(gateAt);
      const gate = list[gateAt]!;
      expect(gate).toContain(command);
      expect(gate).toContain(`SHA: \${{ ${sha} }}`);
      expect(gate).toContain('GITHUB_TOKEN: ${{ github.token }}');
      // A gate that may fail quietly would publish anyway.
      expect(gate).not.toMatch(/continue-on-error|\|\| true/);
      expect(yml).toMatch(/^permissions:\n {2}contents: read\n(?: {2}#.*\n)* {2}actions: read$/m);
    });

    it('THEN nothing between the gate and the update can run past a red gate', () => {
      for (const s of list.slice(gateAt + 1, updateAt + 1)) {
        expect(s).not.toMatch(/if: always\(\)|continue-on-error/);
        if (file === 'release.yml') expect(s).toContain("steps.gate.outputs.publish == 'true'");
      }
      if (file === 'release.yml') expect(list[gateAt]).toContain('id: gate');
    });
  });
});
