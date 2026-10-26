import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useReduceMotion } from '@/shared/motion';

import { FONT, usePuzzleTokens } from '@/shared/theme';

import { disabled, MAX_MISTAKES, type LinkState } from '../model';
import type { ScreenMove } from '../hooks/useLinkGame';
import { GROUP, ON_GROUP } from './LinkParts';
import { Landing, LostPip, SettleTile, Wobble } from './LinkMotion';

interface LinkBoardProps {
  state: LinkState;
  dispatch: (m: ScreenMove) => void;
}

/**
 * The board as engines/link.js renders it on a phone: solved groups as bands in the
 * order found, the tiles still in play four to a row, the four mistake pips, the
 * message line and Shuffle / Deselect / Submit. A right four turns its group's
 * colour while it settles.
 */
/**
 * Lines a tile's word may take: one for a single word, so a long one (SPINNAKER) shrinks
 * to fit rather than breaking mid-word; two when it has a space to break at.
 */
export function tileLines(w: string): 1 | 2 {
  return /\s/.test(w.trim()) ? 2 : 1;
}

/** A wrong four's tiles while they wobble (.tile.miss): pale red, red text and ring. */
const MISS_BG = '#FBE3E0';

export function LinkBoard({ state, dispatch }: LinkBoardProps) {
  const pt = usePuzzleTokens();
  const off = disabled(state);
  const motion = useReduceMotion() === false;
  const rows: string[][] = [];
  for (let r = 0; r < state.live.length / 4; r++) rows.push(state.live.slice(r * 4, r * 4 + 4));
  const hit = state.settling;
  const hitRank = hit ? state.p.groups[hit.group]!.rank : 0;

  // What just happened, read off the move that made this state (the page's classes do it):
  // a wrong four (or a repeat) wobbles, a spent pip flashes, a new band lands.
  const [last, setLast] = useState(state);
  const [miss, setMiss] = useState<{ n: number; tiles: string[]; pip: number } | null>(null);
  const [landed, setLanded] = useState<number | null>(null);
  if (last !== state) {
    setLast(state);
    if (motion) {
      const lost = state.mistakes > last.mistakes;
      const again = state.msg.text === 'Already tried that one' && last.msg.text !== state.msg.text;
      if (lost || again)
        setMiss({ n: (miss?.n ?? 0) + 1, tiles: state.sel, pip: lost ? state.mistakes - 1 : -1 });
      if (state.solved.length === last.solved.length + 1) setLanded(state.solved.at(-1)!);
    }
  }
  // The board's geometry, for the right four's flight to the band's row.
  const [geo, setGeo] = useState({ h: 0, w: 0 });
  const measure = (e: LayoutChangeEvent) => {
    const { height, width } = e.nativeEvent.layout;
    if (height !== geo.h || width !== geo.w) setGeo({ h: height, w: width });
  };
  const tileW = (geo.w - 3 * 8) / 4;

  const face = (w: string, look: 'plain' | 'sel' | 'miss' | 'turned') => (
    <View
      style={[
        styles.tile,
        styles.face,
        { backgroundColor: pt.card },
        look === 'sel' && {
          backgroundColor: pt.activeWord,
          borderColor: pt.active,
          borderWidth: 2.5,
        },
        look === 'miss' && { backgroundColor: MISS_BG, borderColor: pt.bad, borderWidth: 2.5 },
        look === 'turned' && { backgroundColor: GROUP[hitRank] },
      ]}>
      <Text
        maxFontSizeMultiplier={1.3}
        style={[
          styles.tt,
          { color: look === 'turned' ? ON_GROUP[hitRank] : look === 'miss' ? pt.bad : pt.ink },
        ]}
        numberOfLines={tileLines(w)}
        adjustsFontSizeToFit>
        {w}
      </Text>
    </View>
  );

  return (
    <View style={styles.wrap} testID="link-board">
      <View style={styles.board}>
        {state.solved.map((i) => {
          const g = state.p.groups[i]!;
          const words = (
            <>
              <Text maxFontSizeMultiplier={1.3} style={[styles.bname, { color: ON_GROUP[g.rank] }]}>
                {g.name.toUpperCase()}
              </Text>
              <Text
                maxFontSizeMultiplier={1.3}
                style={[styles.bmem, { color: ON_GROUP[g.rank] }]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {g.members.join(' · ')}
              </Text>
            </>
          );
          const style = [styles.band, { backgroundColor: GROUP[g.rank] }];
          const a11y = {
            accessible: true,
            accessibilityLabel: `${g.name}: ${g.members.join(', ')}`,
            testID: `band-${g.rank}`,
          };
          return motion && landed === i ? (
            <View key={g.rank} style={styles.bandSlot} {...a11y}>
              <Landing style={style}>{words}</Landing>
            </View>
          ) : (
            <View key={g.rank} style={style} {...a11y}>
              {words}
            </View>
          );
        })}
        {rows.map((row, r) => (
          <View key={r} style={styles.row} onLayout={r === 0 ? measure : undefined}>
            {row.map((w, c) => {
              const sel = state.sel.includes(w);
              const turned = !!hit && hit.tiles.includes(w);
              const missed = !!miss && miss.tiles.includes(w);
              const look = turned ? 'turned' : sel ? 'sel' : 'plain';
              let body = face(w, look);
              if (motion && turned)
                body = (
                  <SettleTile
                    k={hit.tiles.indexOf(w)}
                    rise={r * (geo.h + 7)}
                    shift={(1.5 - c) * (tileW + 8)}
                    plain={face(w, 'sel')}
                    turned={face(w, 'turned')}
                  />
                );
              else if (motion && missed)
                body = <Wobble key={`m${miss.n}`}>{(red) => face(w, red ? 'miss' : look)}</Wobble>;
              return (
                <Pressable
                  key={w}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={w}
                  testID={`tile-${w}`}
                  onPress={() => dispatch({ t: 'tile', w })}
                  style={[styles.tile, turned && styles.lift]}>
                  {body}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View
        style={styles.lives}
        accessibilityLabel={`${MAX_MISTAKES - state.mistakes} mistakes left`}>
        <Text maxFontSizeMultiplier={1.3} style={[styles.livesText, { color: pt.inkSoft }]}>
          MISTAKES LEFT
        </Text>
        {Array.from({ length: MAX_MISTAKES }, (_, i) =>
          motion && miss && miss.pip === i ? (
            <LostPip key={`p${miss.n}`} style={styles.pip} red={pt.bad} ring={pt.lineSoft} />
          ) : (
            <View
              key={i}
              testID={i < state.mistakes ? 'pip-gone' : 'pip'}
              style={[
                styles.pip,
                i < state.mistakes
                  ? { borderColor: pt.lineSoft, borderWidth: 1.5 }
                  : { backgroundColor: pt.ink },
              ]}
            />
          ),
        )}
      </View>
      <Text
        maxFontSizeMultiplier={1.3}
        style={[
          styles.msg,
          { color: state.msg.tone === 'bad' ? pt.bad : pt.inkSoft },
          state.msg.tone === 'bad' && styles.msgBad,
        ]}
        testID="link-msg">
        {state.msg.tone === 'bad' ? state.msg.text.toUpperCase() : state.msg.text}
      </Text>
      <View style={styles.controls}>
        {(
          [
            ['shuffle', 'Shuffle', off.shuffle],
            ['deselect', 'Deselect', off.clear],
            ['submit', 'Submit', off.submit],
          ] as const
        ).map(([t, label, dis]) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityState={{ disabled: dis }}
            disabled={dis}
            onPress={() => dispatch({ t })}
            style={[
              styles.btn,
              { borderColor: pt.lineSoft, backgroundColor: pt.card },
              t === 'submit' && !dis && { backgroundColor: pt.brand, borderColor: pt.brand },
            ]}>
            <Text
              maxFontSizeMultiplier={1.3}
              style={[
                styles.btnText,
                { color: dis ? pt.inkSoft : t === 'submit' ? '#FFFFFF' : pt.ink },
              ]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  board: { flex: 1, gap: 7 },
  row: { flexDirection: 'row', gap: 8, flex: 1, maxHeight: 96 },
  tile: { flex: 1, minHeight: 56 },
  face: {
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  lift: { zIndex: 2 },
  bandSlot: { flex: 1, maxHeight: 96, minHeight: 56 },
  tt: { fontSize: 15, fontFamily: FONT.display, textAlign: 'center', letterSpacing: 0.3 },
  band: {
    flex: 1,
    maxHeight: 96,
    minHeight: 56,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  bname: { fontSize: 11, fontFamily: FONT.display, letterSpacing: 1.5, opacity: 0.8 },
  bmem: { fontSize: 17, fontFamily: FONT.display, marginTop: 4 },
  lives: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 14,
  },
  livesText: { fontFamily: FONT.sans, fontSize: 10, letterSpacing: 1.6, marginRight: 4 },
  pip: { width: 9, height: 9, borderRadius: 5 },
  msg: { minHeight: 20, textAlign: 'center', marginTop: 10, fontFamily: FONT.sans, fontSize: 13 },
  msgBad: { fontFamily: FONT.display, letterSpacing: 1.2 },
  controls: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 14, fontFamily: FONT.sansSemi },
});
