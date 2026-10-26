import { act, type screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

type Host = ReturnType<typeof screen.getByTestId>;

/**
 * Tests only: put a finger on a Pressable and leave it there (the responder grant its
 * host view gets), then read the style it shows while held. Test Renderer only keeps
 * host views, so this is how a test sees a pressed look.
 */
export async function heldStyle(el: Host) {
  const nativeEvent = {
    timestamp: 1,
    touches: [],
    changedTouches: [],
    pageX: 0,
    pageY: 0,
    locationX: 0,
    locationY: 0,
    identifier: 1,
    target: 1,
  };
  const grant = el.props.onResponderGrant as ((e: unknown) => void) | undefined;
  if (!grant) throw new Error('not a Pressable');
  await act(async () => {
    grant({ nativeEvent, persist() {}, currentTarget: { measure: () => undefined } });
  });
  return StyleSheet.flatten(el.props.style as object) as Record<string, unknown>;
}
