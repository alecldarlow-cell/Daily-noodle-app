import { createCachedStorage, type AsyncBackend } from '../cachedStorage';

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
    });

    it('THEN a value written before hydration finished is kept, being newer', async () => {
      const s = createCachedStorage(backend({ k: 'old' }));
      s.setItem('k', 'new');
      await s.hydrate();
      expect(s.getItem('k')).toBe('new');
    });

    it('THEN an empty phone hydrates cleanly', async () => {
      const s = createCachedStorage(backend());
      await s.hydrate();
      expect(s.keys()).toEqual([]);
    });
  });

  describe('WHEN a value is written', () => {
    it('THEN it reaches the phone’s storage and subscribers hear of it', async () => {
      const b = backend();
      const s = createCachedStorage(b);
      const heard = jest.fn();
      const off = s.subscribe('k', heard);
      s.setItem('k', 'v');
      expect(heard).toHaveBeenCalledTimes(1);
      await s.flush();
      expect(b.data.get('k')).toBe('v');
      off();
      s.setItem('k', 'w');
      expect(heard).toHaveBeenCalledTimes(1);
    });

    it('THEN a failed write is reported and later writes still go through', async () => {
      const b = backend({}, 'bad');
      const onError = jest.fn();
      const s = createCachedStorage(b, onError);
      s.setItem('bad', '1');
      s.setItem('good', '2');
      await s.flush();
      expect(onError).toHaveBeenCalledWith('bad', expect.any(Error));
      expect(b.data.get('good')).toBe('2');
      expect(s.getItem('bad')).toBe('1');
    });
  });
});
