/**
 * Sweep, native. `enabled` turns it on in the play route. On since 25 Oct 2026:
 * `node scripts/replay.js --type sweep --all` passed on every Sweep with data (731
 * pages, 4,386 runs in six variants, 162,973 moves compared, all identical to
 * engines/sweep.js; the 30 older pages without DN_PUZZLE stay on the bridge).
 */
export const enabled = true;

export { SweepScreen } from './components/SweepScreen';
export { validate, init, apply, finish, type SweepData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
