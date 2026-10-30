import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { PuzzleBar, StartCard } from '@/shared/start-card';
import { heldStyle, mockSite, renderWithProviders } from '@/shared/testing';
import { PRESSED } from '@/shared/ui';

import { ANNOUNCE_MS, FinishSheet } from '../FinishSheet';

const mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const noop = () => undefined;
beforeEach(() => {
  mockSite({});
  Object.assign(mockWindow, { width: 390, fontScale: 1 });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const sheet = (celebrate: boolean) => (
  <FinishSheet
    celebrate={celebrate}
    type="mini"
    n="105"
    date="2026-10-24"
    title="Solved"
    hero="1:27"
    share="✏️ Mini #105 — 1:27 · 🔥5"
    stats={[
      { value: 1150, label: 'day streak' },
      { value: 9, label: 'best streak' },
      { value: 40, label: 'Minis played' },
    ]}
    onBack={noop}
    onNext={noop}
  />
);

describe('GIVEN the finish sheet', () => {
  describe('WHEN its buttons are held', () => {
    it('THEN back shows the shared pressed look, and Share and Play more the Button’s', async () => {
      await renderWithProviders(sheet(false));
      expect(await heldStyle(screen.getByRole('link', { name: 'Back to Puzzles' }))).toMatchObject(
        PRESSED,
      );
      const held = async (id: string) =>
        StyleSheet.flatten(await heldStyle(screen.getByTestId(id)));
      expect(await held('finish-share-button')).toMatchObject({ opacity: 0.75 });
      expect(await held('finish-next')).toMatchObject({ opacity: 0.75 });
    });
  });

  describe('WHEN the streak is a long number at large text (AF-019)', () => {
    it('THEN it is one line under the score, not a big stat', async () => {
      mockWindow.fontScale = 2;
      await renderWithProviders(sheet(false));
      expect(screen.getByTestId('finish-streak')).toHaveTextContent('🔥 1150-day streak');
      expect(screen.queryByText('1150')).toBeNull();
      expect(screen.queryByText('best streak')).toBeNull();
    });
  });

  describe('WHEN the text is large or the phone narrow', () => {
    it('THEN Share result stays one full-width button (the line goes in the share sheet)', async () => {
      Object.assign(mockWindow, { width: 320, fontScale: 2 });
      await renderWithProviders(sheet(false));
      expect(
        StyleSheet.flatten(screen.getByTestId('finish-share-button').props.style),
      ).toMatchObject({
        flexGrow: 1,
        minHeight: 48,
      });
      expect(screen.queryByText('✏️ Mini #105 — 1:27 · 🔥5')).toBeNull();
    });
  });

  describe('WHEN a finished puzzle is reopened', () => {
    it('THEN nothing is announced', async () => {
      jest.useFakeTimers();
      const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation();
      await renderWithProviders(sheet(false));
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(say).not.toHaveBeenCalled();
    });
  });
  describe('WHEN it rises on a fresh finish', () => {
    it('THEN a screen reader hears the result and lands on the outcome', async () => {
      jest.useFakeTimers();
      const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation();
      const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation();
      await renderWithProviders(sheet(true));
      expect(say).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(ANNOUNCE_MS);
      });
      expect(say).toHaveBeenCalledWith('Solved. 1:27');
      expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    });
  });
});

describe('GIVEN the start card', () => {
  it('THEN Play shows the pressed look, and a long stat stays on one line', async () => {
    await render(
      <StartCard
        type="mini"
        n={105}
        date="2026-10-24"
        rule="Ten clues."
        stats={{ streak: 4, best: 1150, played: 12 }}
        onPlay={noop}
        onBack={noop}
      />,
    );
    expect(await heldStyle(screen.getByRole('button', { name: 'Play' }))).toMatchObject(PRESSED);
    const v = screen.getByText('1150');
    expect(v.props.numberOfLines).toBe(1);
    expect(v.props.adjustsFontSizeToFit).toBe(true);
  });
});

describe('GIVEN the slim bar over a board', () => {
  it('THEN its name is the screen’s heading, its streak reads as on the start card, and back answers a press', async () => {
    await render(<PuzzleBar name="Sweep 94" sub="medium" streak={4} clock="0:07" onBack={noop} />);
    expect(screen.getByRole('header', { name: 'Sweep 94' })).toBeOnTheScreen();
    expect(screen.getByLabelText('4-day streak')).toBeOnTheScreen();
    expect(screen.getByTestId('puzzle-clock')).toHaveTextContent('0:07');
    expect(await heldStyle(screen.getByRole('button', { name: 'Back to Puzzles' }))).toMatchObject(
      PRESSED,
    );
  });
});
