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
    it('THEN its automatic update still goes to preview only', () => {
      const yml = read('release.yml');
      expect(triggers(yml)).toMatch(/^ {2}push:/m);
      expect(yml).toContain('update --channel preview --environment preview');
      expect(yml).not.toMatch(/--channel production/);
    });
  });
});
