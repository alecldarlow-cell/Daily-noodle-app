import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { BURST_MS, makePieces, onBurst, type PieceTrack } from './confetti';

interface Burst {
  id: number;
  pieces: PieceTrack[];
}

/** One burst: every piece follows its own track off one native-driven clock. */
function BurstView({
  id,
  pieces,
  onDone,
}: {
  id: number;
  pieces: PieceTrack[];
  onDone: (id: number) => void;
}) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.timing(t, {
      toValue: 1,
      duration: BURST_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    a.start();
    const end = setTimeout(() => onDone(id), BURST_MS + 50);
    return () => {
      a.stop();
      clearTimeout(end);
    };
  }, [t, id, onDone]);
  return (
    <>
      {pieces.map((p, i) => {
        const at = (outputRange: number[]) =>
          t.interpolate({ inputRange: p.input, outputRange, extrapolate: 'clamp' });
        const spin = t.interpolate({
          inputRange: p.input,
          outputRange: p.rotate,
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={i}
            testID="confetti-piece"
            style={[
              styles.piece,
              {
                width: p.w,
                height: p.h,
                backgroundColor: p.color,
                opacity: at(p.opacity),
                transform: [{ translateX: at(p.x) }, { translateY: at(p.y) }, { rotate: spin }],
              },
            ]}
          />
        );
      })}
    </>
  );
}

/**
 * Where confetti is drawn: over every screen, mounted once at the root, so a burst
 * carries on while the board gives way to the finish sheet. Never takes a touch.
 */
export function ConfettiHost() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const next = useRef(0);
  useEffect(
    () =>
      onBurst((n, origin) => {
        const id = next.current++;
        setBursts((b) => [...b, { id, pieces: makePieces(n, origin) }]);
      }),
    [],
  );
  const remove = useCallback((id: number) => setBursts((b) => b.filter((x) => x.id !== id)), []);
  if (!bursts.length) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="confetti">
      {bursts.map((b) => (
        <BurstView key={b.id} id={b.id} pieces={b.pieces} onDone={remove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ piece: { position: 'absolute', left: 0, top: 0 } });
