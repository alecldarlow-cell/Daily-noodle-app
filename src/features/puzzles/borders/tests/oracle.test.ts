import { createSaveStore } from '@noodle/core';

import { mapHtml, tilesHtml, worldHtml } from '../components/drawing';
import { commitFinish, readSave, reopenInfo, saveHost } from '../finishing';
import { apply, ATLAS_KEY, init, recapTiles, SAVE_KEY } from '../model';
import { moves, scenario, startAt, VARIANTS } from '../oracle';
import { homeDate, memoryKV, Session, simulate } from '../simulate';
import { borders15 } from './fixtures';

const DAY = '2026-10-19';
const run = (v: (typeof VARIANTS)[number]) => {
  const sc = scenario(borders15, v, DAY);
  return { sc, sim: simulate(borders15, sc, startAt(sc, DAY, 1700), 3, 1700) };
};

describe('GIVEN the oracle', () => {
  describe.each(VARIANTS)('WHEN it plays the %s variant', (variant) => {
    it('THEN it finishes the ten, the same way every time', () => {
      expect(moves(borders15, variant)).toEqual(moves(borders15, variant));
      const { sc, sim } = run(variant);
      expect(sim.snaps).toHaveLength(sc.steps.length);
      expect(sim.final.end).toMatchObject({ type: 'geo-borders', outcome: 'scored', of: 10 });
    });
  });
});

describe('GIVEN a Borders simulated on a fake clock', () => {
  it('THEN the site’s own play scores seven of ten, counts its one hint and fills the atlas', () => {
    const { sim } = run('site');
    expect(sim.final.hero).toBe('7 of 10');
    expect(sim.final.end).toMatchObject({ got: 7, hints: 1 });
    expect(sim.final.share).toMatch(/^🌍 Borders #15 — 7\/10 · \d+ pts$/);
    expect(sim.final.note).toMatch(/^You missed .+ and .+\. Seven new countries in your atlas\.$/);
    expect(Object.keys((sim.final.atlas as { found: object }).found)).toHaveLength(7);
    expect(sim.final.save).toMatchObject({
      streak: { last: DAY, n: 1, best: 1 },
      cur: null,
      seenCoach: true,
    });
    expect(sim.final.kick).toBe('Borders 15');
    expect(sim.reopened).toMatchObject({
      share: sim.final.share,
      note: sim.final.note,
      hero: '7 of 10',
    });
  });

  it('THEN across midnight it is dated the next day and the streak goes on; known countries aren’t new', () => {
    const { sim } = run('resume');
    const save = sim.final.save as {
      done: Record<string, { on: string; ans: { nw: boolean }[] }>;
      streak: unknown;
    };
    expect(save.done[borders15.id]!.on).toBe('2026-10-20');
    expect(save.done[borders15.id]!.ans[0]!.nw).toBe(false);
    expect(save.streak).toEqual({ last: '2026-10-20', n: 5, best: 6 });
    expect((sim.final.atlas as { best: number }).best).toBe(7);
    expect(sim.snaps.filter((s) => s.saved !== undefined)).toHaveLength(3);
  });

  it('THEN played days late it still counts; a lapsed one starts again; a foreign atlas is left alone', () => {
    expect((run('archive').sim.final.save as { streak: unknown }).streak).toEqual({
      last: '2026-10-22',
      n: 4,
      best: 4,
    });
    const lapsed = run('lapsed').sim;
    expect((lapsed.final.save as { streak: unknown }).streak).toEqual({ last: DAY, n: 1, best: 9 });
    expect(lapsed.final.atlas).toEqual({ v: 2, countries: ['peru'] });
    expect(lapsed.final.note).toBe('All ten named.');
    expect(+lapsed.final.stats[2]!).toBe(Math.max(1240, +lapsed.final.stats[0]!)); // best score
  });

  it('THEN the home screen’s date has the comma Chromium writes', () => {
    expect(homeDate('2026-10-19')).toBe('Monday, 19 October');
  });
});

describe('GIVEN the finish', () => {
  it('THEN a session reopened before any finish has no sheet, and an unreadable save is none', () => {
    expect(new Session(borders15, {}, 0, 0).reopened()).toBeNull();
    expect(readSave({ getItem: () => '{', setItem: () => {} })).toBeNull();
  });

  it('THEN the sheet a reopened round shows is its saved record', () => {
    const kv = memoryKV();
    const saves = createSaveStore(kv, { now: () => 0 });
    const host = saveHost(
      saves,
      kv,
      borders15.id,
      () => 0,
      () => DAY,
    );
    let s = apply(init(borders15, null, 0), { t: 'play' }, host);
    for (let i = 0; i < 10; i++) {
      s = apply(s, { t: 'answer', k: 0 }, host);
      s = apply(s, { t: 'next' }, host);
    }
    const f = commitFinish(s, host);
    expect(f.state.save.done[borders15.id]).toEqual(f.rec);
    expect(JSON.parse(kv.getItem(SAVE_KEY)!).done[borders15.id]).toEqual(f.rec);
    const again = init(borders15, readSave(kv), 0);
    expect(reopenInfo(again, DAY)).toMatchObject({ hero: f.hero, note: f.note });
    expect(kv.getItem(ATLAS_KEY) === null).toBe(f.rec.c === 0);
  });
});

describe('GIVEN the pictures', () => {
  it('THEN they carry the outline, the inset only when shown, and the ten names', () => {
    const c = {} as never;
    const q = borders15.qs[0]!;
    const withInset = mapHtml(q, true, c);
    expect(withInset).toContain(q.d);
    expect(withInset).toContain('id="inset"');
    expect(mapHtml(q, false, c)).not.toContain('id="inset"');
    expect(worldHtml(c)).toContain('worldSVG');
    const rec = { c: 0, p: 0, secs: 0, ans: [], on: DAY };
    const html = tilesHtml(recapTiles(borders15, rec), c);
    for (const x of borders15.qs) expect(html).toContain(`<figcaption>${x.n}</figcaption>`);
  });
});
