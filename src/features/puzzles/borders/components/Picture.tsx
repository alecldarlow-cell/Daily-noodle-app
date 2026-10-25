import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

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
      <WebView
        source={{ html }}
        originWhitelist={['about:*', 'data:*']}
        onShouldStartLoadWithRequest={(r) => /^(about|data):/.test(r.url)}
        scrollEnabled={false}
        javaScriptEnabled
        style={styles.web}
        containerStyle={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
