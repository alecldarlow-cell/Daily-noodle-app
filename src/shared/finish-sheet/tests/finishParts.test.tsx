import { fireEvent, render, screen, within } from '@testing-library/react-native';
import * as RN from 'react-native';

import { mockSite, renderWithProviders } from '@/shared/testing';

import { boldLead, FinishLink, Mark } from '../FinishParts';
import { FinishSheet } from '../FinishSheet';

afterEach(() => jest.restoreAllMocks());

describe('GIVEN the sheet’s tick and cross', () => {
  describe('WHEN they are drawn', () => {
    it('THEN each is two round-ended strokes in the given colour, not a font glyph', async () => {
      await render(
        <RN.View>
          <Mark kind="tick" color="#FFFFFF" />
          <Mark kind="cross" size={24} color="#C2362B" />
        </RN.View>,
      );
      for (const id of ['mark-tick', 'mark-cross']) {
        const strokes = screen.getByTestId(id).children as unknown as {
          props: { style: object };
        }[];
        expect(strokes).toHaveLength(2);
      }
      expect(screen.getByTestId('mark-cross')).toHaveStyle({ width: 24, height: 24 });
      expect(screen.queryByText(/[✓✕]/)).toBeNull();
    });
  });
});

describe('GIVEN a link under a recap', () => {
  describe('WHEN it is shown and tapped', () => {
    it('THEN it is the sheet’s one link style, semibold in the link ink with no underline', async () => {
      const go = jest.fn();
      await render(<FinishLink label="Play more in Ballpark" role="link" onPress={go} />);
      const text = screen.getByText('Play more in Ballpark');
      expect(text).toHaveStyle({ color: '#1B3B9E', fontSize: 15 });
      expect(text).not.toHaveStyle({ textDecorationLine: 'underline' });
      expect(screen.getByRole('link')).toBeOnTheScreen();
      await fireEvent.press(text);
      expect(go).toHaveBeenCalled();
    });
  });
});

describe('GIVEN Reckon’s note', () => {
  it('THEN its bullseyes are bolded as reckon.js writes them, and a miss stays plain', () => {
    expect(boldLead('Ten bullseyes. Perfect.')).toEqual({
      before: '',
      bold: 'Ten bullseyes.',
      after: ' Perfect.',
    });
    expect(boldLead('Three bullseyes, one of them spot on.')).toEqual({
      before: '',
      bold: 'Three bullseyes',
      after: ', one of them spot on.',
    });
    expect(boldLead('One bullseye.')).toEqual({ before: '', bold: 'One bullseye', after: '.' });
    expect(boldLead('No bullseyes today. Your closest was 12% out.')).toBe(
      'No bullseyes today. Your closest was 12% out.',
    );
  });
});

describe('GIVEN a finish sheet with a bold run in its note', () => {
  it('THEN the run is in full ink and semibold, the rest soft', async () => {
    mockSite({});
    await renderWithProviders(
      <FinishSheet
        type="tangle"
        n={19}
        date="2026-10-25"
        title="Time’s up"
        hero="13 pts"
        note={{ before: '2 words. The longest was ', bold: 'ORIGINAL', after: ', worth 12.' }}
        share="🧶 Tangle #19"
        stats={[]}
        onBack={() => undefined}
        onNext={() => undefined}
      />,
    );
    const note = screen.getByTestId('finish-note');
    expect(note).toHaveTextContent('2 words. The longest was ORIGINAL, worth 12.');
    expect(note).toHaveStyle({ color: '#545A6E' });
    expect(within(note).getByText('ORIGINAL')).toHaveStyle({ color: '#141726' });
  });
});
