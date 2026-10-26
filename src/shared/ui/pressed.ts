import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';

/** How a control looks while a finger is on it: dimmed, as the site's :active fill reads. */
export const PRESSED: ViewStyle = { opacity: 0.7 };

/**
 * A Pressable's `style` that adds the pressed look while it is held (`PRESSED`, or the
 * caller's own), so every button in the players answers a tap the same way.
 *
 *   <Pressable style={pressable([styles.btn, { borderColor }])} … />
 */
export function pressable(
  base: StyleProp<ViewStyle>,
  pressed: StyleProp<ViewStyle> = PRESSED,
): (state: PressableStateCallbackType) => StyleProp<ViewStyle> {
  return ({ pressed: on }) => (on ? [base, pressed] : base);
}
