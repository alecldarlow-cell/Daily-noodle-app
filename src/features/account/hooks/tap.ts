/** A value that differs on every tap, so asking Leagues for the same place twice still goes there. */
let taps = 0;
export function tapId(): string {
  taps += 1;
  return `${Date.now().toString(36)}.${taps}`;
}
