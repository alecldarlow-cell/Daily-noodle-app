import { createReporter, MAX_PER_LAUNCH, scrub, watchGlobalErrors } from '../report';

jest.mock('@/shared/build', () => ({
  buildInfo: () => ({ version: '0.3.0', channel: 'production', update: 'ab12cd34' }),
}));

const ENV = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k',
};
const ok = () => jest.fn(async () => ({ ok: true })) as unknown as jest.Mock & typeof fetch;
const bodyOf = (post: jest.Mock, i = 0) =>
  JSON.parse((post.mock.calls[i]![1] as { body: string }).body).p;

describe('GIVEN the error log', () => {
  it('WHEN an error is reported THEN what broke goes to the site, with no visitor or player code', () => {
    const post = ok();
    const r = createReporter({ env: ENV, dev: false, post });
    r.setAllow(() => true);
    r.report('crash', new Error('board fell over'), '/play');
    expect(post.mock.calls[0]![0]).toBe('https://x.supabase.co/rest/v1/rpc/log_app_error');
    const p = bodyOf(post);
    expect(p).toMatchObject({
      kind: 'crash',
      message: 'Error: board fell over',
      screen: '/play',
      version: '0.3.0',
      update: 'ab12cd34',
    });
    expect(Object.keys(p).sort()).toEqual(
      ['kind', 'message', 'platform', 'screen', 'stack', 'update', 'version'].sort(),
    );
  });

  it('WHEN the text holds an email, a player id or a token THEN they are taken out', () => {
    expect(scrub('no user a.b@c.co.uk here')).toBe('no user [email] here');
    expect(scrub('player 00000000-0000-4000-8000-00000000000a gone')).toBe('player [id] gone');
    expect(scrub('dailynoodle://auth#access_token=abc&x=1')).toBe(
      'dailynoodle://auth#access_token=[token]&x=1',
    );
  });

  it('WHEN the player has opted out, or the saves are not read yet THEN nothing is sent', () => {
    const post = ok();
    const r = createReporter({ env: ENV, dev: false, post });
    r.report('crash', new Error('before the saves'));
    r.setAllow(() => false);
    r.report('crash', new Error('opted out'));
    expect(post).not.toHaveBeenCalled();
  });

  it('WHEN in development THEN nothing is sent', () => {
    const post = ok();
    const r = createReporter({ env: ENV, dev: true, post });
    r.setAllow(() => true);
    r.report('crash', new Error('dev'));
    expect(post).not.toHaveBeenCalled();
  });

  it('WHEN one error repeats, or many arrive THEN one report each, up to the limit', () => {
    const post = ok();
    const r = createReporter({ env: ENV, dev: false, post });
    r.setAllow(() => true);
    r.report('crash', new Error('same'));
    r.report('crash', new Error('same'));
    expect(post).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) r.report('crash', new Error(`e${i}`));
    expect(post).toHaveBeenCalledTimes(MAX_PER_LAUNCH);
  });

  it('WHEN sending fails THEN nothing is thrown', async () => {
    const post = jest.fn(async () => {
      throw new Error('no signal');
    }) as unknown as typeof fetch;
    const r = createReporter({ env: ENV, dev: false, post });
    r.setAllow(() => true);
    expect(() => r.report('save', 'text error', 'digi-mini-v1')).not.toThrow();
    await Promise.resolve();
  });
});

describe('GIVEN an error no screen caught', () => {
  it('WHEN it is fatal THEN it is reported, and the old handler runs after a moment', () => {
    jest.useFakeTimers();
    const before = jest.fn();
    let handler: (e: unknown, f?: boolean) => void = () => {};
    const report = jest.fn();
    watchGlobalErrors(
      { getGlobalHandler: () => before, setGlobalHandler: (h) => (handler = h) },
      report,
    );
    handler(new Error('x'), true);
    expect(report).toHaveBeenCalledWith('fatal', expect.any(Error));
    expect(before).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(before).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('WHEN it is not fatal THEN the old handler runs at once', () => {
    const before = jest.fn();
    let handler: (e: unknown, f?: boolean) => void = () => {};
    watchGlobalErrors(
      { getGlobalHandler: () => before, setGlobalHandler: (h) => (handler = h) },
      jest.fn(),
    );
    handler(new Error('x'), false);
    expect(before).toHaveBeenCalled();
  });
});
