import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { SITE } from '@/shared/net';
import { useTokens } from '@/shared/theme';
import { Note } from '@/shared/ui';

import { decide } from './navigation';

interface Props {
  /** The site page's path, e.g. "/privacy.html". */
  path: string;
  testID?: string;
}

/** Tells the site's tracker the page is inside the app (inst 2), as puzzle pages do. */
export const SITE_PAGE_INJECTION = 'window.__DN_APP = 2; true;';

/** The live site page for `path`, tagged as opened from the app. */
export function sitePageUrl(path: string): string {
  return `${SITE}${path}?via=app`;
}

/**
 * Shows one of the site's own pages (the privacy page) inside the app. It runs in the
 * same web storage as the bridged puzzles, so a switch on the page (the privacy page's
 * "Don't record my visits") applies to the puzzle pages the app opens. Links follow the
 * puzzle pages' rules: the site's lists go back, a puzzle opens in the app, anything
 * else opens in the phone's browser.
 */
export function SitePageWebView({ path, testID = 'site-webview' }: Props) {
  const t = useTokens();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const onShouldStart = (req: ShouldStartLoadRequest): boolean => {
    if (req.isTopFrame === false) return true;
    const d = decide(req.url, '');
    if (d.kind === 'allow') return true;
    if (d.kind === 'back') router.back();
    else if (d.kind === 'play')
      router.replace({ pathname: '/play/[type]/[file]', params: { type: d.type, file: d.file } });
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
      injectedJavaScriptBeforeContentLoaded={SITE_PAGE_INJECTION}
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
