import { fireEvent, render, screen } from '@testing-library/react-native';

import { PuzzleBar } from '../PuzzleBar';
import { StartCard } from '../StartCard';
import { HOW, ruleFor } from '../copy';
import { startStats } from '../stats';

describe('GIVEN a puzzle’s rule line', () => {
  it('THEN each type says what its page says', () => {
    expect(
      ruleFor('mini', { clues: Object.fromEntries('abcdefghij'.split('').map((k) => [k, k])) }),
    ).toBe('Ten clues, across and down. The clock starts with your first letter.');
    expect(ruleFor('mini', {})).toBe(
      'Ten clues, across and down. The clock starts with your first letter.',
    );
    expect(
      ruleFor('mini', { clues: Object.fromEntries([...Array(20)].map((_, i) => [i, i])) }),
    ).toMatch(/^20 clues/);
    expect(ruleFor('doku', { bank: [1, 2, 3, 4, 5, 6, 7, 8, 9] })).toBe(
      'Place the nine letter tiles so every word across and down is real.',
    );
    expect(ruleFor('sweep', { mines: [1, 2, 3, 4, 5, 6, 7] })).toMatch(/one of the seven mines/);
    expect(ruleFor('path', {})).toMatch(/^Join 1 to 36/);
    expect(ruleFor('link', {})).toMatch(/^Sixteen words/);
  });
});

describe('GIVEN saves for a type', () => {
  it('THEN the streak counts only while alive, and finished puzzles are counted', () => {
    const save = { v: 1, done: { a: {}, b: {} } };
    expect(startStats(save, { last: '2026-10-23', streak: 4, best: 6 }, '2026-10-24')).toEqual({
      streak: 4,
      best: 6,
      played: 2,
    });
    expect(startStats(save, { last: '2026-10-21', streak: 4, best: 6 }, '2026-10-24').streak).toBe(
      0,
    );
    expect(startStats(null, null, '2026-10-24')).toEqual({ streak: 0, best: 0, played: 0 });
  });
});

describe('GIVEN the start card', () => {
  const onPlay = jest.fn();
  const onBack = jest.fn();
  const card = (streak: number) => (
    <StartCard
      type="mini"
      n={105}
      date="2026-10-24"
      rule="Ten clues, across and down. The clock starts with your first letter."
      stats={{ streak, best: 6, played: 12 }}
      onPlay={onPlay}
      onBack={onBack}
    />
  );

  it('THEN it names the puzzle and day, the rule and your numbers', async () => {
    await render(card(4));
    expect(screen.getByRole('header', { name: 'Mini' })).toBeOnTheScreen();
    expect(screen.getByText('No. 105, Saturday 24 October')).toBeOnTheScreen();
    expect(screen.getByText('Today’s Mini')).toBeOnTheScreen();
    expect(screen.getByText('4-day streak')).toBeOnTheScreen();
    expect(screen.getByText('Minis played')).toBeOnTheScreen();
    expect(screen.getByText('12')).toBeOnTheScreen();
  });

  describe('WHEN How to play, Play and Puzzles are tapped', () => {
    it('THEN the help opens and the card hands over', async () => {
      await render(card(0));
      expect(screen.queryByText('4-day streak')).toBeNull();
      expect(screen.queryByText(HOW.mini[0]!)).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: /How to play/ }));
      expect(screen.getByText(HOW.mini[0]!)).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
      expect(onPlay).toHaveBeenCalled();
      await fireEvent.press(screen.getByText('← Puzzles'));
      expect(onBack).toHaveBeenCalled();
    });
  });
});

describe('GIVEN the slim bar', () => {
  it('THEN the flame shows only with a streak, beside the clock', async () => {
    const onBack = jest.fn();
    const { rerender } = await render(
      <PuzzleBar name="Mini 105" sub="medium" streak={0} clock="00:14" onBack={onBack} />,
    );
    expect(screen.queryByText(/🔥/)).toBeNull();
    expect(screen.getByText('00:14')).toBeOnTheScreen();
    await rerender(<PuzzleBar name="Mini 105" streak={3} onBack={onBack} />);
    expect(screen.getByText('🔥3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Puzzles' }));
    expect(onBack).toHaveBeenCalled();
  });
});
