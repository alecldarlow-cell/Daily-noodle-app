import { act, fireEvent, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Share, Text } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { BoardSlotProvider, tagged, type BoardSlotProps } from '../boardSlot';
import { FinishSheet } from '../FinishSheet';

const PATH = 'reports/2026-10-24-crossword-mini-0105.html';
const SHARE = '✏️ Mini #105 — 1:27 · 🔥5';

describe('GIVEN finish.js’s share tag', () => {
  it('THEN it goes at the end of the first line, after a space', () => {
    expect(tagged(SHARE, '🏆')).toBe(`${SHARE} 🏆`);
    expect(tagged('🔗 Link #77\n🟩🟩🟩🟩\n🟦🟦🟦🟦', '🏆')).toBe(
      '🔗 Link #77 🏆\n🟩🟩🟩🟩\n🟦🟦🟦🟦',
    );
  });
  it('THEN no tag leaves the line as it is', () => {
    expect(tagged(SHARE, '')).toBe(SHARE);
  });
});

/** A slot that shows what it was given, and tags the share line when asked. */
const seen: BoardSlotProps[] = [];
function Probe(props: BoardSlotProps) {
  seen.push(props);
  const { onTag, path } = props;
  useEffect(() => {
    if (path.includes('tag')) onTag('🏆');
  }, [path, onTag]);
  return <Text>{`slot ${props.type} ${props.date}`}</Text>;
}

function sheet(extra: { path?: string; boardSlot?: React.ReactNode } = {}) {
  return (
    <FinishSheet
      type="mini"
      n="105"
      date="2026-10-24"
      title="Solved"
      hero="1:27"
      share={SHARE}
      stats={[]}
      onBack={() => {}}
      onNext={() => {}}
      {...extra}
    />
  );
}

describe('GIVEN a finish sheet under a provided board slot', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
    seen.length = 0;
    mockSite({});
  });
  afterEach(async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
  });

  describe('WHEN the sheet knows its puzzle’s path', () => {
    it('THEN the slot is drawn with the path, type and day', async () => {
      await renderWithProviders(
        <BoardSlotProvider slot={Probe}>{sheet({ path: PATH })}</BoardSlotProvider>,
      );
      expect(screen.getByText('slot mini 2026-10-24')).toBeOnTheScreen();
      expect(seen[0]).toMatchObject({ path: PATH, type: 'mini', date: '2026-10-24' });
      expect(screen.getByTestId('finish-share-text')).toHaveTextContent(SHARE);
    });
  });

  describe('WHEN the slot tags the share line', () => {
    it('THEN the line on screen and the line shared both end their first line with 🏆', async () => {
      const spy = jest
        .spyOn(Share, 'share')
        .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
      await renderWithProviders(
        <BoardSlotProvider slot={Probe}>
          {sheet({ path: 'reports/2026-10-24-crossword-mini-0105-tag.html' })}
        </BoardSlotProvider>,
      );
      expect(screen.getByTestId('finish-share-text')).toHaveTextContent(`${SHARE} 🏆`);
      await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
      expect(spy).toHaveBeenCalledWith({ message: `${SHARE} 🏆\ndailynoodle.co.uk/mini` });
    });
  });

  describe('WHEN the sheet has no path, or its own board slot', () => {
    it('THEN the provided slot is not drawn', async () => {
      const r = await renderWithProviders(
        <BoardSlotProvider slot={Probe}>{sheet()}</BoardSlotProvider>,
      );
      expect(screen.queryByText(/^slot/)).toBeNull();
      await r.unmount();
      await renderWithProviders(
        <BoardSlotProvider slot={Probe}>
          {sheet({ path: PATH, boardSlot: <Text>own slot</Text> })}
        </BoardSlotProvider>,
      );
      expect(screen.getByText('own slot')).toBeOnTheScreen();
      expect(screen.queryByText(/^slot/)).toBeNull();
    });
  });

  describe('WHEN nothing provides a slot', () => {
    it('THEN the sheet draws without one', async () => {
      await renderWithProviders(sheet({ path: PATH }));
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
      expect(screen.queryByText(/^slot/)).toBeNull();
    });
  });
});
