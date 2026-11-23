import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';

import {
  estimateWidth,
  KB_ROWS,
  KEY_GAP,
  keyHeight,
  keyWidths,
} from '../../mini/components/MiniKeyboard';
import {
  clueRuns,
  groups,
  hintsText,
  locked,
  revealed,
  spanChars,
  tip,
  TYPE_NAME,
  type ClueRun,
  type CrypticData,
  type CrypticState,
  type Solution,
} from '../model';

/**
 * The clue's serif: the house Instrument Serif (the approved mocks' clue face). The website sets
 * it in Georgia; the app keeps to its own bundled faces, as Android drops a custom face under
 * a system one or a weight (theme/tests/fonts.test.ts).
 */
const CLUE_FONT = FONT.serif;

/**
 * One run of the clue, marked as the page marks it. The website's definition line is a 3px
 * brand underline; React Native has no underline thickness, and Android ignores
 * textDecorationColor, so a hairline in brand blue all but vanished on the dark theme. The
 * definition also sits on the brand tint so the hint reads on both themes and both platforms.
 */
function Run({ run, mark }: { run: ClueRun; mark: string }) {
  const pt = usePuzzleTokens();
  return (
    <Text
      testID={run.d ? 'cryptic-def' : undefined}
      style={[
        run.d && {
          textDecorationLine: 'underline',
          textDecorationColor: pt.brand,
          textDecorationStyle: 'solid',
          backgroundColor: pt.brandTint,
        },
        run.m && { backgroundColor: mark, color: pt.onActive },
        run.i && { fontStyle: 'italic' },
      ]}>
      {run.text}
    </Text>
  );
}

/** The clue as printed: a bold 1, the clue in the book serif, the enumeration in soft ink. */
function ClueText({ p, runs, size = 23 }: { p: CrypticData; runs: ClueRun[]; size?: number }) {
  const pt = usePuzzleTokens();
  return (
    <View style={styles.clueRow}>
      <Text style={[styles.cnum, { color: pt.ink, fontSize: size }]} aria-hidden>
        1
      </Text>
      <Text
        style={[
          styles.clue,
          { color: pt.ink, fontSize: size, lineHeight: Math.round(size * 1.32) },
        ]}
        testID="cryptic-clue">
        {runs.map((r, k) => (
          <Run key={k} run={r} mark={pt.active} />
        ))}
        <Text style={{ color: pt.inkSoft }}>{` (${p.enum})`}</Text>
      </Text>
    </View>
  );
}

interface BoardProps {
  state: CrypticState;
  width: number;
  onSelect: (i: number) => void;
}

/** The clue card: ACROSS, the clue, and the answer as one crossword light. */
export function CrypticCard({ state, width, onSelect }: BoardProps) {
  const pt = usePuzzleTokens();
  const p = state.p;
  const N = p.n;
  const G = groups(p.enum);
  const runs = clueRuns(p.clue, { def: state.hints >= 1 ? spanChars(p.clue, p.def) : null });
  const side = Math.max(24, Math.min(54, Math.floor((width - 36 - 6) / N)));
  // the word breaks: square i starts a new word when the groups before it are used up
  const gapBefore = new Set<number>();
  let at = 0;
  for (let g = 0; g < G.length - 1; g++) {
    at += G[g]!;
    gapBefore.add(at);
  }
  // a wrong answer shakes the squares (engines/cryptic.css .shake); nothing else moves them
  const [shake] = useState(() => new Animated.Value(0));
  const seen = useRef(state.wrong);
  useEffect(() => {
    if (state.wrong === seen.current) return;
    seen.current = state.wrong;
    shake.setValue(0);
    Animated.sequence(
      [8, -8, 6, -6, 0].map((v) =>
        Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true }),
      ),
    ).start();
  }, [state.wrong, shake]);
  const won = state.solved;
  return (
    <View style={[styles.card, { backgroundColor: pt.sheet }]} testID="cryptic-card">
      <Text style={[styles.across, { color: pt.inkSoft, borderBottomColor: pt.rule }]}>ACROSS</Text>
      <ClueText p={p} runs={runs} />
      <Animated.View
        style={[
          styles.light,
          { borderColor: pt.line, backgroundColor: pt.line, transform: [{ translateX: shake }] },
        ]}
        testID="cryptic-grid">
        {state.letters.map((ch, i) => {
          const cur = !won && i === state.cur && !locked(state, i);
          const lock = locked(state, i);
          const bg = won ? pt.good : cur ? pt.active : pt.activeWord;
          const fg = won ? '#FFFFFF' : lock ? pt.brand : cur ? pt.onActive : pt.onWord;
          return (
            <Pressable
              key={i}
              testID={`cryptic-sq-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`Letter ${i + 1} of ${N}${ch ? `: ${ch}` : ', empty'}${lock ? ', revealed' : ''}`}
              accessibilityState={{ selected: cur }}
              onPress={() => onSelect(i)}
              style={[
                styles.sq,
                {
                  width: side,
                  height: side,
                  backgroundColor: bg,
                  borderLeftWidth: i === 0 ? 0 : gapBefore.has(i) ? 4 : 1,
                  borderLeftColor: gapBefore.has(i)
                    ? pt.line
                    : won
                      ? 'rgba(255,255,255,0.35)'
                      : pt.cellEdge,
                },
              ]}>
              {i === 0 ? (
                <Text
                  style={[
                    styles.sqNum,
                    {
                      color: won ? 'rgba(255,255,255,0.8)' : cur ? pt.onActive : pt.inkSoft,
                      fontSize: Math.max(9, side * 0.2),
                    },
                  ]}>
                  1
                </Text>
              ) : null}
              <Text style={[styles.sqText, { color: fg, fontSize: side * 0.48 }]}>{ch}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

/** The panel once the clue type is named (hint 2 on): the chip, the tip and the hint meter. */
export function HintPanel({ state, onLearn }: { state: CrypticState; onLearn: () => void }) {
  const pt = usePuzzleTokens();
  if (state.hints < 2) return null;
  const h = state.hints;
  return (
    <View
      style={[styles.panel, { backgroundColor: pt.card, borderColor: pt.lineSoft }]}
      testID="cryptic-hint-panel">
      <View style={styles.chipRow}>
        <Text style={[styles.kick, { color: pt.inkSoft }]}>CLUE TYPE</Text>
        <Text style={[styles.chip, { color: pt.actInk, backgroundColor: pt.brandTint }]}>
          {TYPE_NAME[state.p.kind]}
        </Text>
      </View>
      <Text style={[styles.tip, { color: pt.ink }]}>{tip(state.p)}</Text>
      <View style={styles.meter} accessibilityLabel={`${hintsText(h)} used`}>
        {[0, 1, 2].map((k) => (
          <View
            key={k}
            style={[styles.pip, { backgroundColor: k < Math.min(h, 3) ? pt.brand : pt.lineSoft }]}
          />
        ))}
        <Text style={[styles.used, { color: pt.inkSoft }]}>{hintsText(h)} used</Text>
        <Pressable accessibilityRole="link" onPress={onLearn} hitSlop={8}>
          <Text style={[styles.learn, { color: pt.actInk }]}>Learn the clue types ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Hint (or Reveal a letter) and Clear. */
export function HintButtons({
  state,
  onHint,
  onClear,
}: {
  state: CrypticState;
  onHint: () => void;
  onClear: () => void;
}) {
  const pt = usePuzzleTokens();
  const h = state.hints;
  const label = h < 2 ? `💡 Hint ${h + 1} of 3` : '👁 Reveal a letter';
  const done = state.solved || revealed(state) >= state.p.n;
  return (
    <View style={styles.btns}>
      <Pressable
        testID="cryptic-hint"
        accessibilityRole="button"
        accessibilityLabel={h < 2 ? `Hint ${h + 1} of 3` : 'Reveal a letter'}
        disabled={done}
        onPress={onHint}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: pt.card, borderColor: pt.lineSoft, opacity: done ? 0.5 : 1 },
          pressed && { backgroundColor: pt.activeWord },
        ]}>
        <Text style={[styles.btnText, { color: pt.ink }]}>{label}</Text>
      </Pressable>
      <Pressable
        testID="cryptic-clear"
        accessibilityRole="button"
        disabled={state.solved}
        onPress={onClear}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: pt.card, borderColor: pt.lineSoft },
          pressed && { backgroundColor: pt.activeWord },
        ]}>
        <Text style={[styles.btnText, { color: pt.ink }]}>Clear</Text>
      </Pressable>
    </View>
  );
}

/** The on-screen keyboard: the Mini's staggered QWERTY, with Enter and Delete on the bottom row. */
export function CrypticKeyboard({
  onKey,
  onDelete,
  onEnter,
}: {
  onKey: (ch: string) => void;
  onDelete: () => void;
  onEnter: () => void;
}) {
  const pt = usePuzzleTokens();
  const win = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? estimateWidth(win.width);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && (measured === null || Math.abs(w - measured) >= 0.5)) setMeasured(w);
  };
  const size = keyWidths(width);
  const height = keyHeight(win.height);
  const key = { backgroundColor: pt.card, borderColor: pt.lineSoft, height };
  const pressedKey = { backgroundColor: pt.activeWord };
  return (
    <View style={styles.kb} testID="cryptic-keyboard" onLayout={onLayout}>
      {KB_ROWS.map((row, i) => (
        <View key={row} style={styles.kbRow}>
          {i === 2 ? (
            <Pressable
              testID="key-enter"
              accessibilityRole="button"
              accessibilityLabel="Enter"
              accessibilityHint="Check your answer"
              onPress={onEnter}
              style={({ pressed }) => [
                styles.key,
                { width: size.del, height, backgroundColor: pt.brand, borderColor: pt.brand },
                pressed && { opacity: 0.85 },
              ]}>
              <Text maxFontSizeMultiplier={1.2} style={[styles.enterText, { color: pt.onBrand }]}>
                Enter
              </Text>
            </Pressable>
          ) : null}
          {[...row].map((ch) => (
            <Pressable
              key={ch}
              testID={`key-${ch}`}
              accessibilityRole="button"
              accessibilityLabel={ch}
              onPress={() => onKey(ch)}
              style={({ pressed }) => [
                styles.key,
                { width: size.key },
                key,
                pressed && pressedKey,
              ]}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.keyText, { color: pt.ink }]}>
                {ch}
              </Text>
            </Pressable>
          ))}
          {i === 2 ? (
            <Pressable
              testID="key-del"
              accessibilityRole="button"
              accessibilityLabel="Delete"
              onPress={onDelete}
              style={({ pressed }) => [
                styles.key,
                { width: size.del },
                key,
                pressed && pressedKey,
              ]}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.keyText, { color: pt.ink }]}>
                ⌫
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** The finish's "How it works" (mock 4): the clue marked, the answer, Definition / Signpost / Wordplay. */
export function CrypticRecap({
  p,
  sol,
  onLearn,
}: {
  p: CrypticData;
  sol: Solution;
  onLearn: () => void;
}) {
  const pt = usePuzzleTokens();
  const def = spanChars(p.clue, p.def);
  const runs = clueRuns(p.clue, {
    def,
    sec: sol.sec ?? null,
    ind: spanChars(p.clue, p.ind),
    mark: sol.mark ?? [],
  });
  const at = p.def[0] === 0 ? 'at the start' : 'at the end';
  const rows: [string, string][] = [
    ['Definition', `${def ? p.clue.slice(def[0], def[1]) : ''}, ${at}`],
    ['Signpost', sol.explain[0]],
    ['Wordplay', sol.explain[1]],
  ];
  return (
    <View style={styles.recap} testID="cryptic-recap">
      <Text style={[styles.recapClue, { color: pt.ink }]}>
        {runs.map((r, k) => (
          <Run key={k} run={r} mark={pt.active} />
        ))}
      </Text>
      <View style={styles.tiles}>
        {sol.a.split('').map((ch, i) => (
          <View key={i} style={[styles.tile, { backgroundColor: pt.good }]}>
            <Text style={styles.tileText}>{ch}</Text>
          </View>
        ))}
      </View>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.dl}>
          <Text style={[styles.dt, { color: pt.sheetSoft }]}>{k}</Text>
          <Text style={[styles.dd, { color: pt.ink }]}>{v}</Text>
        </View>
      ))}
      <Text style={[styles.type, { color: pt.sheetSoft }]}>Clue type: {TYPE_NAME[p.kind]}</Text>
      <Pressable accessibilityRole="link" onPress={onLearn} hitSlop={8}>
        <Text style={[styles.learn, { color: pt.actInk }]}>Learn the clue types ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 20, gap: 12 },
  across: {
    fontFamily: FONT.sansSemi,
    fontSize: 13,
    letterSpacing: 1,
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  clueRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  cnum: { fontFamily: FONT.sansSemi },
  clue: { flex: 1, fontFamily: CLUE_FONT },
  light: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderWidth: 3,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 6,
  },
  sq: { alignItems: 'center', justifyContent: 'center' },
  sqNum: { position: 'absolute', top: 3, left: 4, fontFamily: FONT.sansSemi },
  sqText: { fontFamily: FONT.sansSemi },
  panel: { borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kick: { fontFamily: FONT.sansSemi, fontSize: 11, letterSpacing: 0.8 },
  chip: {
    fontFamily: FONT.sansSemi,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  tip: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pip: { width: 22, height: 6, borderRadius: 3 },
  used: { fontFamily: FONT.sans, fontSize: 13, marginLeft: 4, marginRight: 8 },
  learn: { fontFamily: FONT.sansSemi, fontSize: 13 },
  btns: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: FONT.sansSemi, fontSize: 15 },
  kb: { gap: 10, marginHorizontal: -8 },
  kbRow: { flexDirection: 'row', gap: KEY_GAP, justifyContent: 'center' },
  key: {
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 20, fontFamily: FONT.sansSemi },
  enterText: { fontSize: 14, fontFamily: FONT.sansSemi },
  recap: { gap: 10 },
  recapClue: { fontFamily: CLUE_FONT, fontSize: 19, lineHeight: 26 },
  tiles: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  tile: { width: 34, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tileText: { color: '#FFFFFF', fontFamily: FONT.bodyBold, fontSize: 19 },
  dl: { gap: 2 },
  dt: { fontFamily: FONT.sansSemi, fontSize: 12, letterSpacing: 0.4 },
  dd: { fontFamily: FONT.sans, fontSize: 15, lineHeight: 21 },
  type: { fontFamily: FONT.sans, fontSize: 13 },
});
