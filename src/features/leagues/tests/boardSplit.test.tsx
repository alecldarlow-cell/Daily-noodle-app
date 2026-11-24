/* The board split into its parts (queue #174): each part stands alone, and Board stays small. */
import { fireEvent, render, screen } from '@testing-library/react-native';

import * as Board from '../components/Board';
import { Row } from '../components/BoardRows';
import { RecordsCtx } from '../components/boardShared';
import * as LeagueSettings from '../components/LeagueSettings';

// Node's fs and path, typed here: the app's tsconfig has no Node types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as { readFileSync(file: string, enc: 'utf8'): string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path') as { join(...parts: string[]): string };
declare const __dirname: string;

const COMPONENTS = path.join(__dirname, '..', 'components');
const PARTS = [
  'Board.tsx',
  'BoardNotices.tsx',
  'BoardRows.tsx',
  'BoardViews.tsx',
  'LeagueSettings.tsx',
  'boardShared.ts',
];

describe('GIVEN the league board split into focused files', () => {
  describe('WHEN each file is read', () => {
    it('THEN none is over 400 lines (Board.tsx was 1,006)', () => {
      for (const f of PARTS) {
        const lines = fs.readFileSync(path.join(COMPONENTS, f), 'utf8').split('\n').length;
        expect(`${f}: ${lines <= 400}`).toBe(`${f}: true`);
      }
    });
  });

  describe('WHEN code imports reportUrl, ordinal or the swipe rules from Board', () => {
    it('THEN they are still there, and reportUrl is the settings’ own', () => {
      expect(Board.reportUrl).toBe(LeagueSettings.reportUrl);
      expect(typeof Board.ordinal).toBe('function');
      expect(typeof Board.claimsSwipe).toBe('function');
      expect(typeof Board.swipeStep).toBe('function');
    });
  });
});

describe('GIVEN a board row drawn on its own', () => {
  describe('WHEN the league’s records have not loaded (no way to open a card)', () => {
    it('THEN the row is read out but is not a button', async () => {
      await render(<Row rank="1" nick="Ma" me={false} big="1:01" />);
      const row = screen.getByTestId('row-Ma');
      expect(row.props.accessibilityLabel).toBe('1 Ma, 1:01');
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('WHEN the records have loaded and the row is yours with a streak and a record', () => {
    it('THEN tapping it opens your card, and it says YOU, the streak and the record', async () => {
      const open = jest.fn();
      await render(
        <RecordsCtx.Provider value={{ open }}>
          <Row rank="2" nick="Alec" me big="1:27" small="no mistakes" streak={4} record />
        </RecordsCtx.Provider>,
      );
      const row = screen.getByRole('button', {
        name: '2 Alec (you), 1:27, no mistakes, new league record',
      });
      expect(screen.getByText('🔥 4-day streak')).toBeOnTheScreen();
      expect(screen.getByTestId('new-record-Alec')).toBeOnTheScreen();
      await fireEvent.press(row);
      expect(open).toHaveBeenCalledWith('Alec');
    });
  });
});
