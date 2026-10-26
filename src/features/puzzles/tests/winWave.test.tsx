import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { forgetReduceMotion } from '@/shared/motion';
import { renderWithProviders } from '@/shared/testing';

import { DokuBoard } from '../doku/components/DokuBoard';
import { init as dokuInit } from '../doku/model';
import { doku97 } from '../doku/tests/fixtures';
import { MiniBoard } from '../mini/components/MiniBoard';
import { init as miniInit } from '../mini/model';
import { mini105 } from '../mini/tests/fixtures';
import { PathBoard } from '../path/components/PathBoard';
import { init as pathInit } from '../path/model';
import { path92 } from '../path/tests/fixtures';
import { SweepBoard } from '../sweep/components/SweepBoard';
import { init as sweepInit } from '../sweep/model';
import { sweep94 } from '../sweep/tests/fixtures';

const flush = () => act(async () => undefined);
const open = (grid: string[][]) => grid.flat().filter((ch) => ch !== '#').length;
const noop = () => undefined;

beforeEach(() => {
  forgetReduceMotion();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());

describe('GIVEN a board in play', () => {
  describe('WHEN it is not being won', () => {
    it('THEN no square carries the wave', async () => {
      await renderWithProviders(<MiniBoard state={miniInit(mini105)} side={300} onCell={noop} />);
      await flush();
      expect(screen.queryAllByTestId('wave-cell')).toHaveLength(0);
    });
  });
});

describe('GIVEN a board just won', () => {
  describe('WHEN it is a Mini or Doku', () => {
    it('THEN every square but the blocks grows and flashes, as the site’s :not(.block)', async () => {
      await renderWithProviders(
        <MiniBoard celebrating state={miniInit(mini105)} side={300} onCell={noop} />,
      );
      await flush();
      expect(screen.getAllByTestId('wave-cell')).toHaveLength(open(mini105.grid));
      expect(screen.getAllByTestId('wave-flash')).toHaveLength(open(mini105.grid));
      await renderWithProviders(
        <DokuBoard celebrating state={dokuInit(doku97)} side={300} onCell={noop} />,
      );
      await flush();
      expect(screen.getAllByTestId('wave-cell')).toHaveLength(open(doku97.grid));
    });
  });

  describe('WHEN it is a Sweep', () => {
    it('THEN all 36 squares join the wave', async () => {
      await renderWithProviders(
        <SweepBoard
          celebrating
          state={sweepInit(sweep94, { ranked: true })}
          side={300}
          dark={false}
          onTap={noop}
          onPress={noop}
        />,
      );
      await flush();
      expect(screen.getAllByTestId('wave-cell')).toHaveLength(36);
    });
  });

  describe('WHEN it is a Path', () => {
    it('THEN every square but the givens pulses, as path.css :not(.locked)', async () => {
      const s = pathInit(path92);
      await renderWithProviders(<PathBoard celebrating state={s} side={300} onCell={noop} />);
      await flush();
      expect(screen.getAllByTestId('wave-cell')).toHaveLength(36 - s.p.lockedSet.size);
    });
  });
});
