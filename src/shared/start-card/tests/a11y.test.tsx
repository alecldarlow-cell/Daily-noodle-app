import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { FinishSheet } from '@/shared/finish-sheet';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { clockLabel, PuzzleBar } from '../PuzzleBar';
import { StartCard } from '../StartCard';
import { londonDay } from '@noodle/core';
import { dayHead } from '@/shared/time';

const noop = () => undefined;
beforeEach(() => mockSite({}));

describe('GIVEN the clock over a board', () => {
  describe('WHEN a screen reader reads it', () => {
    it('THEN it says whole minutes only, so the label changes once a minute, not every tick', () => {
      expect(clockLabel('00:14')).toBe('Time, under a minute');
      expect(clockLabel('00:59')).toBe(clockLabel('00:01'));
      expect(clockLabel('01:27')).toBe('Time, 1 minute');
      expect(clockLabel('12:05')).toBe('Time, 12 minutes');
      expect(clockLabel('1:02:03')).toBe('Time, 62 minutes');
      expect(clockLabel('--')).toBe('Time');
    });
    it('THEN the bar’s clock is a timer that never announces itself, and back is 44 points', async () => {
      await render(<PuzzleBar name="Mini 105" streak={0} clock="00:14" onBack={noop} />);
      const clock = screen.getByTestId('puzzle-clock');
      expect(clock.props.accessibilityRole).toBe('timer');
      expect(clock.props.accessibilityLiveRegion).toBe('none');
      expect(clock).toHaveAccessibleName('Time, under a minute');
      const back = StyleSheet.flatten(
        screen.getByRole('button', { name: 'Back to Puzzles' }).props.style,
      );
      expect(back).toMatchObject({ width: 44, height: 44 });
    });
  });
});

describe('GIVEN the start card with large text', () => {
  it('THEN the big type is capped so it still fits, and each number reads with its label', async () => {
    await render(
      <StartCard
        type="mini"
        n={105}
        date="2026-10-24"
        rule="Ten clues."
        stats={{ streak: 4, best: 6, played: 12 }}
        onPlay={noop}
        onBack={noop}
      />,
    );
    expect(screen.getByRole('header', { name: 'Mini' }).props.maxFontSizeMultiplier).toBe(1.4);
    expect(
      screen.getByText(dayHead('Mini', '2026-10-24', londonDay())).props.maxFontSizeMultiplier,
    ).toBe(1.4);
    expect(screen.getByLabelText('12 Minis played')).toBeOnTheScreen();
    expect(screen.getByLabelText('4 day streak')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Back to Puzzles' })).toBeOnTheScreen();
    // The rule is body text: it scales freely.
    expect(screen.getByText('Ten clues.').props.maxFontSizeMultiplier).toBeUndefined();
  });
});

describe('GIVEN the finish sheet with large text', () => {
  it('THEN the label and result are capped, the streak is one line, and Share is a full tap target', async () => {
    await renderWithProviders(
      <FinishSheet
        type="mini"
        n={105}
        date="2026-10-24"
        title="Solved"
        hero="1:27"
        note="No checks, no reveals."
        share="✏️ Mini #105 — 1:27"
        stats={[
          { value: 5, label: 'day streak' },
          { value: 40, label: 'Minis played' },
        ]}
        recap={{ title: 'The grid', node: <Text>grid</Text> }}
        onBack={noop}
        onNext={noop}
      />,
    );
    expect(
      screen.getByRole('header', { name: 'Mini 105 · Solved' }).props.maxFontSizeMultiplier,
    ).toBe(1.4);
    expect(screen.getByTestId('finish-hero').props.maxFontSizeMultiplier).toBe(1.3);
    expect(screen.getByText('🔥 5-day streak')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Back to Puzzles' })).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByRole('button', { name: 'Share result' }).props.style)
        .minHeight,
    ).toBe(48);
  });
});
