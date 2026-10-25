// eslint-disable-next-line @typescript-eslint/no-require-imports
const { select, nativeTypes } = require('../replay-select') as {
  select: (files: string[], types: string[]) => string[];
  nativeTypes: () => string[];
};

const TYPES = ['doku', 'link', 'mini', 'path', 'sweep', 'tangle'];

describe('GIVEN a pull request’s changed files', () => {
  it('THEN a type’s own code replays that type only', () => {
    expect(
      select(
        ['src/features/puzzles/mini/model.ts', 'scripts/replay-link.js', 'scripts/replay/sweep.js'],
        TYPES,
      ),
    ).toEqual(['link', 'mini', 'sweep']);
  });

  it('THEN code every type shares replays them all', () => {
    for (const f of [
      'packages/core/src/streaks.ts',
      'src/shared/finish-sheet/FinishSheet.tsx',
      'src/features/puzzles/components/NativePlay.tsx',
      'scripts/replay-lib.js',
      'scripts/replay/common.js',
      'package-lock.json',
      '.github/workflows/ci.yml',
    ])
      expect(select([f], TYPES)).toEqual(TYPES);
  });

  it('THEN docs, leagues, account, the bridge and assets replay nothing', () => {
    expect(
      select(
        [
          'docs/log.md',
          'src/features/leagues/hooks/useResults.ts',
          'src/features/account/x.ts',
          'src/shared/webview/injection.ts',
          'store/feature-graphic.png',
          '',
        ],
        TYPES,
      ),
    ).toEqual([]);
  });

  it('THEN the native types are read from the puzzle folders that have a model', () => {
    const found = nativeTypes();
    expect(found).toEqual(expect.arrayContaining(TYPES));
    expect(found).not.toContain('components');
  });
});
