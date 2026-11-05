import { createCachedStorage } from '@/shared/storage';

import { keepToday, trimPuzzles } from '../keepPuzzles';
import { PUZZLE_CACHE_PREFIX, progressKey } from '../rounds';

const mockGet = jest.fn();
jest.mock('@/shared/net', () => ({ getJson: (p: string) => mockGet(p) }));

const backend = () => {
  const m = new Map<string, string>();
  return {
    m,
    getAllKeys: async () => [...m.keys()],
    multiGet: async (k: readonly string[]) => k.map((x) => [x, m.get(x) ?? null] as const),
    setItem: async (k: string, v: string) => void m.set(k, v),
    removeItem: async (k: string) => void m.delete(k),
  };
};
async function store() {
  const b = backend();
  const s = createCachedStorage(b);
  await s.hydrate();
  return { s, b };
}
const puzzle = (id: string, size = 100) =>
  JSON.stringify({ id, path: `reports/${id}.html`, data: { pad: 'x'.repeat(size) } });
const key = (f: string) => PUZZLE_CACHE_PREFIX + f;

describe('GIVEN today’s list', () => {
  beforeEach(() => mockGet.mockReset());

  it('WHEN it arrives THEN each puzzle not kept yet comes down, so it plays offline', async () => {
    const { s } = await store();
    s.setItem(key('2026-11-05-a'), puzzle('a'));
    mockGet.mockResolvedValue(JSON.parse(puzzle('b')));
    await keepToday(['reports/2026-11-05-a.html', 'reports/2026-11-05-b.html'], s);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('reports/2026-11-05-b.json');
    expect(s.getItem(key('2026-11-05-b'))).toContain('"id":"b"');
  });

  it('WHEN there is no signal, or a bad file THEN the rest still come down and nothing throws', async () => {
    const { s } = await store();
    mockGet
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ nonsense: true })
      .mockResolvedValueOnce(JSON.parse(puzzle('c')));
    await keepToday(['reports/a.html', 'reports/b.html', 'reports/c.html'], s);
    expect(s.getItem(key('a'))).toBeNull();
    expect(s.getItem(key('b'))).toBeNull();
    expect(s.getItem(key('c'))).not.toBeNull();
  });
});

describe('GIVEN kept puzzles over the budget', () => {
  it('WHEN trimmed THEN the oldest go first, from the phone too, and results never', async () => {
    const { s, b } = await store();
    for (const d of ['01', '02', '03']) s.setItem(key(`2026-11-${d}-a`), puzzle(d, 1000));
    s.setItem('digi-mini-v1', 'x'.repeat(5000));
    await s.flush();
    expect(trimPuzzles(s, [], 2500)).toBe(1);
    await s.flush();
    expect(s.getItem(key('2026-11-01-a'))).toBeNull();
    expect(b.m.has(key('2026-11-01-a'))).toBe(false);
    expect(s.getItem(key('2026-11-02-a'))).not.toBeNull();
    expect(s.getItem('digi-mini-v1')).not.toBeNull();
  });

  it('WHEN under budget THEN nothing goes', async () => {
    const { s } = await store();
    s.setItem(key('2026-11-01-a'), puzzle('a'));
    expect(trimPuzzles(s, [], 1_000_000)).toBe(0);
  });

  it('WHEN a puzzle is today’s or has a round waiting THEN it stays', async () => {
    const { s } = await store();
    s.setItem(key('2026-01-01-a'), puzzle('held-mini', 1000));
    s.setItem(key('2026-01-02-b'), puzzle('held-link', 1000));
    s.setItem(key('2026-01-03-c'), puzzle('held-tangle', 1000));
    s.setItem(key('2026-01-04-d'), puzzle('today', 1000));
    s.setItem(key('2026-01-05-e'), puzzle('old', 1000));
    s.setItem(progressKey('mini'), JSON.stringify({ id: 'held-mini', moves: [1] }));
    s.setItem('digi-link-v1', JSON.stringify({ cur: { id: 'held-link' } }));
    s.setItem('digi-tangle-v1', JSON.stringify({ days: { 'held-tangle': { state: 'playing' } } }));
    trimPuzzles(s, ['reports/2026-01-04-d.html'], 10);
    expect(s.getItem(key('2026-01-05-e'))).toBeNull();
    for (const k of ['2026-01-01-a', '2026-01-02-b', '2026-01-03-c', '2026-01-04-d'])
      expect(s.getItem(key(k))).not.toBeNull();
  });
});
