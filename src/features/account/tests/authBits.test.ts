import { chunkedStorage } from '../api/sessionStorage';
import { syncEnabled } from '../api/authClient';
import { readAuthLink } from '../hooks/authLink';
import { emailSchema } from '../schemas/email';

function secure() {
  const m = new Map<string, string>();
  return {
    m,
    getItemAsync: async (k: string) => m.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void m.set(k, v),
    deleteItemAsync: async (k: string) => void m.delete(k),
  };
}

describe('GIVEN the sign-in session in the secure store', () => {
  it('THEN a long session is split into chunks and read back whole', async () => {
    const b = secure();
    const s = chunkedStorage(b);
    const long = 'x'.repeat(5000);
    await s.setItem('sb-abc-auth-token', long);
    expect(await s.getItem('sb-abc-auth-token')).toBe(long);
    expect(b.m.get('sb-abc-auth-token.n')).toBe('3');
  });
  it('THEN a shorter session removes the old chunks, and removing clears everything', async () => {
    const b = secure();
    const s = chunkedStorage(b);
    await s.setItem('k', 'y'.repeat(5000));
    await s.setItem('k', 'short');
    expect(await s.getItem('k')).toBe('short');
    expect([...b.m.keys()].sort()).toEqual(['k.0', 'k.n']);
    await s.removeItem('k');
    expect(b.m.size).toBe(0);
    expect(await s.getItem('k')).toBeNull();
  });
  it('THEN a missing chunk reads as no session, and odd key characters are made safe', async () => {
    const b = secure();
    const s = chunkedStorage(b);
    await s.setItem('a:b', 'z'.repeat(4000));
    expect([...b.m.keys()].every((k) => /^[A-Za-z0-9._-]+$/.test(k))).toBe(true);
    b.m.delete('a_b.1');
    expect(await s.getItem('a:b')).toBeNull();
  });
});

describe('GIVEN a build’s settings', () => {
  it('THEN sync is on only with the switch and both Supabase values', () => {
    const base = { EXPO_PUBLIC_SUPABASE_URL: 'u', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k' };
    expect(syncEnabled({ ...base, EXPO_PUBLIC_SYNC: '1' })).toBe(true);
    expect(syncEnabled(base)).toBe(false);
    expect(syncEnabled({ EXPO_PUBLIC_SYNC: '1' })).toBe(false);
  });
});

describe('GIVEN a link that opened the app', () => {
  it('THEN a sign-in link gives its tokens', () => {
    expect(
      readAuthLink('dailynoodle://auth#access_token=A&refresh_token=R&type=magiclink'),
    ).toEqual({ ok: true, access_token: 'A', refresh_token: 'R' });
    expect(
      readAuthLink(
        'exp+daily-noodle://expo-development-client/--/auth#access_token=A&refresh_token=R',
      ),
    ).toEqual({ ok: true, access_token: 'A', refresh_token: 'R' });
  });
  it('THEN an expired link gives Supabase’s reason', () => {
    expect(
      readAuthLink(
        'dailynoodle://auth#error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({ ok: false, error: 'Email link is invalid or has expired' });
  });
  it.each([
    null,
    '',
    'dailynoodle://leagues?join=ABCD',
    'dailynoodle://auth',
    'https://dailynoodle.co.uk/author',
  ])('THEN %p is not a sign-in', (u) => {
    expect(readAuthLink(u)).toBeNull();
  });
});

describe('GIVEN an email address typed in', () => {
  it('THEN it is tidied, and nonsense is refused with a plain reason', async () => {
    await expect(emailSchema.validate('  Alec@Example.com ')).resolves.toBe('alec@example.com');
    await expect(emailSchema.validate('alec')).rejects.toThrow('doesn’t look like an email');
    await expect(emailSchema.validate('')).rejects.toThrow('Enter your email');
  });
});
