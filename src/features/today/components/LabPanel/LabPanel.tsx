import { LAB_LABEL, labPlayed, labSaveKey, LAB_TYPES } from '@noodle/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LabFeedItem } from '@/shared/feed';
import { useLabTrials, useLabVotes } from '@/shared/lab';
import { openPuzzle } from '@/shared/played';
import { useStoredDocs } from '@/shared/storage';
import { FONT, useTokens } from '@/shared/theme';
import { Chevron, pressable, PuzzleTile } from '@/shared/ui';

const KEYS = LAB_TYPES.map(labSaveKey);

/** The panel's line (Alec, 11 Nov 2026). */
export const LAB_LINE =
  'New puzzles on trial, here for a few weeks. Vote after you play: your votes help decide which become permanent dailies.';

/**
 * "From the Lab", under Today's dailies (Alec, 11 Nov 2026; mock Option 3): the running
 * trials as compact rows in a pale marigold panel, each saying "Try it" or "✓ Rated", and how
 * many of them you've rated. Always the same shape; no panel when no trial is running.
 */
export function LabPanel() {
  const t = useTokens();
  const { current } = useLabTrials();
  const { votes } = useLabVotes();
  const docs = useStoredDocs(KEYS);
  if (!current.length) return null;
  const rated = current.filter((it) => votes[it.type]).length;
  return (
    <View
      style={[styles.panel, { backgroundColor: t.labSoft }]}
      accessibilityRole="summary"
      testID="lab-panel">
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
          From the Lab
        </Text>
        <Text style={[styles.count, { color: t.labInk }]} testID="lab-rated">
          {`${rated} OF ${current.length} RATED`}
        </Text>
      </View>
      <Text style={[styles.line, { color: t.labInk }]}>{LAB_LINE}</Text>
      {current.map((it, i) => {
        const played = labPlayed(it.id, docs[labSaveKey(it.type)] as never);
        const name = LAB_LABEL[it.type];
        const isRated = !!votes[it.type];
        const call = isRated
          ? '✓ Rated'
          : played?.done
            ? 'Rate it'
            : played
              ? 'Continue'
              : 'Try it';
        return (
          <Pressable
            key={it.path}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${it.standfirst || 'Lab trial'}, ${call.replace('✓ ', '')}`}
            onPress={() => open(it)}
            style={pressable([
              styles.row,
              i < current.length - 1 && { borderBottomWidth: 1, borderColor: t.labLine },
            ])}
            testID={`lab-row-${it.type}`}>
            <View pointerEvents="none">
              <PuzzleTile type={it.type} size={48} />
            </View>
            <View style={styles.body}>
              <Text style={[styles.name, { color: t.ink }]}>{name}</Text>
              {it.standfirst ? (
                <Text numberOfLines={1} style={[styles.desc, { color: t.labInk }]}>
                  {it.standfirst}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.call, { color: isRated ? t.accent : t.labInk }]}>{call}</Text>
            {isRated ? null : <Chevron color={t.labInk} size={7} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function open(it: LabFeedItem) {
  openPuzzle({ type: it.type, name: LAB_LABEL[it.type], path: it.path }, null);
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 16, fontFamily: FONT.display },
  count: { fontSize: 11, letterSpacing: 0.8, fontFamily: FONT.bodySemi },
  line: { fontSize: 12.5, lineHeight: 17, fontFamily: FONT.body, marginTop: 2, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 44 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontFamily: FONT.sansSemi },
  desc: { fontSize: 12, lineHeight: 16, fontFamily: FONT.body },
  call: { fontSize: 12.5, fontFamily: FONT.sansSemi },
});
