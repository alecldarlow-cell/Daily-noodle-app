import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { tokensFor } from '@/shared/theme';

import { Note } from '../Note/Note';

const t = tokensFor('light');

describe('GIVEN a Note for a failed load', () => {
  describe('WHEN it shows', () => {
    it('THEN it is the site’s quiet note: paper and an accent rule, never a green wash', async () => {
      await render(<Note testID="n" title="No connection" body="Try later." />);
      const box = screen.getByTestId('n');
      const style = StyleSheet.flatten(box.props.style);
      expect(style.backgroundColor).toBe(t.paper);
      expect(style.backgroundColor).not.toBe(t.accentSoft);
      expect(style.borderLeftColor).toBe(t.accent);
      expect(style.borderLeftWidth).toBe(3);
    });

    it('THEN screen readers hear it arrive, with its title as a heading', async () => {
      await render(<Note testID="n" title="No connection" />);
      expect(screen.getByTestId('n').props.accessibilityLiveRegion).toBe('polite');
      expect(screen.getByRole('header', { name: 'No connection' })).toBeOnTheScreen();
    });
  });

  describe('WHEN it has Try again and a second way out', () => {
    it('THEN both are buttons at least 44 pt tall, and each does its own thing', async () => {
      const retry = jest.fn();
      const leave = jest.fn();
      await render(
        <Note
          title="Something went wrong"
          action={{ label: 'Try again', onPress: retry }}
          alt={{ label: 'Go to Today', onPress: leave }}
        />,
      );
      for (const name of ['Try again', 'Go to Today']) {
        const btn = screen.getByRole('button', { name });
        const style = StyleSheet.flatten(btn.props.style);
        expect(style.minHeight).toBeGreaterThanOrEqual(44);
      }
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(retry).toHaveBeenCalledTimes(1);
      expect(leave).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Go to Today' }));
      expect(leave).toHaveBeenCalledTimes(1);
    });
  });

  describe('WHEN it has no action', () => {
    it('THEN it shows no buttons', async () => {
      await render(<Note title="All done here" />);
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});
