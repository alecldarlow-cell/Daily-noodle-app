import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePuzzleTokens } from '@/shared/theme';

import { bankTiles, type DokuState } from '../model';

interface DokuBankProps {
  state: DokuState;
  onTile: (id: string) => void;
}

/** The letter bank: the free tiles in order, the chosen one marigold; "bank empty" once all are down. */
export function DokuBank({ state, onTile }: DokuBankProps) {
  const pt = usePuzzleTokens();
  const free = bankTiles(state);
  return (
    <View
      style={[styles.bank, { backgroundColor: pt.card, borderColor: pt.lineSoft }]}
      accessibilityLabel="Letter bank"
      testID="doku-bank">
      {free.length ? (
        free.map((t) => {
          const sel = state.selTile === t.id;
          return (
            <Pressable
              key={t.id}
              testID={`tile-${t.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Tile ${t.ch}`}
              accessibilityState={{ selected: sel }}
              onPress={() => onTile(t.id)}
              style={[
                styles.tile,
                { borderColor: pt.line, backgroundColor: sel ? pt.active : pt.card },
              ]}>
              <Text style={[styles.ch, { color: sel ? pt.onActive : pt.ink }]}>{t.ch}</Text>
            </Pressable>
          );
        })
      ) : (
        <Text style={[styles.empty, { color: pt.inkSoft }]}>bank empty</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bank: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 5,
    padding: 6,
    minHeight: 58,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  tile: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ch: { fontSize: 18, fontWeight: '700' },
  empty: { alignSelf: 'center', fontSize: 11, letterSpacing: 1.1 },
});
