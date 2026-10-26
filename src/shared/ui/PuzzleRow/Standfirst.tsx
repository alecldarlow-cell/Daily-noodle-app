import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

/**
 * The text to show for a standfirst laid out as `lines`, at most `max` of them: null when it
 * fits (show it whole), else the lines kept with their last word dropped and the cut's own
 * spaces and punctuation trimmed, then one "…". So a sentence cut at its full stop reads
 * "the more you…", never "score.…", and the ellipsis always has room on the last line.
 */
export function clampStandfirst(lines: readonly string[], max: number): string | null {
  if (lines.length <= max) return null;
  const kept = lines.slice(0, max).join('').replace(/\s+$/, '');
  const cut = kept.includes(' ') ? kept.replace(/\s+\S*$/, '') : kept;
  return cut.replace(/[\s.,;:!?…–—-]+$/, '') + '…';
}

interface Props {
  text: string;
  max: number;
  style: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * A card's standfirst, up to `max` lines, ending in one clean "…" when cut (the site's
 * `-webkit-line-clamp`). Android's own ellipsis would sometimes land just after a sentence's
 * full stop ("score.…", seen on the phone), so the text is laid out once in full, out of
 * sight, and cut here by whole words. Before that layout arrives it shows as before.
 */
export function Standfirst({ text, max, style, testID }: Props) {
  const [laid, setLaid] = useState<{ text: string; lines: string[] } | null>(null);
  const lines = laid?.text === text ? laid.lines : null;
  const cut = lines ? clampStandfirst(lines, max) : undefined;
  return (
    <View>
      <Text
        style={[style, styles.measure]}
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        testID={testID ? `${testID}-measure` : undefined}
        onTextLayout={(e) => {
          const next = e.nativeEvent.lines.map((l) => l.text);
          setLaid((o) =>
            o && o.text === text && o.lines.join('\n') === next.join('\n')
              ? o
              : { text, lines: next },
          );
        }}>
        {text}
      </Text>
      <Text
        style={style}
        numberOfLines={cut === null ? undefined : max}
        accessibilityLabel={text}
        testID={testID}>
        {cut ?? text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
});
