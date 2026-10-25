import { Stack } from 'expo-router';
import { useMemo, type ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { usePuzzleTokens } from '@/shared/theme';

import { usePuzzleData } from '../api/usePuzzleData';
import { enabled as bordersEnabled } from '../borders';
import { BordersScreen } from '../borders/components/BordersScreen';
import { validate as validateBorders, type BordersData } from '../borders/model';
import { DokuScreen } from '../doku/components/DokuScreen';
import { enabled as dokuEnabled } from '../doku';
import { validate as validateDoku, type DokuData } from '../doku/model';
import { enabled as linkEnabled } from '../link';
import { LinkScreen } from '../link/components/LinkScreen';
import { validate as validateLink, type LinkData } from '../link/model';
import { MiniScreen } from '../mini/components/MiniScreen';
import { enabled as miniEnabled } from '../mini';
import { validate as validateMini, type MiniData } from '../mini/model';
import { enabled as pathEnabled } from '../path';
import { PathScreen } from '../path/components/PathScreen';
import { validate as validatePath, type PathData } from '../path/model';
import { enabled as sweepEnabled } from '../sweep';
import { SweepScreen } from '../sweep/components/SweepScreen';
import { validate as validateSweep, type SweepData } from '../sweep/model';
import { enabled as reckonEnabled } from '../reckon';
import { ReckonScreen } from '../reckon/components/ReckonScreen';
import { validate as validateReckon, type ReckonData } from '../reckon/model';
import { enabled as tangleEnabled } from '../tangle';
import { TangleScreen } from '../tangle/components/TangleScreen';
import { validate as validateTangle, type TangleData } from '../tangle/model';
import type { PuzzleFile } from '../types';

/** Which types have a native player switched on: each once its replay passed on every puzzle. */
export const NATIVE: Record<string, boolean> = {
  mini: miniEnabled,
  link: linkEnabled,
  tangle: tangleEnabled,
  doku: dokuEnabled,
  sweep: sweepEnabled,
  path: pathEnabled,
  reckon: reckonEnabled,
  borders: bordersEnabled,
};

/**
 * Each type's ship gate: would its page play this data to a finish? Tangle's, Reckon's
 * and Borders' also check the page's dn:date against the puzzle's: the data file's date.
 */
const VALIDATE: Record<string, (f: PuzzleFile) => boolean> = {
  mini: (f) => validateMini(f.data).ok,
  link: (f) => validateLink(f.data).ok,
  tangle: (f) => validateTangle(f.data, f.date).ok,
  doku: (f) => validateDoku(f.data).ok,
  sweep: (f) => validateSweep(f.data).ok,
  path: (f) => validatePath(f.data).ok,
  reckon: (f) => validateReckon(f.data, f.date).ok,
  borders: (f) => validateBorders(f.data, f.date).ok,
};

/** Puzzle types with a native player, each on once its replay has passed on every puzzle. */
export function hasNativePlayer(type: unknown): boolean {
  return typeof type === 'string' && NATIVE[type] === true;
}

interface NativePlayProps {
  type: string;
  file: string;
  /** What to show when the puzzle can't play natively: the WebView bridge. */
  fallback: ReactElement;
}

/**
 * A puzzle with a native player: its data from reports/<file>.json (kept for offline),
 * checked by the model's validate, then the native screen. A page without a data file,
 * data the model refuses, or no connection and no kept copy: the bridge instead.
 */
export function NativePlay({ type, file, fallback }: NativePlayProps) {
  const pt = usePuzzleTokens();
  const q = usePuzzleData(file);
  const data = q.data;
  // Sweep's gate counts every mine placement (~50 ms): check each file once.
  const ok = useMemo(
    () => !!data && data.type === type && Object.hasOwn(VALIDATE, type) && VALIDATE[type]!(data),
    [data, type],
  );
  if (!data && q.isPending)
    return (
      <View style={[styles.fill, { backgroundColor: pt.paper }]} testID="native-loading">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator style={styles.spin} color={pt.inkSoft} />
      </View>
    );
  if (!ok || !data) return fallback;
  const screen =
    type === 'mini' ? (
      <MiniScreen key={file} file={data as PuzzleFile<MiniData>} />
    ) : type === 'link' ? (
      <LinkScreen key={file} file={data as PuzzleFile<LinkData>} />
    ) : type === 'tangle' ? (
      <TangleScreen key={file} file={data as PuzzleFile<TangleData>} />
    ) : type === 'doku' ? (
      <DokuScreen key={file} file={data as PuzzleFile<DokuData>} />
    ) : type === 'sweep' ? (
      <SweepScreen key={file} file={data as PuzzleFile<SweepData>} />
    ) : type === 'path' ? (
      <PathScreen key={file} file={data as PuzzleFile<PathData>} />
    ) : type === 'reckon' ? (
      <ReckonScreen key={file} file={data as PuzzleFile<ReckonData>} />
    ) : (
      <BordersScreen key={file} file={data as PuzzleFile<BordersData>} />
    );
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {screen}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  spin: { marginTop: 120 },
});
