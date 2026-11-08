declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { shippedPackages, missing } = require('../make-notices.js') as {
  shippedPackages: (lock: unknown) => { name: string; version: string }[];
  missing: (text: string, pkgs: { name: string; version: string }[]) => string[];
};

const root = `${__dirname}/../..`;
const lock = JSON.parse(readFileSync(`${root}/package-lock.json`, 'utf8'));

describe('GIVEN THIRD-PARTY-NOTICES.md (copyright audit, 8 Nov 2026)', () => {
  describe('WHEN it is compared with the packages the app is built from', () => {
    it('THEN it lists every non-dev package in package-lock.json, so a new dependency needs a fresh run of make-notices', () => {
      const pkgs = shippedPackages(lock);
      expect(pkgs.length).toBeGreaterThan(100);
      expect(missing(readFileSync(`${root}/THIRD-PARTY-NOTICES.md`, 'utf8'), pkgs)).toEqual([]);
    });

    it('THEN it carries SCOWL’s required notice and names the fonts and map data', () => {
      const t = readFileSync(`${root}/THIRD-PARTY-NOTICES.md`, 'utf8');
      expect(t).toContain('Copyright 2000-2018 by Kevin Atkinson');
      expect(t).toContain('SIL Open Font License');
      expect(t).toContain('Natural Earth');
    });
  });

  describe('WHEN the lock has dev-only and workspace entries', () => {
    it('THEN they are left out and duplicates are listed once', () => {
      const fake = {
        packages: {
          '': {},
          'node_modules/a': { version: '1.0.0', license: 'MIT' },
          'node_modules/b/node_modules/a': { version: '1.0.0', license: 'MIT' },
          'node_modules/dev-only': { version: '2.0.0', dev: true },
          'node_modules/@noodle/core': { link: true },
        },
      };
      expect(shippedPackages(fake).map((p) => `${p.name}@${p.version}`)).toEqual(['a@1.0.0']);
    });
  });
});
