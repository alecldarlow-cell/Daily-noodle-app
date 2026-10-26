import { render, screen, within } from '@testing-library/react-native';
import * as RN from 'react-native';

import { GroupBands, GuessSquares, PlayAgain } from '../components/LinkParts';

afterEach(() => jest.restoreAllMocks());

describe('GIVEN Link’s finish sheet parts', () => {
  describe('WHEN shown in light mode', () => {
    it('THEN guesses are 44 pt squares with drawn marks, a miss a red ring, and the members lead each band', async () => {
      await render(
        <RN.View>
          <GuessSquares squares={[1, 0, 4]} names={['A', 'a miss', 'D']} />
          <GroupBands
            groups={[
              { rank: 1, name: 'Fish', members: ['COD', 'EEL', 'RAY', 'GAR'] },
              { rank: 4, name: '___ball', members: ['FOOT', 'BASE', 'NET', 'HAND'] },
            ]}
          />
          <PlayAgain onPress={() => undefined} />
        </RN.View>,
      );
      expect(screen.getByTestId('guess-g1')).toHaveStyle({
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#157A52',
      });
      expect(screen.getByTestId('guess-x')).toHaveStyle({
        borderWidth: 2,
        borderColor: '#C2362B',
        backgroundColor: 'transparent',
      });
      expect(within(screen.getByTestId('guess-x')).getByTestId('mark-cross')).toBeOnTheScreen();
      expect(within(screen.getByTestId('guess-g4')).getByTestId('mark-tick')).toBeOnTheScreen();
      expect(screen.getByText('COD, EEL, RAY, GAR')).toHaveStyle({ fontSize: 15 });
      expect(screen.getByText('Fish')).toHaveStyle({ fontSize: 13 });
      expect(screen.getByTestId('band-recap-4')).toHaveStyle({ backgroundColor: '#141726' });
      expect(screen.getByText('Play again (not recorded)')).toHaveStyle({ color: '#1B3B9E' });
    });
  });

  describe('WHEN shown in dark mode', () => {
    it('THEN group 4 turns light with dark text, so it shows on the dark sheet', async () => {
      jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
      await render(
        <RN.View>
          <GuessSquares squares={[4]} names={['D']} />
          <GroupBands groups={[{ rank: 4, name: '___ball', members: ['FOOT'] }]} />
        </RN.View>,
      );
      expect(screen.getByTestId('guess-g4')).toHaveStyle({ backgroundColor: '#ECEEF4' });
      expect(screen.getByTestId('band-recap-4')).toHaveStyle({ backgroundColor: '#ECEEF4' });
      expect(screen.getByText('FOOT')).toHaveStyle({ color: '#11131A' });
    });
  });
});
