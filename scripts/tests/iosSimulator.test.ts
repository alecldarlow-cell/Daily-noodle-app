declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };

const root = `${__dirname}/../..`;
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8');

const yml = read('.github/workflows/ios-simulator.yml');
const script = read('scripts/ios-simulator-checks.sh');

/** The workflow's `on:` block: from `on:` to the next top-level key. */
const triggers = (text: string) => (/^on:\n((?: {2}.*\n|\n)*)/m.exec(text) ?? [])[1] ?? '';

/** The flows the script runs, in order: "name file". */
const flows = () =>
  [...script.matchAll(/^(?:\S.*&& )?flow (\S+) (\S+)/gm)].map((m) => `${m[1]} ${m[2]}`);

describe('GIVEN the iPhone simulator workflow (#217)', () => {
  describe('WHEN it runs', () => {
    it('THEN it never reaches the live database: the build has no Supabase settings', () => {
      expect(yml).not.toMatch(/EXPO_PUBLIC_SUPABASE|supabase\.co|EXPO_PUBLIC_SYNC/);
    });

    it('THEN it needs no secrets, Apple account or signing', () => {
      expect(yml).not.toMatch(/secrets\./);
      expect(yml).not.toMatch(/\beas (build|submit)\b|eas-cli/);
      expect(yml).toContain('CODE_SIGNING_ALLOWED=NO');
      expect(yml).toContain('-sdk iphonesimulator');
    });

    it('THEN it runs this commit’s JavaScript, with over-the-air updates switched off', () => {
      expect(yml).toContain('Set :EXUpdatesEnabled false');
      expect(yml).toContain('-configuration Release');
    });

    it('THEN it builds with Xcode 26, as SDK 58 needs 26.4 or later', () => {
      expect(yml).toMatch(/Xcode_26\*\.app \| sort -V \| tail -1/);
      expect(yml.match(/runs-on: macos-26$/gm)).toHaveLength(2);
    });

    it('THEN it keeps the app, Info.plist and privacy manifests, and the results', () => {
      expect(yml).toContain('name: ios-sim-app');
      expect(yml).toContain('PrivacyInfo.xcprivacy');
      expect(yml).toContain('name: ios-results');
      expect(yml).toMatch(/if: always\(\)\n\s+with:\n\s+name: ios-results/);
    });
  });

  describe('WHEN something is pushed', () => {
    it('THEN it runs only by hand or for pull requests that touch it or its flows', () => {
      const on = triggers(yml);
      expect(on).toMatch(/^ {2}workflow_dispatch:/m);
      expect(on).not.toMatch(/^ {2}(push|schedule|workflow_run):/m);
      for (const path of [
        '.github/workflows/ios-simulator.yml',
        'scripts/ios-simulator-checks.sh',
        '.maestro/review/**',
        '.maestro/store/**',
      ])
        expect(on).toContain(`- ${path}`);
    });

    it('THEN a run can reuse an earlier run’s app instead of building again', () => {
      expect(yml).toContain(
        "if: github.event_name != 'workflow_dispatch' || inputs.app_from_run == ''",
      );
      expect(yml).toContain('run-id: ${{ inputs.app_from_run || github.run_id }}');
    });
  });
});

describe('GIVEN the iPhone checks script', () => {
  describe('WHEN it runs the review flows', () => {
    it('THEN every setting Android checks is checked on iPhone too, plus links and the store set', () => {
      expect(flows()).toEqual([
        'resume .maestro/review/resume.yaml',
        'borders-round .maestro/review/borders-round.yaml',
        'links .maestro/review/links.yaml',
        'screens-normal .maestro/review/screens.yaml',
        'store-light .maestro/store/app-store.yaml',
        'screens-dark .maestro/review/screens.yaml',
        'borders-round-dark .maestro/review/borders-round.yaml',
        'store-dark .maestro/store/app-store.yaml',
        'screens-text2 .maestro/review/screens.yaml',
        'screens-reduced-motion .maestro/review/screens.yaml',
        'screens-small .maestro/review/screens.yaml',
      ]);
    });

    it('THEN Android’s Back key flow is left out, as iPhones have none', () => {
      expect(flows().some((f) => f.endsWith('back.yaml'))).toBe(false);
    });

    it('THEN each setting is switched on before its flow and off after', () => {
      expect(script).toMatch(/ui appearance dark\n[\s\S]*SET=dark[\s\S]*ui appearance light/);
      expect(script).toMatch(
        /content_size accessibility-large\n[\s\S]*SET=text2\n\s*ui content_size large/,
      );
      expect(script).toMatch(/ReduceMotionEnabled -bool true\n.*simctl boot[\s\S]*SET=reduced/);
    });

    it('THEN the screenshots come from a 6.9-inch phone and the small run from an SE', () => {
      expect(script).toContain("BIG_TYPE=$(devtype 'iPhone \\d+ Pro Max')");
      expect(script).toContain("SMALL_TYPE=$(devtype 'iPhone SE.*')");
      expect(script).toMatch(/boot pro-max "\$BIG_TYPE"\n(?:.*\n)*?flow store-light/);
    });

    it('THEN a failed flow is recorded and the run still fails at the end', () => {
      expect(script).toContain('FAILED=1');
      expect(script.trimEnd().endsWith('exit $FAILED')).toBe(true);
    });
  });
});

describe('GIVEN the shared review flows', () => {
  describe('WHEN a puzzle is left on an iPhone', () => {
    it('THEN it uses the puzzle’s Back to Puzzles, and Android keeps its Back key', () => {
      const player = read('.maestro/review/player.yaml');
      expect(player).toMatch(/platform: Android\n\s+commands:\n\s+- back\n/);
      expect(player).toMatch(/platform: iOS\n\s+commands:\n\s+- tapOn: 'Back to Puzzles'\n/);
      expect(player).not.toMatch(/^- back$/m);
    });
  });

  describe('WHEN the app is handed one of its own links', () => {
    it('THEN the invite opens Leagues and the sign-in link opens its screen', () => {
      const links = read('.maestro/review/links.yaml');
      expect(links).toMatch(
        /openLink: dailynoodle:\/\/leagues\?join=\S+\n(?:.*\n){1,3}\s+id: leagues-screen/,
      );
      expect(links).toMatch(/openLink: dailynoodle:\/\/auth\n(?:.*\n){1,3}\s+id: auth-screen/);
    });
  });

  describe('WHEN the store screenshots are taken', () => {
    it('THEN they are five scenes, numbered, per appearance', () => {
      const store = read('.maestro/store/app-store.yaml');
      const shots = [...store.matchAll(/takeScreenshot: \$\{SET\}-(\d-[a-z-]+)/g)].map((m) => m[1]);
      expect(shots).toEqual(['1-today', '2-mini', '3-doku-finish', '4-archive', '5-leagues']);
      expect(store).toContain('runScript: ../scripts/doku-today.js');
    });
  });
});
