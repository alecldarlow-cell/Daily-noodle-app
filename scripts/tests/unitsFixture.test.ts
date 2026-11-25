declare const __dirname: string;
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs') as {
  readFileSync: (p: string, e: 'utf8') => string;
  writeFileSync: (p: string, s: string) => void;
  mkdtempSync: (p: string) => string;
  existsSync: (p: string) => boolean;
};
const os = require('os') as { tmpdir: () => string };
/* eslint-enable @typescript-eslint/no-require-imports */

type Fact = { q: { q: string; u: string; a: number; n: string; lo: number }; spec: unknown };
type Log = { log: jest.Mock; error: jest.Mock };
type Script = {
  serialise: (facts: Fact[]) => string;
  differences: (was: string, facts: Fact[]) => string[];
  main: (
    argv: string[],
    opts: { dest?: string; log?: Log; make?: (site: string) => Fact[] },
  ) => number;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const script = require('../reckon-units-fixture.js') as Script;

const fact = (q: string, a = 1, u = 'm'): Fact => ({ q: { q, u, a, n: '', lo: 0 }, spec: null });
const FACTS = [fact('How tall is Everest?', 8849), fact('How long is the Nile?', 6650000)];
const tmp = () => `${fs.mkdtempSync(`${os.tmpdir()}/units-fixture-`)}/units-fixture.json`;
const quiet = (): Log => ({ log: jest.fn(), error: jest.fn() });

describe('GIVEN the committed Reckon units fixture', () => {
  describe('WHEN the site builds the same facts', () => {
    it('THEN there are no differences', () => {
      expect(script.differences(script.serialise(FACTS), FACTS)).toEqual([]);
    });
  });

  describe('WHEN the site changes a fact, adds one and drops one', () => {
    it('THEN each is named by its question', () => {
      const now = [fact('How tall is Everest?', 8848), fact('How deep is the Mariana Trench?')];
      expect(script.differences(script.serialise(FACTS), now)).toEqual([
        'changed: How tall is Everest? [m]',
        'new: How deep is the Mariana Trench? [m]',
        'gone: How long is the Nile? [m]',
      ]);
    });
  });

  describe('WHEN only the order of the facts differs', () => {
    it('THEN it is still stale, as the file is compared byte for byte', () => {
      expect(script.differences(script.serialise([...FACTS].reverse()), FACTS)).toEqual([
        'same facts, written differently',
      ]);
    });
  });

  describe('WHEN the committed file is not a fixture', () => {
    it('THEN it says so rather than throwing', () => {
      expect(script.differences('{', FACTS)).toEqual(['the committed fixture is not valid JSON']);
      expect(script.differences('{}\n', FACTS)).toEqual([
        'the committed fixture is not a list of facts',
      ]);
    });
  });
});

describe('GIVEN the script run with --check', () => {
  describe('WHEN the committed fixture matches the site', () => {
    it('THEN it exits 0 and leaves the file alone', () => {
      const dest = tmp();
      fs.writeFileSync(dest, script.serialise(FACTS));
      const log = quiet();
      expect(script.main(['../dailynoodle', '--check'], { dest, log, make: () => FACTS })).toBe(0);
      expect(fs.readFileSync(dest, 'utf8')).toBe(script.serialise(FACTS));
      expect(log.error).not.toHaveBeenCalled();
    });
  });

  describe('WHEN the site has changed a fact', () => {
    it('THEN it exits 1, names the fact, says how to regenerate, and writes nothing', () => {
      const dest = tmp();
      fs.writeFileSync(dest, script.serialise(FACTS));
      const log = quiet();
      const now = [fact('How tall is Everest?', 8848), fact('How long is the Nile?', 6650000)];
      expect(script.main(['--check', '../site'], { dest, log, make: () => now })).toBe(1);
      const msg = log.error.mock.calls[0][0] as string;
      expect(msg).toContain('is stale');
      expect(msg).toContain('changed: How tall is Everest? [m]');
      expect(msg).toContain('node scripts/reckon-units-fixture.js ../dailynoodle');
      expect(fs.readFileSync(dest, 'utf8')).toBe(script.serialise(FACTS));
    });

    it('THEN a long list is cut to twenty lines and a count', () => {
      const dest = tmp();
      fs.writeFileSync(dest, script.serialise([]));
      const log = quiet();
      const many = Array.from({ length: 25 }, (_, i) => fact(`Question ${i}?`));
      expect(script.main(['--check'], { dest, log, make: () => many })).toBe(1);
      expect(log.error.mock.calls[0][0]).toContain('… and 5 more');
    });
  });

  describe('WHEN there is no committed fixture', () => {
    it('THEN it exits 1 and does not create one', () => {
      const dest = tmp();
      const log = quiet();
      expect(script.main(['--check'], { dest, log, make: () => FACTS })).toBe(1);
      expect(log.error.mock.calls[0][0]).toContain('is missing');
      expect(fs.existsSync(dest)).toBe(false);
    });
  });

  describe('WHEN it is given a site path', () => {
    it('THEN it builds from that path whichever side of --check it is', () => {
      const make = jest.fn(() => FACTS);
      const dest = tmp();
      fs.writeFileSync(dest, script.serialise(FACTS));
      script.main(['--check', '/x/site'], { dest, log: quiet(), make });
      expect(make).toHaveBeenLastCalledWith('/x/site');
    });
  });
});

describe('GIVEN the script run without --check', () => {
  describe('WHEN the site has facts', () => {
    it('THEN it writes the fixture as the check expects it', () => {
      const dest = tmp();
      const log = quiet();
      expect(script.main(['../dailynoodle'], { dest, log, make: () => FACTS })).toBe(0);
      expect(script.differences(fs.readFileSync(dest, 'utf8'), FACTS)).toEqual([]);
      expect(log.log).toHaveBeenCalledWith(expect.stringContaining('2 facts'));
    });
  });
});

describe('GIVEN the nightly Site drift workflow', () => {
  const yml = readFileSync(`${__dirname}/../../.github/workflows/site-drift.yml`);

  describe('WHEN it runs', () => {
    it('THEN it checks the Reckon units fixture against the site clone, and fails on a difference', () => {
      const step = /- name: Reckon units fixture current\?\n((?: {8}.*\n)*)/.exec(yml)?.[1] ?? '';
      expect(step).toContain('run: node scripts/reckon-units-fixture.js ../dailynoodle --check');
      expect(step).not.toContain('continue-on-error');
    });

    it('THEN the check runs even when the vendored-code step failed first', () => {
      const step = /- name: Reckon units fixture current\?\n((?: {8}.*\n)*)/.exec(yml)?.[1] ?? '';
      expect(step).toContain('if: ${{ !cancelled() }}');
    });
  });
});

function readFileSync(p: string) {
  return fs.readFileSync(p, 'utf8');
}
