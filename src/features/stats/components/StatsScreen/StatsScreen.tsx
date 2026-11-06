import {
  clock,
  monthName,
  STATS_MIN_SHOW,
  STATS_TYPES,
  TYPE_LABEL,
  yearShare,
  type SpreadBin,
  type StatsMode,
  type TrendPoint,
  type TypeStats,
  type YearCard,
} from '@noodle/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { FONT, useTokens, type Tokens } from '@/shared/theme';
import { useLondonDay } from '@/shared/time';
import { Button, Screen } from '@/shared/ui';

import { useStats } from '../../hooks/useStats';

const MODES: { id: StatsMode; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'day', label: 'On the day' },
  { id: 'archive', label: 'Catch-ups' },
];
const fmt = (n: number) => n.toLocaleString('en-GB');
const plural = (n: number, w: string) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;

/**
 * Your stats (6 Nov 2026, Alec: a fifth tab, free, no sign-in). From this phone's saves only,
 * as the website's stats.html (the same maths, @noodle/core's port of dn-stats.js). Calm and
 * celebratory, the site's rule for streaks: personal bests, never "slower than usual", and no
 * comparison with other players (Leagues does that).
 */
export function StatsScreen() {
  const t = useTokens();
  const today = useLondonDay();
  const [mode, setMode] = useState<StatsMode>('all');
  const { summary, all, year, hasDates } = useStats(today, mode);

  if (!all.overall.finished)
    return (
      <Screen title="Stats" testID="stats-screen">
        <View style={[styles.empty, { borderColor: t.hair }]} testID="stats-empty">
          <Text style={[styles.emptyText, { color: t.muted }]}>
            Finish a puzzle and your stats start here.
          </Text>
          <Button label="Today’s puzzles" onPress={() => router.navigate('/')} />
        </View>
      </Screen>
    );

  const o = summary.overall;
  const played = STATS_TYPES.map((ty) => summary.types[ty]).filter((s) => s.n);
  const not = STATS_TYPES.filter((ty) => !summary.types[ty].n).map((ty) => TYPE_LABEL[ty]);
  return (
    <Screen title="Stats" testID="stats-screen">
      <Text style={[styles.note, { color: t.muted }]}>
        Worked out on this phone from the puzzles you’ve finished. Nothing is sent anywhere.
      </Text>
      {year ? <YearBlock y={year} t={t} /> : null}
      {hasDates ? (
        <View
          style={[styles.seg, { borderColor: t.hair, backgroundColor: t.paper }]}
          testID="stats-modes">
          {MODES.map((m) => {
            const on = m.id === mode;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                testID={`mode-${m.id}`}
                onPress={() => setMode(m.id)}
                style={[styles.segBtn, on && { backgroundColor: t.accentSoft }]}>
                <Text style={[styles.segText, { color: on ? t.accent : t.muted }]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.tiles} testID="stats-overall">
        <Tile t={t} label="Puzzles finished" value={fmt(o.finished)} />
        <Tile t={t} label="Days played" value={fmt(o.days)} />
        <Tile
          t={t}
          label="Current run"
          value={o.run >= 2 ? `🔥 ${o.run}` : String(o.run)}
          unit={o.run === 1 ? 'day' : 'days'}
        />
        <Tile
          t={t}
          label="Longest run"
          value={String(o.longest)}
          unit={o.longest === 1 ? 'day' : 'days'}
        />
      </View>
      {o.favourite ? (
        <Text style={[styles.fav, { color: t.muted }]} testID="stats-favourite">
          Favourite:{' '}
          <Text style={{ color: t.ink, fontFamily: FONT.bodySemi }}>{o.favourite.label}</Text> (
          {fmt(o.favourite.n)} finished)
        </Text>
      ) : null}
      {played.map((s) => (
        <TypeCard key={s.type} s={s} t={t} />
      ))}
      {not.length ? (
        <Text style={[styles.small, { color: t.faint }]} testID="stats-not-played">
          Not played yet{mode === 'all' ? '' : ' this way'}: {not.join(', ')}.
        </Text>
      ) : null}
      <View style={styles.footer} />
    </Screen>
  );
}

function Tile({
  t,
  label,
  value,
  unit,
}: {
  t: Tokens;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View
      style={[styles.tile, { borderColor: t.hair, backgroundColor: t.paper }]}
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ' ' + unit : ''}`}>
      <Text style={[styles.tileLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: t.ink }]}>
        {value}
        {unit ? <Text style={[styles.tileUnit, { color: t.muted }]}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function YearBlock({ y, t }: { y: YearCard; t: Tokens }) {
  const line = [
    `${plural(y.finished, 'puzzle')} over ${plural(y.days, 'day')}`,
    y.longest >= 2 ? `longest run ${y.longest} days` : '',
    y.favourite ? `favourite: ${y.favourite.label}` : '',
    y.busiest ? `busiest month: ${monthName(y.busiest)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[styles.year, { backgroundColor: t.accentSoft }]} testID="stats-year">
      <Text accessibilityRole="header" style={[styles.yearTitle, { color: t.ink }]}>
        Your {y.year} in Noodle
      </Text>
      <Text style={[styles.yearLine, { color: t.ink }]}>{line}</Text>
      {y.bests.length ? (
        <Text style={[styles.yearBests, { color: t.ink }]}>
          <Text style={{ color: t.muted, fontFamily: FONT.bodySemi }}>Personal bests: </Text>
          {y.bests
            .map((b) => `${b.label} ${b.secs != null ? clock(b.secs) : fmt(b.score ?? 0) + ' pts'}`)
            .join(' · ')}
        </Text>
      ) : null}
      <View style={styles.yearShare}>
        <Button
          label="Share"
          variant="tonal"
          testID="stats-share"
          onPress={() => {
            Share.share({ message: yearShare(y) }).catch(() => undefined);
          }}
        />
      </View>
    </View>
  );
}

function Row({ t, label, value }: { t: Tokens; label: string; value: string | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.kv}>
      <Text style={[styles.kvLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.kvValue, { color: t.ink }]}>{value}</Text>
    </View>
  );
}

function TypeCard({ s, t }: { s: TypeStats; t: Tokens }) {
  const n = (x: number | null | undefined) => (x == null ? null : fmt(x));
  return (
    <View
      style={[styles.card, { borderColor: t.hair, backgroundColor: t.paper }]}
      testID={`stats-${s.type}`}>
      <View style={styles.cardHead}>
        <Text accessibilityRole="header" style={[styles.cardTitle, { color: t.ink }]}>
          {s.label}
        </Text>
        <Text style={[styles.cardCount, { color: t.muted }]}>{plural(s.n, 'puzzle')} finished</Text>
      </View>
      <View style={styles.kvs}>
        {s.scored ? (
          <>
            <Row t={t} label="Best" value={s.best != null ? `${fmt(s.best)} pts` : null} />
            <Row t={t} label="Average" value={s.average != null ? `${fmt(s.average)} pts` : null} />
            {s.type === 'borders' ? (
              <>
                <Row
                  t={t}
                  label="Most right"
                  value={s.bestCorrect != null ? `${s.bestCorrect}/10` : null}
                />
                <Row
                  t={t}
                  label="Average right"
                  value={s.averageCorrect != null ? `${s.averageCorrect}/10` : null}
                />
              </>
            ) : null}
            {s.type === 'tangle' ? (
              <>
                <Row t={t} label="Most words" value={n(s.mostWords)} />
                <Row t={t} label="Star word" value={`${s.stars ?? 0} of ${s.n}`} />
              </>
            ) : null}
            {s.type === 'reckon' ? <Row t={t} label="Bullseyes" value={n(s.bullseyes)} /> : null}
          </>
        ) : (
          <>
            <Row t={t} label="Best" value={s.best != null ? clock(s.best) : null} />
            <Row t={t} label="Median" value={s.median != null ? clock(s.median) : null} />
            {s.won != null ? (
              <Row
                t={t}
                label="Solved"
                value={`${s.won} of ${s.n}${s.solveRate != null ? ` (${s.solveRate}%)` : ''}`}
              />
            ) : null}
            {s.type === 'link' ? (
              <Row t={t} label="Average mistakes" value={n(s.mistakes)} />
            ) : null}
          </>
        )}
      </View>
      {s.n < STATS_MIN_SHOW ? (
        <Text style={[styles.small, { color: t.faint }]}>
          Medians and charts appear after {STATS_MIN_SHOW} finished.
        </Text>
      ) : null}
      {s.spread ? <Spread s={s} bins={s.spread} t={t} /> : null}
      {s.trend ? <Trend s={s} pts={s.trend} t={t} /> : null}
    </View>
  );
}

/** The one chart hue: the Puzzles green, stepped for dark (as the site's --st-mark). */
const markOf = (t: Tokens) => (t.canvas === '#11131A' ? '#34A673' : '#0E7A4B');

function Spread({ s, bins, t }: { s: TypeStats; bins: SpreadBin[]; t: Tokens }) {
  const timed = !s.scored;
  const max = Math.max(...bins.map((b) => b.n)) || 1;
  const lab = (b: SpreadBin) =>
    timed
      ? clock(b.from) + (b.open ? '+' : '–' + clock(b.to))
      : fmt(b.from) + (b.open ? '+' : '–' + fmt(b.to - 1));
  const first = bins[0]!;
  const last = bins[bins.length - 1]!;
  const end = last.open ? last.from : last.to;
  const summary = bins.map((b) => `${lab(b)}: ${plural(b.n, 'puzzle')}`).join('; ');
  return (
    <View
      style={styles.fig}
      accessible
      accessibilityLabel={`${timed ? 'Your times' : 'Your scores'}. ${summary}`}>
      <Text style={[styles.figCap, { color: t.faint }]}>
        {timed ? 'Your times' : 'Your scores'}
      </Text>
      <View style={[styles.bars, { borderBottomColor: t.hair }]}>
        {bins.map((b, i) => (
          <View key={i} style={styles.col}>
            {b.n ? (
              <View
                style={[
                  styles.bar,
                  { height: Math.max(4, Math.round((56 * b.n) / max)), backgroundColor: markOf(t) },
                ]}
              />
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisText, { color: t.faint }]}>
          {timed ? clock(first.from) : fmt(first.from)}
        </Text>
        <Text style={[styles.axisText, { color: t.faint }]}>
          {(timed ? clock(end) : fmt(end)) + (last.open ? '+' : '')}
        </Text>
      </View>
    </View>
  );
}

/** Median time or average score by month, from zero, so a slower month never looks like a cliff. */
function Trend({ s, pts, t }: { s: TypeStats; pts: TrendPoint[]; t: Tokens }) {
  const [w, setW] = useState(0);
  const H = 56;
  const timed = !s.scored;
  const show = (v: number) => (timed ? clock(v) : fmt(v));
  const hi = Math.max(...pts.map((p) => p.value ?? 0)) || 1;
  const inner = Math.max(0, w - 46);
  const x = (i: number) => 4 + (i * inner) / (pts.length - 1);
  const y = (v: number) => 6 + ((hi - v) * (H - 12)) / hi;
  const dots = pts.flatMap((p, i) =>
    p.value == null ? [] : [{ i, v: p.value, x: x(i), y: y(p.value) }],
  );
  const segs = dots.slice(1).flatMap((d, k) => {
    const a = dots[k]!;
    if (d.i !== a.i + 1) return [];
    const len = Math.hypot(d.x - a.x, d.y - a.y);
    const ang = (Math.atan2(d.y - a.y, d.x - a.x) * 180) / Math.PI;
    return [
      { key: `s${a.i}`, left: (a.x + d.x) / 2 - len / 2, top: (a.y + d.y) / 2 - 1, len, ang },
    ];
  });
  const end = dots[dots.length - 1];
  const summary = dots.map((d) => `${monthName(pts[d.i]!.month)}: ${show(d.v)}`).join('; ');
  const mark = markOf(t);
  return (
    <View
      style={styles.fig}
      accessible
      accessibilityLabel={`${timed ? 'Median time' : 'Average score'} by month. ${summary}`}
      testID={`trend-${s.type}`}>
      <Text style={[styles.figCap, { color: t.faint }]}>
        {timed ? 'Median time by month' : 'Average score by month'}
      </Text>
      <View
        style={{ height: H }}
        testID={`trend-${s.type}-plot`}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        <View style={[styles.base, { top: H - 6, width: inner + 8, backgroundColor: t.hair }]} />
        {w
          ? segs.map((g) => (
              <View
                key={g.key}
                style={[
                  styles.seg2,
                  {
                    left: g.left,
                    top: g.top,
                    width: g.len,
                    backgroundColor: mark,
                    transform: [{ rotate: `${g.ang}deg` }],
                  },
                ]}
              />
            ))
          : null}
        {w
          ? dots.map((d) => (
              <View
                key={`d${d.i}`}
                style={[
                  styles.dot,
                  { left: d.x - 5, top: d.y - 5, backgroundColor: mark, borderColor: t.paper },
                ]}
              />
            ))
          : null}
        {w && end ? (
          <Text style={[styles.endLabel, { left: end.x + 8, top: end.y - 8, color: t.muted }]}>
            {show(end.v)}
          </Text>
        ) : null}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisText, { color: t.faint }]}>
          {monthName(pts[0]!.month).slice(0, 3)}
        </Text>
        <Text style={[styles.axisText, { color: t.faint }]}>
          {monthName(pts[pts.length - 1]!.month).slice(0, 3)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: FONT.body, fontSize: 13, marginBottom: 12 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: { fontFamily: FONT.body, fontSize: 15, textAlign: 'center' },
  seg: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 2,
    marginBottom: 12,
  },
  // 40 pt buttons in a 3 pt-padded, bordered pill: 48 pt to tap, as the Archive's switch.
  segBtn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 40,
    justifyContent: 'center',
  },
  segText: { fontFamily: FONT.bodySemi, fontSize: 12.5 },
  year: { borderRadius: 14, padding: 16, marginBottom: 14 },
  yearTitle: { fontFamily: FONT.serif, fontSize: 26, marginBottom: 4 },
  yearLine: { fontFamily: FONT.body, fontSize: 14, lineHeight: 21 },
  yearBests: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20, marginTop: 8 },
  yearShare: { marginTop: 12, alignSelf: 'flex-start' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tileLabel: { fontFamily: FONT.body, fontSize: 12 },
  tileValue: { fontFamily: FONT.serif, fontSize: 30, lineHeight: 36 },
  tileUnit: { fontFamily: FONT.body, fontSize: 12 },
  fav: { fontFamily: FONT.body, fontSize: 13, marginTop: 8, marginBottom: 2 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10 },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },
  cardTitle: { fontFamily: FONT.display, fontSize: 17 },
  cardCount: { fontFamily: FONT.body, fontSize: 12.5 },
  kvs: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, rowGap: 4 },
  kv: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexBasis: '50%' },
  kvLabel: { fontFamily: FONT.body, fontSize: 12.5 },
  kvValue: { fontFamily: FONT.bodySemi, fontSize: 14 },
  small: { fontFamily: FONT.body, fontSize: 12.5, marginTop: 8 },
  fig: { marginTop: 12 },
  figCap: { fontFamily: FONT.bodySemi, fontSize: 11.5, marginBottom: 6 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 58, borderBottomWidth: 1 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  // ≤24 pt wide, rounded at the top, square at the baseline (the dataviz mark spec).
  bar: { width: '100%', maxWidth: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  axisText: { fontFamily: FONT.body, fontSize: 11 },
  base: { position: 'absolute', left: 0, height: 1 },
  seg2: { position: 'absolute', height: 2, borderRadius: 1 },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  endLabel: { position: 'absolute', fontFamily: FONT.bodySemi, fontSize: 11 },
  footer: { height: 72 },
});
