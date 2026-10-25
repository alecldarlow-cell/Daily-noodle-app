import { createElement, type ComponentType } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { WebViewProps } from 'react-native-webview';

/**
 * The WebView, loaded the first time a picture is drawn rather than when the puzzles
 * feature is imported: every other player (and every test that imports NativePlay)
 * then never loads the native module.
 */
let Web: ComponentType<WebViewProps> | null = null;
function webView(): ComponentType<WebViewProps> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Web ??= (require('react-native-webview') as typeof import('react-native-webview')).WebView;
  return Web;
}

/**
 * A drawing (drawing.ts) in a WebView that takes no touches and goes nowhere: the
 * HTML is the app's own, no page is loaded, and no link can be followed.
 */
export function Picture({
  html,
  style,
  label,
  testID,
}: {
  html: string;
  style?: StyleProp<ViewStyle>;
  label?: string;
  testID?: string;
}) {
  return (
    <View
      style={[styles.box, style]}
      pointerEvents="none"
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      testID={testID}>
      {createElement(webView(), {
        source: { html },
        originWhitelist: ['about:*', 'data:*'],
        onShouldStartLoadWithRequest: (r) => /^(about|data):/.test(r.url),
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
