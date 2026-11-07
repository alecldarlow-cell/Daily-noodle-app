/* Alec, 7 Nov 2026: cards sit within the tile's height, with one callout on each side. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { CARD_PAD, PuzzleRow, TILE } from '../PuzzleRow/PuzzleRow';

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
const card = (over: Partial<Parameters<typeof PuzzleRow>[0]> = {}) => (
  <PuzzleRow
    testID="c"
    type="doku"
    title="Doku 117"
    detail="A crossword with no clues. Place every letter so each line spells a word."
    when="Today"
    played={null}
    onPress={() => undefined}
    onHowTo={() => undefined}
    {...over}
  />
);

describe('GIVEN a puzzle card', () => {
  describe('WHEN it is laid out', () => {
    it('THEN the text column is the tile’s height, with the callout row pinned to its foot', async () => {
      await render(card());
      expect(TILE).toBe(96);
      expect(flat('c-body').minHeight).toBe(96);
      expect(flat('c-metarow').marginTop).toBe('auto');
    });

    it('THEN every card has 20 pt above and below', async () => {
      await render(card());
      const press = StyleSheet.flatten(screen.getByTestId('c').props.style);
      expect(CARD_PAD).toBe(20);
      expect(press.paddingVertical).toBe(20);
    });

    it('THEN a long description is cut to two lines, ending in one “…”', async () => {
      await render(card({ detail: 'one two three four five six seven' }));
      await fireEvent(
        screen.getByTestId('c-detail-measure', { includeHiddenElements: true }),
        'textLayout',
        {
          nativeEvent: {
            lines: [{ text: 'one two ' }, { text: 'three four ' }, { text: 'five six seven' }],
          },
        },
      );
      const d = screen.getByTestId('c-detail');
      expect(d.props.numberOfLines).toBe(2);
      expect(d).toHaveTextContent(/^one two three…$/);
    });
  });

  describe.each([
    ['Today, not played', { when: 'Today', played: null }, 'Today', null],
    [
      'Today, played',
      { when: 'Today', played: { done: true, lost: false, text: 'Solved in 2:20' } },
      'Today',
      'Solved in 2:20',
    ],
    ['Archive, not played', { when: 'Yesterday', played: null }, 'Yesterday', null],
    [
      'Archive, played',
      { when: '2d ago', played: { done: true, lost: false, text: '24 points' } },
      '2d ago',
      '24 points',
    ],
    [
      'in progress',
      { when: 'Today', played: { done: false }, roundTime: '1:12' },
      'Today',
      'Continue · 1:12',
    ],
  ] as const)('WHEN it is %s', (_name, over, left, result) => {
    it(`THEN the left says ${left} and the right has exactly one thing: ${result ?? 'How to play'}`, async () => {
      await render(card(over as never));
      expect(screen.getByTestId('c-meta')).toHaveTextContent(new RegExp(`^${left}$`));
      if (result) {
        expect(screen.getByTestId('c-result')).toHaveTextContent(result);
        expect(screen.queryByTestId('c-howto')).toBeNull();
      } else {
        expect(screen.getByTestId('c-howto')).toHaveTextContent('How to play');
        expect(screen.queryByTestId('c-result')).toBeNull();
      }
      expect(screen.queryByText(/~\d+ min/)).toBeNull();
    });
  });
});
