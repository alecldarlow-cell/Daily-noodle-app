import type { CrypticData } from '../model';
import { kept, moves, scenario, startAt, VARIANTS } from '../oracle';
import { simulate } from '../simulate';
import pages from './pages.json';

const PAGES = pages as unknown as { path: string; date: string; data: CrypticData }[];

describe('GIVEN every Cryptic page and every replay variant', () => {
  it.each(PAGES.map((p) => [p.data.id, p] as const))(
    'WHEN %s is played natively THEN each variant finishes with one saved result',
    (_id, page) => {
      for (const v of VARIANTS) {
        const sc = scenario(page.data, v, page.date);
        const t = startAt(sc, page.date, 1700);
        const r = simulate(page.data, sc, t, t + 1200, t + 1700);
        expect(r.snaps).toHaveLength(sc.steps.length);
        expect(r.snaps.at(-1)!.sheet).toBe(true);
        const save = r.final.save as { done: Record<string, { h: number }>; cur?: unknown };
        expect(save.done[page.data.id]).toBeDefined();
        expect(save.cur).toBeUndefined();
        if (v === 'reveal') expect(save.done[page.data.id]!.h).toBe(page.data.n + 2);
        if (v === 'solve') expect(r.final.hints).toBe('no hints');
        expect(!!r.reopened).toBe(sc.reopen);
      }
    },
  );
});

describe('GIVEN the tries variant', () => {
  it('THEN it checks too early and wrong before the answer, and ends after midnight', () => {
    const p = PAGES[0]!;
    const steps = moves(p.data, 'tries');
    expect(steps.filter((s) => s.move.t === 'enter')).toHaveLength(3);
    const sc = scenario(p.data, 'tries', p.date);
    expect(sc.start).toBe('midnight');
    const t = startAt(sc, p.date, 1700);
    const r = simulate(p.data, sc, t, t + 1200, t + 1700);
    expect(r.snaps[2]!.msg).toBe('Fill every square, then press Enter.');
    expect((r.final.streak as { streak: number }).streak).toBe(5);
  });
  it('THEN a resumed clue keeps its first two letters and one hint', () => {
    const k = kept(PAGES[0]!.data);
    expect(k.hints).toBe(1);
    expect(k.letters.filter(Boolean)).toHaveLength(2);
  });
});
