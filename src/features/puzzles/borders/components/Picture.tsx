import { createElement, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';

/** What Picture needs of the WebView it holds. */
interface WebHandle {
  injectJavaScript: (js: string) => void;
}

/**
 * The WebView, loaded the first time a picture is drawn rather than when the puzzles
 * feature is imported: every other player (and every test that imports NativePlay)
 * then never loads the native module.
 */
let Web: ComponentType<WebViewProps & { ref?: Ref<WebHandle> }> | null = null;
function webView() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Web ??= (require('react-native-webview') as typeof import('react-native-webview'))
    .WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebHandle> }>;
  return Web;
}

/** How long a redraw may take to say it's done before the page is simply reloaded. */
export const REDRAW_FALLBACK_MS = 1500;

/**
 * A drawing (drawing.ts) in a WebView that takes no touches and goes nowhere: the
 * HTML is the app's own, no page is loaded, and no link can be followed.
 *
 * With `update`, the page loads once and later content is drawn into it by running `update`
 * (#190, review of 27 Nov 2026): Borders' outline used to reload, and flash, for every
 * question. `html` is always the whole page for the current content: it is what loads first,
 * and what reloads if a redraw doesn't report back in time, so the worst case is the old
 * behaviour.
 */
export function Picture({
  html,
  update,
  style,
  label,
  testID,
}: {
  html: string;
  update?: string;
  style?: StyleProp<ViewStyle>;
  label?: string;
  testID?: string;
}) {
  const ref = useRef<WebHandle>(null);
  const [page, setPage] = useState(html);
  const [gen, setGen] = useState(0);
  const shown = useRef(update);
  const sent = useRef(0);
  const acked = useRef(0);

  useEffect(() => {
    if (update === undefined || update === shown.current) return;
    shown.current = update;
    const n = ++sent.current;
    ref.current?.injectJavaScript(
      `try{${update}window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('drawn:${n}')}catch(e){}true;`,
    );
    const t = setTimeout(() => {
      if (acked.current >= n) return;
      setPage(html);
      setGen((g) => g + 1);
    }, REDRAW_FALLBACK_MS);
    return () => clearTimeout(t);
    // `html` changes with `update`; on its own it never needs a redraw.
  }, [update, html]);

  const onMessage = (e: WebViewMessageEvent) => {
    const m = /^drawn:(\d+)$/.exec(e.nativeEvent.data);
    if (m) acked.current = Math.max(acked.current, Number(m[1]));
  };

  const source = update === undefined ? html : page;
  return (
    <View
      style={[styles.box, style]}
      pointerEvents="none"
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      testID={testID}>
      {createElement(webView(), {
        key: gen,
        ref,
        source: { html: source },
        originWhitelist: ['about:*', 'data:*'],
        onShouldStartLoadWithRequest: (r) => /^(about|data):/.test(r.url),
        onMessage,
        scrollEnabled: false,
        javaScriptEnabled: true,
        style: styles.web,
        containerStyle: styles.web,
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
