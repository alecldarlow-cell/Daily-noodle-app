import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';
import { BOARD_SLOT } from '@/shared/ui';

import { bankTileSize } from '../doku/components/DokuBank';
import { DokuScreen } from '../doku/components/DokuScreen';
import { file97 } from '../doku/tests/fixtures';
import { MiniScreen } from '../mini/components/MiniScreen';
import { file105 } from '../mini/tests/fixtures';
import { PathScreen } from '../path/components/PathScreen';
import { file92 } from '../path/tests/fixtures';
import { SweepScreen } from '../sweep/components/SweepScreen';
import { file94 } from '../sweep/tests/fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 915, scale: 2.6, fontScale: 1 })),
}));
const mockWindow = useWindowDimensions as jest.Mock;

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  mockSite({});
  mockWindow.mockImplementation(() => ({ width: 412, height: 915, scale: 2.6, fontScale: 1 }));
});

const play = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

describe.each([
  ['Mini', () => <MiniScreen file={file105} />],
  ['Doku', () => <DokuScreen file={file97} />],
  ['Sweep', () => <SweepScreen file={file94} />],
  ['Path', () => <PathScreen file={file92} />],
])('GIVEN %s on a tall phone', (_name, el) => {
  describe('WHEN the board is laid out', () => {
    it('THEN its slot takes the spare height and holds the board at its bottom, by the controls (AF-032)', async () => {
      await renderWithProviders(el());
      await play();
      expect(flat('board-slot')).toMatchObject({
        flex: 1,
        justifyContent: 'flex-end',
        minHeight: 0,
      });
    });

    it('THEN the board is still sized from the slot (a 700 pt tall slot, 388 wide: a 382 pt board in its 3 pt frame)', async () => {
      await renderWithProviders(el());
      await play();
      expect(JSON.stringify(screen.toJSON())).not.toContain('"width":388');
      await fireEvent(screen.getByTestId('board-slot'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 388, height: 700 } },
      });
      const json = JSON.stringify(screen.toJSON());
      expect(json).toContain('"width":388');
    });
  });
});

describe('GIVEN the shared board slot', () => {
  it('THEN the spare height goes above the board, never between it and the controls', () => {
    expect(BOARD_SLOT.justifyContent).toBe('flex-end');
  });
});

describe('GIVEN Doku’s bank tiles', () => {
  describe('WHEN the phone is tall (a 412 × 915 Pixel)', () => {
    it('THEN they are near a grid square’s size, much bigger than the old 44 pt', () => {
      expect(bankTileSize({ width: 412, height: 915 })).toBe(56);
      expect(bankTileSize({ width: 360, height: 780 })).toBe(54);
    });
  });
  describe('WHEN the phone is short (under 700 pt)', () => {
    it('THEN they keep 44 pt, so the board keeps its room', () => {
      expect(bankTileSize({ width: 360, height: 640 })).toBe(44);
    });
  });
  describe('WHEN the phone is narrow (320 pt)', () => {
    it('THEN they never go under 40 pt', () => {
      expect(bankTileSize({ width: 220, height: 800 })).toBe(40);
    });
  });

  describe('WHEN the board is on screen', () => {
    it('THEN each tile is drawn at that size, its letter in proportion', async () => {
      await renderWithProviders(<DokuScreen file={file97} />);
      await play();
      const tile = screen.getAllByRole('button', { name: /^Tile / })[0]!;
      expect(StyleSheet.flatten(tile.props.style)).toMatchObject({ width: 56, height: 56 });
    });

    it('THEN Hints sits on the message’s line, at its end, not alone under the board', async () => {
      await renderWithProviders(<DokuScreen file={file97} />);
      await play();
      const hints = screen.getByTestId('doku-hints');
      const row = hints.parent!;
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row' });
      const kids = row.children as unknown as { props: { testID?: string } }[];
      expect(kids.map((k) => k.props.testID)).toEqual(['doku-msg', 'doku-hints']);
    });
  });
});

declare const __dirname: string;

describe('GIVEN Link and Tangle on a tall phone (AF-032)', () => {
  it('THEN Link’s rows and Tangle’s board sit at the bottom of their spare height, by the thumb', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const link = require('fs').readFileSync(
      `${__dirname}/../link/components/LinkBoard.tsx`,
      'utf8',
    ) as string;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tangle = require('fs').readFileSync(
      `${__dirname}/../tangle/components/TangleBoard.tsx`,
      'utf8',
    ) as string;
    expect(link).toMatch(/board: \{ flex: 1, gap: 7, justifyContent: 'flex-end' \}/);
    expect(tangle).toMatch(
      /boardWrap: \{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' \}/,
    );
  });
});
