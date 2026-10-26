import { act, fireEvent } from '@testing-library/react-native';

/**
 * A finger down on a Pressable and up again, through its responder (Pressability) as a real
 * touch goes, so its `pressed` style can be seen between the two.
 */
type Target = Parameters<typeof fireEvent>[0];
const touch = () => ({
  nativeEvent: {
    timestamp: Date.now(),
    touches: [],
    changedTouches: [],
    identifier: 0,
    locationX: 1,
    locationY: 1,
    pageX: 1,
    pageY: 1,
  },
  persist: () => undefined,
  currentTarget: { measure: () => undefined },
});
export async function hold(el: Target) {
  await fireEvent(el, 'responderGrant', touch());
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
}
export async function release(el: Target) {
  await fireEvent(el, 'responderRelease', touch());
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
}
/** The finger taken away without a tap (the touch is cancelled): nothing is pressed. */
export async function cancel(el: Target) {
  await fireEvent(el, 'responderTerminate', touch());
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
}
