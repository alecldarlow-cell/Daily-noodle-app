import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SweepBoard } from '../components/SweepBoard';
import { FlagGlyph, MineGlyph } from '../components/SweepGlyphs';
import { apply, init } from '../model';
import { sweep94 } from './fixtures';

const START = 22;
const flat = (n: { props: Record<string, unknown> }) =>
  StyleSheet.flatten(n.props.style as never) as Record<string, unknown>;

describe('GIVEN a Sweep board with a flag down', () => {
  describe('WHEN it is drawn', () => {
    it('THEN the flag is the page’s drawn flag (pole and blue pennant), not a ⚑ character', async () => {
      let s = init(sweep94, { ranked: true });
      s = apply(s, { t: 'tap', i: START }, { secs: 0 });
      s = apply(s, { t: 'press', i: 2 }, { secs: 1 });
      expect(s.flagged.has(2)).toBe(true);
      await render(
        <SweepBoard state={s} side={360} dark={false} onTap={() => {}} onPress={() => {}} />,
      );
      const flag = within(screen.getByTestId('sq-2')).getByTestId('sweep-flag');
      expect(flag).toBeTruthy();
      expect(screen.queryByText('⚑')).toBeNull();
      // 44% of a 60 pt square, as the page's app mode sizes its glyph.
      expect(flat(flag)).toMatchObject({ width: 60 * 0.44, height: 60 * 0.44 });
    });
  });
});

describe('GIVEN a Sweep board where a mine was hit', () => {
  describe('WHEN it is drawn', () => {
    it('THEN the mine is the page’s drawn mine, not a ✹ character', async () => {
      let s = init(sweep94, { ranked: true });
      s = apply(s, { t: 'tap', i: START }, { secs: 0 });
      s = apply(s, { t: 'tap', i: 2 }, { secs: 3 });
      expect(s.boomed.has(2)).toBe(true);
      await render(
        <SweepBoard state={s} side={360} dark={true} onTap={() => {}} onPress={() => {}} />,
      );
      expect(within(screen.getByTestId('sq-2')).getByTestId('sweep-mine')).toBeTruthy();
      expect(screen.queryByText('✹')).toBeNull();
    });
  });
});

describe('GIVEN the drawn glyphs', () => {
  it('THEN the flag has its ink pole and two pennants in the page’s blues', async () => {
    await render(<FlagGlyph size={24} />);
    const parts = screen.getByTestId('sweep-flag').children as unknown as {
      props: Record<string, unknown>;
    }[];
    const styles = parts.map(flat);
    expect(styles[0]).toMatchObject({ backgroundColor: '#141726', width: 19.8, height: 2.6 });
    expect(styles[1]).toMatchObject({ borderLeftColor: '#1B3B9E', borderLeftWidth: 10.4 });
    expect(styles[2]).toMatchObject({ borderLeftColor: '#2E5BFF', left: 9, top: 3.8 });
  });

  it('THEN the mine has four white spikes, a white body and a dark glint', async () => {
    await render(<MineGlyph size={48} />);
    const parts = (
      screen.getByTestId('sweep-mine').children as unknown as { props: Record<string, unknown> }[]
    ).map(flat);
    expect(parts).toHaveLength(6);
    expect(parts.slice(0, 5).every((p) => p.backgroundColor === '#FFFFFF')).toBe(true);
    // The body: radius 5.1 of 24, so 10.2 units wide at twice the size.
    expect(parts[4]).toMatchObject({ width: 2 * 5.1 * 2, borderRadius: 5.1 * 2 });
    expect(parts[5]).toMatchObject({ backgroundColor: '#141726' });
  });
});
