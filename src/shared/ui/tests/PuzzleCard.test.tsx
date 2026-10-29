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
    it('THEN it says Continue (AF-020) and the tile carries a dot, not a tick', async () => {
      await render(<PuzzleRow {...base} played={{ done: false }} onPress={jest.fn()} />);
      expect(screen.getByText('Continue')).toBeOnTheScreen();
      expect(screen.queryByText('In progress')).toBeNull();
      expect(screen.getByTestId('c-mark')).not.toHaveTextContent('✓');
      expect(screen.getByRole('button', { name: 'Mini 106, Continue' })).toBeOnTheScreen();
    });

    it('THEN its round’s time shows after Continue, keeping the day', async () => {
      await render(
        <PuzzleRow {...base} played={{ done: false }} roundTime="4:05" onPress={jest.fn()} />,
      );
      expect(screen.getByTestId('c-meta')).toHaveTextContent('Today  ·  Continue  ·  4:05');
      expect(screen.getByRole('button', { name: 'Mini 106, Continue, 4:05' })).toBeOnTheScreen();
    });
  });

  describe('WHEN it is finished and a stale round time is passed', () => {
    it('THEN only the result shows', async () => {
      await render(
        <PuzzleRow
          {...base}
          played={{ done: true, lost: false, text: 'Solved in 1:27' }}
          roundTime="4:05"
          onPress={jest.fn()}
        />,
      );
      expect(screen.getByTestId('c-meta')).toHaveTextContent('Today  ·  Solved in 1:27');
    });
  });

  describe('WHEN the phone is offline and the puzzle is downloaded', () => {
    it('THEN the meta line says Downloaded, and so does its label', async () => {
      await render(<PuzzleRow {...base} played={null} kept onPress={jest.fn()} />);
      expect(screen.getByTestId('c-meta')).toHaveTextContent('Today  ·  ~3 min  ·  Downloaded');
      expect(screen.getByRole('button', { name: 'Mini 106, Today, downloaded' })).toBeOnTheScreen();
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

describe('GIVEN a row with a long day and result beside How to play', () => {
  it('THEN when and result stay on one line, shrinking to fit rather than breaking', async () => {
    await render(
      <PuzzleRow
        testID="row"
        type="doku"
        title="Doku 104"
        when="Yesterday"
        played={{ done: true, lost: false, text: 'Solved in 1:20' }}
        onPress={() => undefined}
        onHowTo={() => undefined}
      />,
    );
    const meta = screen.getByTestId('row-meta');
    expect(meta).toHaveTextContent('Yesterday · Solved in 1:20');
    expect(meta.props.numberOfLines).toBe(1);
    expect(meta.props.adjustsFontSizeToFit).toBe(true);
  });
});
