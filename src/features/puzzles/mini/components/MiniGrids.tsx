import { View } from 'react-native';

import { RecapCell, RecapGrid, RecapText } from '@/shared/finish-sheet';
import { usePuzzleTokens } from '@/shared/theme';

/** The finish sheet's recap (.fin-grid g5): the solved grid with its numbers, at the site's size. */
export function SolvedGrid({ grid, nums }: { grid: string[][]; nums: number[][] }) {
  const pt = usePuzzleTokens();
  return (
    <RecapGrid
      n={5}
      testID="solved-grid"
      cell={(r, c, size) => {
        const ch = grid[r]![c]!;
        if (ch === '#')
          return <View style={{ width: size, height: size, backgroundColor: pt.block }} />;
        return (
          <RecapCell size={size} num={nums[r]![c]}>
            <RecapText>{ch}</RecapText>
          </RecapCell>
        );
      }}
    />
  );
}
