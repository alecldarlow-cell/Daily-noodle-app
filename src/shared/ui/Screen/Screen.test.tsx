import { render, screen } from '@testing-library/react-native';
import { RefreshControl, StyleSheet, Text, type RefreshControlProps } from 'react-native';

import { tokensFor } from '@/shared/theme';

import { MAST_MAX_SCALE, refreshColors, Screen } from './Screen';

describe('GIVEN a Screen', () => {
  describe('WHEN it renders with a title and content', () => {
    it('THEN the title is a header and the content is shown', async () => {
      await render(
        <Screen title="Today">
          <Text>Body</Text>
        </Screen>,
      );
      expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
      expect(screen.getByText('Body')).toBeOnTheScreen();
    });
  });

  describe('WHEN the phone’s text size is very large (2.0)', () => {
    it('THEN the DP monogram never grows past its box', async () => {
      await render(<Screen title="Today" subtitle="Mon 26 Oct" />);
      expect(screen.getByTestId('masthead-mono').props.maxFontSizeMultiplier).toBe(1);
      expect(MAST_MAX_SCALE.mono).toBe(1);
    });

    it('THEN the wordmark grows a little and shrinks to fit on one line', async () => {
      await render(<Screen title="Today" />);
      const word = screen.getByTestId('masthead-word');
      expect(word.props.maxFontSizeMultiplier).toBe(MAST_MAX_SCALE.word);
      expect(word.props.numberOfLines).toBe(1);
      expect(word.props.adjustsFontSizeToFit).toBe(true);
    });

    it('THEN the row wraps, so the kicker drops under the wordmark rather than off the screen', async () => {
      await render(<Screen title="Archive" subtitle="Mon 26 Oct" />);
      expect(StyleSheet.flatten(screen.getByTestId('masthead').props.style).flexWrap).toBe('wrap');
      const kick = StyleSheet.flatten(screen.getByTestId('masthead-kicker').props.style);
      expect(kick.flexShrink).toBe(0);
      expect(kick.marginLeft).toBe('auto');
      expect(screen.getByText('Archive').props.maxFontSizeMultiplier).toBe(MAST_MAX_SCALE.kick);
      expect(screen.getByText('Mon 26 Oct').props.maxFontSizeMultiplier).toBe(MAST_MAX_SCALE.kick);
    });
  });

  describe('WHEN it can be pulled to refresh', () => {
    it('THEN the spinner shows while refreshing, in the house colours', async () => {
      const t = tokensFor('light');
      await render(<Screen title="Today" testID="s" onRefresh={() => undefined} refreshing />);
      // React Native's Jest mock keeps the last one mounted, with its props.
      const rc = (RefreshControl as unknown as { latestRef: { props: RefreshControlProps } })
        .latestRef;
      expect(rc.props.testID).toBe('s-refresh');
      expect(rc.props.refreshing).toBe(true);
      expect(rc.props.colors).toEqual([t.accent]);
      expect(rc.props.progressBackgroundColor).toBe(t.paper);
      expect(rc.props.tintColor).toBe(t.muted);
      expect(refreshColors(tokensFor('dark')).colors).toEqual([tokensFor('dark').accent]);
    });
  });
});
