import { render, renderHook, screen, within } from '@testing-library/react-native';
import { View } from 'react-native';

import { RECAP_MAX } from '@/shared/finish-sheet';

import { tilesHtml } from '../borders/components/drawing';
import { recapTiles } from '../borders/model';
import { borders15 } from '../borders/tests/fixtures';
import { SolvedGrid as DokuGrid } from '../doku/components/DokuGrids';
import { init as dokuInit } from '../doku/model';
import { doku97 } from '../doku/tests/fixtures';
import { SolvedGrid as MiniGrid } from '../mini/components/MiniGrids';
import { init as miniInit } from '../mini/model';
import { mini105 } from '../mini/tests/fixtures';
import { PathRecap, threadCells } from '../path/components/PathBoard';
import { init as pathInit } from '../path/model';
import { path92 } from '../path/tests/fixtures';
import { useReckonColors } from '../reckon/components/colors';
import { ReckonRecap } from '../reckon/components/ReckonRecap';
import type { FinishInfo as ReckonInfo } from '../reckon/finishing';
import { recapRows } from '../reckon/model';
import { reckon2 } from '../reckon/tests/fixtures';
import { SweepRecap } from '../sweep/components/SweepBoard';
import { init as sweepInit } from '../sweep/model';
import { sweep94 } from '../sweep/tests/fixtures';
import { TangleRecap } from '../tangle/components/TangleRecap';
import { recap as tangleRecap } from '../tangle/model';
import { tangle19 } from '../tangle/tests/fixtures';

const noop = () => undefined;

describe('GIVEN the finish sheet’s grid recaps', () => {
  describe('WHEN Mini’s and Doku’s solved grids are shown', () => {
    it('THEN they are the site’s 300 wide, framed, and Doku’s givens are shaded and soft', async () => {
      const m = miniInit(mini105).p;
      await render(<MiniGrid grid={m.grid} nums={m.nums} />);
      expect(screen.getByTestId('solved-grid')).toHaveStyle({
        width: RECAP_MAX,
        borderWidth: 2,
        borderRadius: 6,
      });
      await render(<DokuGrid p={dokuInit(doku97).p} />);
      const given = screen.getAllByTestId(/^given-/);
      expect(given.length).toBeGreaterThan(0);
      expect(given[0]).toHaveStyle({ backgroundColor: '#DCDFE7' });
      expect(within(given[0]!).getByText(/[A-Z]/)).toHaveStyle({ color: '#545A6E' });
    });
  });

  describe('WHEN Path’s thread is shown', () => {
    it('THEN a line runs through every number 1 to 36 beneath round pills, the givens tinted', async () => {
      const s = pathInit(path92);
      const cells = threadCells(s.p.solution);
      expect(cells).toHaveLength(36);
      for (let k = 1; k < 36; k++) {
        const [r0, c0] = cells[k - 1]!;
        const [r1, c1] = cells[k]!;
        expect(Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0))).toBe(1); // each step to a neighbour
      }
      await render(<PathRecap state={s} />);
      expect(screen.getByTestId('path-recap')).toHaveStyle({ width: RECAP_MAX });
      const thread = screen.getByTestId('path-recap-thread');
      expect(within(thread).getAllByTestId('thread-bar')).toHaveLength(35);
      const firstGiven = [...s.p.lockedSet][0]!.split(',').map(Number) as [number, number];
      const v = s.p.solution[firstGiven[0]]![firstGiven[1]]!;
      expect(screen.getByTestId(`path-given-${v}`)).toHaveStyle({
        backgroundColor: '#DCE4FF',
        borderRadius: 13,
      });
    });
  });

  describe('WHEN Sweep’s board is shown', () => {
    it('THEN mines are drawn flags on gold, and numbers take the sheet’s colours', async () => {
      const s = sweepInit(sweep94, { ranked: true });
      await render(<SweepRecap state={s} />);
      const mines = screen.getAllByTestId('recap-mine');
      expect(mines).toHaveLength(s.p.MS.size);
      expect(mines[0]).toHaveStyle({ backgroundColor: '#FFEFB8' });
      expect(within(mines[0]!).getByTestId('recap-flag')).toBeOnTheScreen();
      expect(screen.queryByText('⚑')).toBeNull();
      const ones = screen.queryAllByText('1');
      if (ones.length) expect(ones[0]).toHaveStyle({ color: '#1B3B9E', fontSize: 18 });
    });

    it('THEN the mine you hit is pale red with a drawn cross', async () => {
      const s = sweepInit(sweep94, { ranked: true });
      const k = [...s.p.MS][0]!;
      await render(<SweepRecap state={{ ...s, boomed: new Set([k]) }} />);
      const boom = screen.getByTestId('recap-boom');
      expect(boom).toHaveStyle({ backgroundColor: '#FFD9D4' });
      expect(within(boom).getByTestId('mark-cross')).toBeOnTheScreen();
    });
  });

  describe('WHEN Reckon’s ten are listed', () => {
    it('THEN each score is a rounded badge, the question semibold, a hair line under every row', async () => {
      const rec = { p: 30, b: 1, z: Array(10).fill(1), g: reckon2.qs.map((q) => q.a), secs: 90 };
      const info = { rows: recapRows(reckon2, rec) } as unknown as ReckonInfo;
      const { result } = await renderHook(() => useReckonColors());
      await render(<ReckonRecap info={info} c={result.current} onRow={noop} />);
      expect(screen.getByTestId('reckon-pts-0')).toHaveStyle({
        borderRadius: 9,
        minWidth: 50,
        paddingHorizontal: 8,
        fontSize: 15,
      });
      expect(screen.getByTestId('reckon-row-9')).toHaveStyle({
        borderBottomWidth: 1,
        borderColor: '#DCDFE7',
      });
      expect(screen.getByText('Play more in Ballpark')).toHaveStyle({ color: '#1B3B9E' });
    });
  });

  describe('WHEN Tangle’s word bank is shown', () => {
    it('THEN found, missed and starred chips all keep a 2 pt edge, so they are one size', async () => {
      const r = tangleRecap(tangle19, ['ago', tangle19.star]);
      await render(
        <View>
          <TangleRecap r={r} />
        </View>,
      );
      const chips = screen.getAllByLabelText(/points, (found|missed)$/);
      expect(chips.length).toBeGreaterThan(2);
      for (const c of chips) expect(c).toHaveStyle({ borderWidth: 2 });
      const found = screen.getByLabelText(/^ago, \d+ points, found$/i);
      expect(found).toHaveStyle({ borderColor: 'transparent' });
    });
  });

  describe('WHEN Borders’ ten outlines are drawn', () => {
    it('THEN every outline is the sheet’s pale blue with an ink edge, a miss dashed and unfilled', () => {
      const rec = { c: 0, p: 0, secs: 0, ans: [], on: '2026-10-19' };
      const html = tilesHtml(recapTiles(borders15, rec), {} as never);
      expect(html).toContain('fill:#DCE4FF;stroke:#141726');
      expect(html).toContain('.x .t path{fill:transparent;stroke:#545A6E;stroke-dasharray:3 2}');
      expect(html).not.toContain('✕');
      const dark = tilesHtml(recapTiles(borders15, rec), {} as never, {
        tile: '#1B1E29',
        fill: '#25305C',
        ink: '#ECEEF4',
        soft: '#A6ABBD',
      });
      expect(dark).toContain('background:#1B1E29');
    });
  });
});
