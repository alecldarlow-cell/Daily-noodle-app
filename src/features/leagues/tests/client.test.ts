import { boardClient, rpc, rpcOver } from '../api/client';
import { BoardError, isOffline, SaidError, sayError } from '../api/errors';

/** A Supabase client whose requests go to a fake server, never the network. */
function fakeServer(
  reply: (fn: string, body: unknown) => { status: number; body: unknown } | Error,
) {
  const seen: { url: string; body: unknown; apikey: string | null }[] = [];
  const fetchImpl = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    const body = JSON.parse(String(init?.body ?? 'null'));
    seen.push({ url: u, body, apikey: new Headers(init?.headers).get('apikey') });
    const r = reply(u.split('/rpc/')[1] ?? '', body);
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const client = boardClient('https://fake.test', 'anon-key', fetchImpl as unknown as typeof fetch);
  return { call: rpcOver(client), seen };
}

describe('GIVEN the board functions behind Supabase’s rpc', () => {
  describe('WHEN a call succeeds', () => {
    it('THEN it posts the arguments with the anon key and returns the data', async () => {
      const s = fakeServer(() => ({ status: 200, body: { name: 'Family', members: 3 } }));
      await expect(s.call('board_peek', { p_code: 'ABCD2345' })).resolves.toEqual({
        name: 'Family',
        members: 3,
      });
      expect(s.seen).toEqual([
        {
          url: 'https://fake.test/rest/v1/rpc/board_peek',
          body: { p_code: 'ABCD2345' },
          apikey: 'anon-key',
        },
      ]);
    });
  });

  describe('WHEN the server refuses (raise exception)', () => {
    it('THEN the error carries the reason and the site’s words for it', async () => {
      const s = fakeServer(() => ({ status: 400, body: { code: 'P0001', message: 'nick_taken' } }));
      const e = await s.call('board_join', {}).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(BoardError);
      expect(e).toMatchObject({
        code: 'nick_taken',
        message: 'Someone in that league already uses that nickname.',
      });
    });
  });

  describe('WHEN there is no connection', () => {
    it('THEN it is told apart from a refusal, and says to check the connection', async () => {
      const s = fakeServer(() => new TypeError('Network request failed'));
      const e = await s.call('board_mine', {}).catch((x: unknown) => x);
      expect(e).toMatchObject({
        code: 'offline',
        message: 'Couldn’t reach the leagues. Check your connection and try again.',
      });
      expect(isOffline(e)).toBe(true);
      expect(sayError(e)).toBe('Couldn’t reach the leagues. Check your connection and try again.');
    });
  });

  describe('WHEN the server answers with an error it has no words for', () => {
    it('THEN the player sees “Something went wrong”, never the server’s text', async () => {
      const s = fakeServer(() => ({ status: 500, body: { message: 'internal: relation x' } }));
      const e = await s.call('board_mine', {}).catch((x: unknown) => x);
      expect(isOffline(e)).toBe(false);
      expect(sayError(e)).toBe('Something went wrong. Please try again.');
      expect(sayError(new Error('TypeError: undefined is not a function'))).toBe(
        'Something went wrong. Please try again.',
      );
      expect(sayError(new SaidError('Our own words.'))).toBe('Our own words.');
    });
  });

  describe('WHEN the build has no Supabase settings (as in every test)', () => {
    it('THEN nothing is sent and the call says leagues aren’t available', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      await expect(rpc('board_mine', { p_player: 'x' })).rejects.toMatchObject({
        code: 'not_configured',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(boardClient(undefined, 'k')).toBeNull();
      await expect(rpcOver(null)('board_mine', {})).rejects.toMatchObject({
        code: 'not_configured',
      });
    });
  });

  describe('WHEN the client itself throws', () => {
    it('THEN it is reported as a failed call', async () => {
      const broken = { rpc: () => Promise.reject(new Error('boom')) } as never;
      await expect(rpcOver(broken)('board_mine', {})).rejects.toMatchObject({ code: 'error' });
    });
  });
});
