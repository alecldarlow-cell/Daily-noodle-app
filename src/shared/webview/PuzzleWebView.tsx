import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Share, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewHttpErrorEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';
import { useTokens } from '@/shared/theme';
import { announceFinish } from '@/shared/results';
import { Note } from '@/shared/ui';

import { buildInjection } from './injection';
import { applySave, parseMessage, seedFrom } from './messages';
import { decide, pageUrl, typeOfFile } from './navigation';

interface Props {
  /** The puzzle page's file name without folder or extension. */
  file: string;
  /** The site's `dn:puzzle_end` detail when the puzzle finishes (leagues use it, WP5). */
  onEnd?: (detail: Record<string, unknown>, file: string) => void;
  store?: CachedStorage;
  saves?: typeof appSaves;
}

/**
 * Plays a puzzle through its live page on dailynoodle.co.uk. The page keeps working
 * exactly as on the web; the injected script carries saves both ways, sends Share to
 * the phone's share sheet and reports the finish. Links back to the site's lists
 * return to the app; a Next link opens that puzzle in the app.
 */
export function PuzzleWebView({ file, onEnd, store = appStorage, saves = appSaves }: Props) {
  const t = useTokens();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Seed once per page load; later writes flow back through messages.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const injected = useMemo(() => buildInjection(seedFrom(store)), [file, attempt, store]);

  const onMessage = (e: WebViewMessageEvent): void => {
    const m = parseMessage(e.nativeEvent.data);
    if (!m) return;
    if (m.t === 'save') applySave(m.key, m.value, store, saves, m.id || undefined);
    else if (m.t === 'share') void Share.share({ message: m.text });
    else if (m.t === 'end') {
      announceFinish({ path: `reports/${file}.html`, type: typeOfFile(file), detail: m.detail });
      onEnd?.(m.detail, file);
    }
  };

  const onShouldStart = (req: ShouldStartLoadRequest): boolean => {
    if (req.isTopFrame === false) return true;
    const d = decide(req.url, file);
    if (d.kind === 'allow') return true;
    if (d.kind === 'back') router.back();
    else if (d.kind === 'play')
      router.replace({ pathname: '/play/[type]/[file]', params: { type: d.type, file: d.file } });
    else void Linking.openURL(req.url);
    return false;
  };

  const onError = (): void => setFailed(true);
  const onHttpError = (e: WebViewHttpErrorEvent): void => {
    if (e.nativeEvent.statusCode >= 400) setFailed(true);
  };

  if (failed) {
    return (
      <View style={[styles.fill, styles.pad, { backgroundColor: t.canvas }]}>
        <Note
          testID="play-offline"
          title="Couldn’t open this puzzle"
          body="Check your connection and try again. Puzzles you’ve opened before also work offline."
          action={{
            label: 'Try again',
            onPress: () => {
              setFailed(false);
              setAttempt((n) => n + 1);
            },
          }}
        />
      </View>
    );
  }

  return (
    <WebView
      key={`${file}#${attempt}`}
      testID="play-webview"
      style={[styles.fill, { backgroundColor: t.canvas }]}
      source={{ uri: pageUrl(file) }}
      injectedJavaScriptBeforeContentLoaded={injected}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={onShouldStart}
      onError={onError}
      onHttpError={onHttpError}
      startInLoadingState
      renderLoading={() => <ActivityIndicator style={styles.loading} color={t.muted} />}
      javaScriptEnabled
      domStorageEnabled
      forceDarkOn={false}
      setSupportMultipleWindows={false}
      allowsBackForwardNavigationGestures={false}
      pullToRefreshEnabled={false}
      overScrollMode="never"
      bounces={false}
      originWhitelist={['https://*']}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pad: { padding: 16 },
  loading: { position: 'absolute', top: '40%', alignSelf: 'center' },
});
