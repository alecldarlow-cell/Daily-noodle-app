import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { howToRoom, META_MIN_WIDTH, PuzzleRow } from '../PuzzleRow/PuzzleRow';

const layout = (width: number, height = 24) => ({
  nativeEvent: { layout: { x: 0, y: 0, width, height } },
});

const row = () => (
  <PuzzleRow
    testID="r"
    type="mini"
    title="Mini 105"
    when="Yesterday"
    played={{ done: true, lost: false, text: 'Solved in 2:03' }}
    onPress={() => undefined}
    onHowTo={() => undefined}
  />
);

const metaRow = () => StyleSheet.flatten(screen.getByTestId('r-metarow').props.style);

describe('GIVEN a card with “How to play” beside its meta line', () => {
  describe('WHEN nothing has been measured yet', () => {
    it('THEN the meta line keeps the old 88 pt clear', () => {
      expect(howToRoom(0, 0, 0)).toEqual({ paddingRight: 88 });
      expect(howToRoom(220, 0, 0)).toEqual({ paddingRight: 88 });
    });
  });

  describe('WHEN the text is the usual size', () => {
    it('THEN the meta line keeps clear exactly the link’s width, plus a gap', async () => {
      await render(row());
      await fireEvent(screen.getByTestId('r-body'), 'layout', layout(230));
      await fireEvent(screen.getByTestId('r-howto'), 'layout', layout(80));
      expect(metaRow().paddingRight).toBe(88);
      expect(metaRow().paddingBottom).toBeUndefined();
    });
  });

  describe('WHEN the text is large (1.3) and the link has grown', () => {
    it('THEN the room grows with it, so the two never overlap', async () => {
      await render(row());
      await fireEvent(screen.getByTestId('r-body'), 'layout', layout(240));
      await fireEvent(screen.getByTestId('r-howto'), 'layout', layout(105, 31));
      // 105 pt plus the gap, where the fixed 88 left the link 25 pt over the meta line
      expect(metaRow().paddingRight).toBe(113);
      expect(metaRow().paddingBottom).toBeUndefined();
    });
  });

  describe('WHEN the text is so large (2.0) the meta line would be squeezed beside the link', () => {
    it('THEN the link drops onto a line of its own below the meta line', async () => {
      await render(row());
      await fireEvent(screen.getByTestId('r-body'), 'layout', layout(218));
      await fireEvent(screen.getByTestId('r-howto'), 'layout', layout(160, 48));
      expect(218 - 168).toBeLessThan(META_MIN_WIDTH);
      expect(metaRow().paddingRight).toBeUndefined();
      // room below for the whole link, so it sits under the meta line, not on it
      expect(metaRow().paddingBottom).toBe(52);
      expect(screen.getByTestId('r-meta')).toHaveTextContent('Yesterday  ·  Solved in 2:03');
    });
  });

  describe('WHEN a card has no How to play', () => {
    it('THEN the meta line keeps no room for it', async () => {
      await render(
        <PuzzleRow testID="r" type="mini" title="Mini 105" played={null} onPress={() => {}} />,
      );
      expect(metaRow().paddingRight).toBeUndefined();
      expect(screen.queryByTestId('r-howto')).toBeNull();
    });
  });

  describe('WHEN a finished card is drawn at a large text size', () => {
    it('THEN the tick in its little circle never grows', async () => {
      await render(row());
      expect(screen.getByText('✓').props.maxFontSizeMultiplier).toBe(1);
    });
  });
});
