import { fireEvent, render, screen } from '@testing-library/react-native';

import { PuzzleRow } from '../PuzzleRow/PuzzleRow';
import { PuzzleTile, tileCells } from '../PuzzleTile/PuzzleTile';
import { Screen } from '../Screen/Screen';

describe('GIVEN a card’s mask from feed-lite', () => {
  describe('WHEN it is a 5×5 Mini grid', () => {
    it('THEN blocks stay blocks and the first open cell is the start square', async () => {
      const g = tileCells('#....' + '.....'.repeat(4));
      expect(g?.size).toBe(5);
      expect(g?.cells.slice(0, 3)).toEqual(['b', 'a', '']);
      expect(g?.cells.filter((c) => c === 'a')).toHaveLength(1);
    });
  });

  describe('WHEN it is Sweep’s 6×6 with a free opening', () => {
    it('THEN the opening, not the first cell, is the start square', async () => {
      const mask = '.'.repeat(20) + 'o' + '.'.repeat(15);
      expect(tileCells(mask)?.cells.indexOf('a')).toBe(20);
    });
  });

  describe('WHEN it is Doku’s pre-set letters', () => {
    it('THEN they show as pre-set cells', async () => {
      expect(tileCells('#####....L........L.#####')?.cells[9]).toBe('l');
    });
  });

  describe('WHEN it is Link’s 4×4 of chips', () => {
    it('THEN there is no start square', async () => {
      const g = tileCells('.'.repeat(16));
      expect(g?.size).toBe(4);
      expect(g?.cells).not.toContain('a');
    });
  });

  describe('WHEN it is empty or an odd length', () => {
    it('THEN there is no grid to draw', async () => {
      expect(tileCells('')).toBeNull();
      expect(tileCells(undefined)).toBeNull();
      expect(tileCells('.'.repeat(20))).toBeNull();
    });
  });
});

describe('GIVEN a tile to draw', () => {
  it('THEN a grid type draws its cells, with one start square', async () => {
    await render(<PuzzleTile type="mini" mask={'.'.repeat(25)} testID="t" />);
    expect(screen.getByTestId('t-start')).toBeOnTheScreen();
  });

  it('THEN Borders, Reckon and Tangle draw the site’s pictures', async () => {
    for (const type of ['borders', 'reckon', 'tangle'] as const) {
      const { unmount } = await render(<PuzzleTile type={type} testID={`p-${type}`} />);
      expect(screen.getByTestId(`p-${type}`).props.source).toBeTruthy();
      await unmount();
    }
  });

  it('THEN a grid type without a mask yet falls back to a plain Play tile', async () => {
    await render(<PuzzleTile type="doku" testID="t" />);
    expect(screen.getByText('Play')).toBeOnTheScreen();
  });
});

describe('GIVEN a puzzle card', () => {
  const base = {
    type: 'mini' as const,
    title: 'Mini 106',
    detail: 'A Bramley or a Cox.',
    mask: '.'.repeat(25),
    when: 'Today',
    read: '~3 min',
    testID: 'c',
  };

  describe('WHEN it hasn’t been played', () => {
    it('THEN its meta line gives the day and reading time, and it has no mark', async () => {
      await render(<PuzzleRow {...base} played={null} onPress={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Mini 106, Today' })).toBeOnTheScreen();
      expect(screen.getByText('~3 min')).toBeOnTheScreen();
      expect(screen.queryByTestId('c-mark')).toBeNull();
    });
  });

  describe('WHEN it has been solved', () => {
    it('THEN the result replaces the reading time and the tile carries a tick', async () => {
      await render(
        <PuzzleRow
          {...base}
          played={{ done: true, lost: false, text: 'Solved in 0:54' }}
          onPress={jest.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: 'Mini 106, Solved in 0:54' })).toBeOnTheScreen();
      expect(screen.queryByText('~3 min')).toBeNull();
      expect(screen.getByTestId('c-mark')).toHaveTextContent('✓');
    });
  });

  describe('WHEN it is in progress', () => {
    it('THEN it says so and the tile carries a dot, not a tick', async () => {
      await render(<PuzzleRow {...base} played={{ done: false }} onPress={jest.fn()} />);
      expect(screen.getByText('In progress')).toBeOnTheScreen();
      expect(screen.getByTestId('c-mark')).not.toHaveTextContent('✓');
    });
  });

  describe('WHEN “How to play” is tapped', () => {
    it('THEN the guide opens and the puzzle doesn’t', async () => {
      const onPress = jest.fn();
      const onHowTo = jest.fn();
      await render(<PuzzleRow {...base} played={null} onPress={onPress} onHowTo={onHowTo} />);
      await fireEvent.press(screen.getByRole('link', { name: 'How to play Mini' }));
      expect(onHowTo).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
    });
  });
});

describe('GIVEN a page', () => {
  describe('WHEN it is drawn', () => {
    it('THEN the site’s masthead leads it, with the page’s name as the header', async () => {
      await render(<Screen title="Archive" subtitle="Sun 25 Oct" />);
      expect(screen.getByText('DP')).toBeOnTheScreen();
      expect(screen.getByText('Puzzles')).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Archive' })).toBeOnTheScreen();
      expect(screen.getByText('Sun 25 Oct')).toBeOnTheScreen();
    });
  });
});
