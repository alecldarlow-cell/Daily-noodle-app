import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';

/**
 * A link under the recap (finish.css .fin-link): "Play again (not recorded)", "Explore more
 * outlines in Borderline". One look on every sheet: the link ink, semibold, no underline.
 */
export function FinishLink({
  label,
  onPress,
  role = 'button',
  testID,
}: {
  label: string;
  onPress: () => void;
  /** 'link' when it leaves the app for the website. */
  role?: 'button' | 'link';
  testID?: string;
}) {
  const pt = usePuzzleTokens();
  return (
    <Pressable
      accessibilityRole={role}
      onPress={onPress}
      hitSlop={8}
      style={styles.link}
      testID={testID}>
      <Text style={[styles.linkText, { color: pt.actInk }]}>{label}</Text>
    </Pressable>
  );
}

/** A straight stroke from (x1, y1) to (x2, y2) with round ends, as an SVG path draws it. */
function Stroke(p: { x1: number; y1: number; x2: number; y2: number; w: number; color: string }) {
  const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1) + p.w;
  const deg = (Math.atan2(p.y2 - p.y1, p.x2 - p.x1) * 180) / Math.PI;
  return (
    <View
      style={{
        position: 'absolute',
        width: len,
        height: p.w,
        borderRadius: p.w / 2,
        backgroundColor: p.color,
        left: (p.x1 + p.x2) / 2 - len / 2,
        top: (p.y1 + p.y2) / 2 - p.w / 2,
        transform: [{ rotate: `${deg}deg` }],
      }}
    />
  );
}

/**
 * The sheet's tick and cross, drawn rather than typed (link.js TICK and CROSS: 24-unit
 * paths at a 2.6 stroke), so they look the same on every phone: the bundled fonts have
 * no ✓ or ✕, and a phone's fallback font draws them thin and differently.
 */
export function Mark({
  kind,
  size = 20,
  color,
}: {
  kind: 'tick' | 'cross';
  size?: number;
  color: string;
}) {
  const k = size / 24;
  const w = 2.6 * k;
  const s = (x1: number, y1: number, x2: number, y2: number) => ({
    x1: x1 * k,
    y1: y1 * k,
    x2: x2 * k,
    y2: y2 * k,
    w,
    color,
  });
  return (
    <View style={{ width: size, height: size }} testID={`mark-${kind}`} accessible={false}>
      {kind === 'tick' ? (
        <>
          <Stroke {...s(5, 12.5, 9.5, 17)} />
          <Stroke {...s(9.5, 17, 19, 7.5)} />
        </>
      ) : (
        <>
          <Stroke {...s(6, 6, 18, 18)} />
          <Stroke {...s(18, 6, 6, 18)} />
        </>
      )}
    </View>
  );
}

/** A note with one bold run (finish.js puts the note in as HTML, with <strong> in ink). */
export interface NoteParts {
  before: string;
  bold: string;
  after: string;
}

/** Reckon's note, bolded as reckon.js noteFor: "Three bullseyes", "Ten bullseyes." */
export function boldLead(note: string): NoteParts | string {
  const m = /^(Ten bullseyes\.|[A-Z][a-z]* bullseyes?)(.*)$/s.exec(note);
  return m && !note.startsWith('No ') ? { before: '', bold: m[1]!, after: m[2]! } : note;
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontSize: 15, fontFamily: FONT.sansSemi },
});
