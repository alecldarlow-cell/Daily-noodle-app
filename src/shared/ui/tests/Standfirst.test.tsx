import { fireEvent, render, screen } from '@testing-library/react-native';

import { clampStandfirst, Standfirst } from '../PuzzleRow/Standfirst';

const RECKON =
  'Ten numbers to guess, each from a different topic. The closer you get, the more you score.';

describe('GIVEN a card’s standfirst laid out in lines', () => {
  describe('WHEN it fits in three', () => {
    it('THEN it is shown whole, with no cut', () => {
      expect(clampStandfirst(['Ten numbers to guess, ', 'the more you score.'], 3)).toBeNull();
      expect(clampStandfirst(['a ', 'b ', 'c.'], 3)).toBeNull();
    });
  });

  describe('WHEN it runs to a fourth line that starts just after a full stop', () => {
    it('THEN it ends in one ellipsis, never “score.…” (no double stop)', () => {
      const lines = [
        'Ten numbers to guess, each ',
        'from a different topic. The ',
        'closer you get, the more you score. ',
        'Bullseyes count double.',
      ];
      const out = clampStandfirst(lines, 3)!;
      expect(out).toBe(
        'Ten numbers to guess, each from a different topic. The closer you get, the more you…',
      );
      expect(out).not.toMatch(/[.,;:!?]…$/);
      expect(out.match(/…/g)).toHaveLength(1);
    });
  });

  describe('WHEN the cut lands after a comma or a dash', () => {
    it('THEN the punctuation goes with it', () => {
      expect(clampStandfirst(['one two, ', 'three — ', 'four, five, ', 'six'], 3)).toBe(
        'one two, three — four…',
      );
    });
  });

  describe('WHEN the kept text is a single long word', () => {
    it('THEN it is kept and the ellipsis follows it', () => {
      expect(clampStandfirst(['Supercalifragilistic', 'expialidocious', '!', 'x'], 3)).toBe(
        'Supercalifragilisticexpialidocious…',
      );
    });
  });
});

describe('GIVEN a standfirst on a card', () => {
  const lay = (lines: string[]) =>
    fireEvent(screen.getByTestId('sf-measure', { includeHiddenElements: true }), 'textLayout', {
      nativeEvent: { lines: lines.map((text) => ({ text })) },
    });

  describe('WHEN it has not been laid out yet', () => {
    it('THEN it shows the whole text, held to three lines, as before', async () => {
      await render(<Standfirst text={RECKON} max={3} style={{}} testID="sf" />);
      expect(screen.getByTestId('sf')).toHaveTextContent(RECKON);
      expect(screen.getByTestId('sf').props.numberOfLines).toBe(3);
    });
  });

  describe('WHEN its layout shows it fits', () => {
    it('THEN it shows whole with no line limit, so the phone never cuts it at its full stop', async () => {
      await render(<Standfirst text={RECKON} max={3} style={{}} testID="sf" />);
      await lay([
        'Ten numbers to guess, each from ',
        'a different topic. The closer you ',
        'get, the more you score.',
      ]);
      expect(screen.getByTestId('sf')).toHaveTextContent(RECKON);
      expect(screen.getByTestId('sf').props.numberOfLines).toBeUndefined();
    });
  });

  describe('WHEN its layout runs past three lines', () => {
    it('THEN it is cut by whole words with one ellipsis, and a screen reader hears it all', async () => {
      await render(<Standfirst text={RECKON} max={3} style={{}} testID="sf" />);
      await lay([
        'Ten numbers to ',
        'guess, each from a ',
        'different topic. The ',
        'closer you get, the more you score.',
      ]);
      expect(screen.getByTestId('sf')).toHaveTextContent(
        'Ten numbers to guess, each from a different topic…',
      );
      expect(screen.getByTestId('sf')).toHaveAccessibleName(RECKON);
      // The same layout again changes nothing.
      await lay([
        'Ten numbers to ',
        'guess, each from a ',
        'different topic. The ',
        'closer you get, the more you score.',
      ]);
      expect(screen.getByTestId('sf')).toHaveTextContent(
        'Ten numbers to guess, each from a different topic…',
      );
    });
  });

  describe('WHEN the text changes after a layout', () => {
    it('THEN the old layout is not applied to the new text', async () => {
      const r = await render(<Standfirst text={RECKON} max={3} style={{}} testID="sf" />);
      await lay(['a ', 'b ', 'c ', 'd']);
      await r.rerender(<Standfirst text="Join 1 to 36." max={3} style={{}} testID="sf" />);
      expect(screen.getByTestId('sf')).toHaveTextContent('Join 1 to 36.');
    });
  });
});
