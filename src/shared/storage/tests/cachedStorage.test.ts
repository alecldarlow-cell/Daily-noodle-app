import { createCachedStorage, UnsavedError, type AsyncBackend } from '../cachedStorage';

function backend(init: Record<string, string> = {}, failOn?: string) {
  const data = new Map(Object.entries(init));
  const b: AsyncBackend & { data: Map<string, string> } = {
    data,
    getAllKeys: async () => [...data.keys()],
    multiGet: async (keys) => keys.map((k) => [k, data.get(k) ?? null] as const),
    setItem: async (k, v) => {
      if (k === failOn) throw new Error('disk full');
      data.set(k, v);
    },
  };
  return b;
}

afterEach(() => jest.useRealTimers());

describe('GIVEN saves on the phone', () => {
  describe('WHEN the store hydrates', () => {
    it('THEN reads are synchronous and match what was saved', async () => {
      const s = createCachedStorage(backend({ 'digi-mini-v1': '{"v":1}' }));
      expect(s.hydrated).toBe(false);
      await s.hydrate();
      expect(s.hydrated).toBe(true);
      expect(s.getItem('digi-mini-v1')).toBe('{"v":1}');
      expect(s.getItem('missing')).toBeNull();
      expect(s.keys()).toEqual(['digi-mini-v1']);
      await s.hydrate();
      expect(s.keys()).toEqual(['digi-mini-v1']);
    });

    // Changed with hardening R2: the disk used to lose to an earlier in-memory write.
    it('THEN the disk wins over a write made before it was read, which never reaches the disk', async () => {
      const b = backend({ k: 'old' });
      const s = createCachedStorage(b);
      s.setItem('k', 'new');
      s.setItem('fresh', 'v');
      await s.flush();
      expect(b.data.get('fresh')).toBeUndefined();
      await s.hydrate();
      expect(s.getItem('k')).toBe('old');
      await s.flush();
      expect(b.data.get('k')).toBe('old');
      expect(b.data.get('fresh')).toBe('v');
    });

    it('THEN an empty phone hydrates cleanly', async () => {
      const s = createCachedStorage(backend());
      await s.hydrate();
      expect(s.keys()).toEqual([]);
    });

    it('THEN two hydrations at once read the disk once', async () => {
      const b = backend({ k: 'v' });
      const spy = jest.spyOn(b, 'getAllKeys');
      const s = createCachedStorage(b);
      await Promise.all([s.hydrate(), s.hydrate()]);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('WHEN a value is written', () => {
    it('THEN it reaches the phone’s storage and subscribers hear of it', async () => {
      const b = backend();
      const s = createCachedStorage(b);
      await s.hydrate();
      const heard = jest.fn();
      const off = s.subscribe('k', heard);
      s.setItem('k', 'v');
      expect(heard).toHaveBeenCalledTimes(1);
      await s.flush();
      expect(b.data.get('k')).toBe('v');
      off();
      s.setItem('k', 'w');
      expect(heard).toHaveBeenCalledTimes(1);
      expect(s.saveStatus).toBe('saved');
    });

    // Changed with hardening R1: flush() used to resolve with the write lost.
    it('THEN a failed write is reported, kept queued, flush rejects, and later writes still go through', async () => {
      jest.useFakeTimers();
      const b = backend({}, 'bad');
      const onError = jest.fn();
      const s = createCachedStorage(b, onError);
      await s.hydrate();
      s.setItem('bad', '1');
      s.setItem('good', '2');
      await expect(s.flush()).rejects.toEqual(new UnsavedError(['bad']));
      expect(onError).toHaveBeenCalledWith('bad', expect.any(Error));
      expect(b.data.get('good')).toBe('2');
      expect(s.getItem('bad')).toBe('1');
      expect(s.unsaved()).toEqual(['bad']);
      expect(s.saveStatus).toBe('retrying');
    });

    it('THEN only the latest value of a key is written once the disk recovers', async () => {
      jest.useFakeTimers();
      let failing = true;
      const b = backend();
      const writes: string[] = [];
      const real = b.setItem;
      b.setItem = async (k, v) => {
        if (failing) throw new Error('io');
        writes.push(`${k}=${v}`);
        return real(k, v);
      };
      const s = createCachedStorage(b, { retryMs: [100, 300] });
      await s.hydrate();
      const status = jest.fn();
      s.subscribeStatus(status);
      s.setItem('k', '1');
      s.setItem('k', '2');
      await jest.advanceTimersByTimeAsync(0);
      expect(s.saveStatus).toBe('retrying');
      await jest.advanceTimersByTimeAsync(100); // first retry, still failing
      expect(s.saveStatus).toBe('retrying');
      failing = false;
      await jest.advanceTimersByTimeAsync(299);
      expect(writes).toEqual([]);
      await jest.advanceTimersByTimeAsync(1); // second retry, after the longer wait
      expect(writes).toEqual(['k=2']);
      expect(s.saveStatus).toBe('saved');
      expect(status).toHaveBeenCalledTimes(2);
    });

    it('THEN a disposable key’s failed write is dropped and never holds the notice', async () => {
      const b = backend({}, 'cache');
      const s = createCachedStorage(b, { isDisposable: (k) => k === 'cache' });
      await s.hydrate();
      s.setItem('cache', 'x');
      await expect(s.flush()).resolves.toBeUndefined();
      expect(s.saveStatus).toBe('saved');
      expect(s.unsaved()).toEqual([]);
      expect(s.getItem('cache')).toBe('x');
    });
  });
});
