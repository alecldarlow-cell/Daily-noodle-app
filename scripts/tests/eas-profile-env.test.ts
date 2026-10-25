import easJson from '../../eas.json';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { profileEnv, exportLines } = require('../eas-profile-env') as {
  profileEnv: (eas: unknown, name: string) => Record<string, string>;
  exportLines: (env: Record<string, string>) => string;
};

const EAS = {
  build: {
    base: { env: { A: '1', B: 'base' } },
    preview: { extends: 'base', env: { B: 'preview', C: "it's" } },
    loop: { extends: 'loop' },
  },
};

describe('GIVEN eas.json build profiles', () => {
  describe('WHEN a profile extends another', () => {
    it('THEN its env is merged over the base, nearest winning', () => {
      expect(profileEnv(EAS, 'preview')).toEqual({ A: '1', B: 'preview', C: "it's" });
    });
  });

  describe('WHEN the profile is missing or extends in a loop', () => {
    it('THEN it refuses rather than exporting nothing', () => {
      expect(() => profileEnv(EAS, 'nope')).toThrow('No build profile "nope"');
      expect(() => profileEnv(EAS, 'loop')).toThrow('in a loop');
    });
  });

  describe('WHEN the env is turned into shell lines', () => {
    it('THEN each value is single-quoted, a quote inside escaped', () => {
      expect(exportLines({ C: "it's", A: '$HOME' })).toBe("export A='$HOME'\nexport C='it'\\''s'");
    });

    it('THEN a name that isn’t a shell variable is refused', () => {
      expect(() => exportLines({ 'A-B': 'x' })).toThrow('Bad variable name');
    });
  });
});

describe('GIVEN the repo’s own eas.json', () => {
  describe('WHEN the Release workflow asks for the preview profile', () => {
    it('THEN the Supabase settings leagues need are exported', () => {
      const out = exportLines(profileEnv(easJson, 'preview'));
      expect(out).toMatch(/^export EXPO_PUBLIC_SUPABASE_URL='https:\/\/.+\.supabase\.co'$/m);
      expect(out).toMatch(/^export EXPO_PUBLIC_SUPABASE_ANON_KEY='.+'$/m);
    });
  });
});
