import { View } from 'react-native';

import { RecapCell, RecapGrid, RecapText } from '@/shared/finish-sheet';
import { usePuzzleTokens } from '@/shared/theme';

import { isLock, type DokuPuzzle } from '../model';

/** The finish sheet's recap (.fin-grid g5): the solved grid, the given squares shaded and soft. */
export function SolvedGrid({ p }: { p: DokuPuzzle }) {
  const pt = usePuzzleTokens();
  return (
    <RecapGrid
      n={5}
      testID="solved-grid"
      cell={(r, c, size) => {
        const ch = p.grid[r]![c]!;
        if (ch === '#')
          return <View style={{ width: size, height: size, backgroundColor: pt.block }} />;
        const given = isLock(p, r, c);
        return (
          <RecapCell
            size={size}
            num={p.nums[r]![c]}
            bg={given ? pt.cellAlt : undefined}
            testID={given ? `given-${r}-${c}` : undefined}>
            <RecapText color={given ? pt.sheetSoft : undefined}>{ch}</RecapText>
          </RecapCell>
        );
      }}
    />
  );
}
