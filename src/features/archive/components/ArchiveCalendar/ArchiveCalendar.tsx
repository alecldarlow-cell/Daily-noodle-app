import { PUZZLE_TYPES, type PuzzleType } from '@noodle/core';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { longDate, monthLabel } from '@/shared/time';
import { Note } from '@/shared/ui';

import { addMonth, archiveDays, monthCells, monthRange } from '../../hooks/calendar';
import type { ArchiveItem } from '../../types';

interface Props {
  items: readonly ArchiveItem[];
  /** Today's London day: the calendar runs to the day before. */
  today: string;
  type: PuzzleType | null;
  /** Ids of finished puzzles (won or lost), as the list's Done filter. */
  finished: ReadonlySet<string>;
  /** The list's own row, so a puzzle looks and opens the same in both views. */
  renderRow: (item: ArchiveItem) => ReactNode;
}

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The archive by month (6 Nov 2026, Alec: the list stays the default, the calendar is one tap
 * away): each day shows how many of its puzzles you've finished (filled when all are, dashed
 * when some are), or a tick with a type chosen. Tap a day for its puzzles below the grid.
 */
export function ArchiveCalendar({ items, today, type, finished, renderRow }: Props) {
  const t = useTokens();
  const all = useMemo(() => archiveDays(items, today, null, PUZZLE_TYPES), [items, today]);
  const days = useMemo(() => archiveDays(items, today, type, PUZZLE_TYPES), [items, today, type]);
  const range = monthRange(all);
  const [month, setMonth] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const shown =
    month && range && month >= range.first && month <= range.last ? month : (range?.last ?? null);
  const cells = useMemo(
    () => (shown ? monthCells(shown, days, finished) : []),
    [shown, days, finished],
  );
  if (!range || !shown) return <Note testID="calendar-empty" title="No past puzzles yet" />;
  const go = (k: number) => {
    setMonth(addMonth(shown, k));
    setPicked(null);
  };
  const prevOk = shown > range.first;
  const nextOk = shown < range.last;
  const list = picked ? (days[picked] ?? []) : [];
  const doneN = list.filter((it) => finished.has(it.id)).length;

  return (
    <View testID="archive-calendar">
      <View style={[styles.card, { borderColor: t.hair, backgroundColor: t.paper }]}>
        <View style={styles.head}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: !prevOk }}
            disabled={!prevOk}
            onPress={() => go(-1)}
            testID="calendar-prev"
            style={[styles.nav, { borderColor: t.hair, opacity: prevOk ? 1 : 0.35 }]}>
            <Text style={[styles.navText, { color: t.ink }]}>‹</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={[styles.month, { color: t.ink }]}
            testID="calendar-month">
            {monthLabel(`${shown}-01`)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: !nextOk }}
            disabled={!nextOk}
            onPress={() => go(1)}
            testID="calendar-next"
            style={[styles.nav, { borderColor: t.hair, opacity: nextOk ? 1 : 0.35 }]}>
            <Text style={[styles.navText, { color: t.ink }]}>›</Text>
          </Pressable>
        </View>
        <View style={styles.grid} accessible={false}>
          {DOW.map((d, i) => (
            <View key={`d${i}`} style={styles.cell}>
              <Text style={[styles.dow, { color: t.faint }]}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((c) => {
            if (c.kind === 'blank') return <View key={c.key} style={styles.cell} />;
            if (c.kind === 'none')
              return (
                <View
                  key={c.key}
                  style={styles.cell}
                  importantForAccessibility="no-hide-descendants">
                  <View style={styles.square}>
                    <Text style={[styles.num, { color: t.faint }]}>{c.day}</Text>
                  </View>
                </View>
              );
            const full = c.done === c.total;
            const part = c.done > 0 && !full;
            const sel = c.date === picked;
            const sub = type ? (c.done ? '✓' : '') : `${c.done}/${c.total}`;
            const label = `${longDate(c.date)}: ${
              type ? (c.done ? 'done' : 'not done') : `${c.done} of ${c.total} done`
            }`;
            return (
              <View key={c.key} style={styles.cell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: sel }}
                  onPress={() => setPicked(sel ? null : c.date)}
                  testID={`calendar-${c.date}`}
                  style={[
                    styles.square,
                    styles.dayBox,
                    { borderColor: part ? t.faint : t.hair },
                    part && { borderStyle: 'dashed', backgroundColor: t.canvas },
                    full && { backgroundColor: t.accentSoft, borderColor: t.accentSoft },
                    sel && { borderColor: t.accent, borderWidth: 2, borderStyle: 'solid' },
                  ]}>
                  <Text style={[styles.num, { color: t.ink }]}>{c.day}</Text>
                  <Text
                    style={[styles.sub, { color: full || (type && c.done) ? t.accent : t.faint }]}
                    testID={`calendar-${c.date}-sub`}>
                    {sub}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
      {picked && list.length ? (
        <View style={styles.dayList} testID="calendar-day">
          <View style={styles.dayHead}>
            <Text accessibilityRole="header" style={[styles.dayTitle, { color: t.ink }]}>
              {longDate(picked)}
            </Text>
            <Text style={[styles.dayCount, { color: t.muted }]}>
              {doneN} of {list.length} done
            </Text>
          </View>
          {list.map((it) => (
            <View key={it.path}>{renderRow(it)}</View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 10, marginTop: 2 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  // 44 pt round buttons, the house's minimum tap size for small controls.
  nav: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { fontFamily: FONT.bodySemi, fontSize: 22, lineHeight: 26 },
  month: { fontFamily: FONT.display, fontSize: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, padding: 2 },
  dow: { textAlign: 'center', fontFamily: FONT.bodySemi, fontSize: 11 },
  square: { minHeight: 46, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dayBox: { borderWidth: 1 },
  num: { fontFamily: FONT.bodySemi, fontSize: 14 },
  sub: { fontFamily: FONT.bodySemi, fontSize: 11, minHeight: 14 },
  dayList: { marginTop: 14 },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  dayTitle: { fontFamily: FONT.display, fontSize: 17 },
  dayCount: { fontFamily: FONT.body, fontSize: 12.5 },
});
