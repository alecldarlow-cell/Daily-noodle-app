import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { SITE } from '@/shared/net';
import { appStorage, type CachedStorage } from '@/shared/storage';
import { useTokens } from '@/shared/theme';
import { Note } from '@/shared/ui';

import { buildInjection } from './injection';
import { applyId, parseMessage, seedFrom } from './messages';
import { decide } from './navigation';

interface Props {
  /** The site page's path, e.g. "/privacy.html". */
  path: string;
  testID?: string;
  store?: CachedStorage;
}

/** The live site page for `path`, tagged as opened from the app. */
export function sitePageUrl(path: string): string {
  return `${SITE}${path}?via=app`;
}

/**
 * Shows one of the site's own pages (the privacy page) inside the app, with the puzzle
 * pages' bridge: the page is told it's in the app (inst 2) and shares the tracker's
 * visitor code and opt-out with the app, so the privacy page's "Don't record my visits"
 * applies to the app's native puzzles and to the pages it opens. Links follow the
 * puzzle pages' rules: the site's lists go back, a puzzle opens in the app, anything
 * else opens in the phone's browser.
 */
export function SitePageWebView({ path, testID = 'site-webview', store = appStorage }: Props) {
  const t = useTokens();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const injected = useMemo(() => buildInjection(seedFrom(store)), [path, attempt, store]);

  // Only the tracker keys are taken from this page; it writes no puzzle saves.
  const onMessage = (e: WebViewMessageEvent): void => {
    const m = parseMessage(e.nativeEvent.data);
    if (m?.t === 'id') applyId(m.key, m.value, store);
  };

  const onShouldStart = (req: ShouldStartLoadRequest): boolean => {
    if (req.isTopFrame === false) return true;
    const d = decide(req.url, '');
    if (d.kind === 'allow') return true;
    if (d.kind === 'back') router.back();
    else if (d.kind === 'play')
      router.replace({ pathname: '/play/[type]/[file]', params: { type: d.type, file: d.file } });
    else if (d.kind === 'leagues') router.dismissTo({ pathname: '/leagues', params: d.params });
    else void Linking.openURL(req.url);
    return false;
  };

  if (failed) {
    return (
      <View style={[styles.fill, styles.pad, { backgroundColor: t.canvas }]}>
        <Note
          testID={`${testID}-offline`}
          title="Couldn’t open this page"
          body="Check your connection and try again."
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
      key={`${path}#${attempt}`}
      testID={testID}
      style={[styles.fill, { backgroundColor: t.canvas }]}
      source={{ uri: sitePageUrl(path) }}
      injectedJavaScriptBeforeContentLoaded={injected}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={onShouldStart}
      onError={() => setFailed(true)}
      onHttpError={(e) => {
        if (e.nativeEvent.statusCode >= 400) setFailed(true);
      }}
      startInLoadingState
      renderLoading={() => <ActivityIndicator style={styles.loading} color={t.muted} />}
      javaScriptEnabled
      domStorageEnabled
      forceDarkOn={false}
      setSupportMultipleWindows={false}
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
