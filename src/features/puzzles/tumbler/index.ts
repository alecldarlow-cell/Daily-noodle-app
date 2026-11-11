/**
 * Tumbler, native (Lab trial, 11 Nov 2026). On since 11 Nov 2026:
 * `node scripts/replay.js --type tumbler --all` was identical to engines/tumbler.js on all
 * 63 pages (252 runs, 5,647 moves).
 */
export const enabled = true;

export { TumblerScreen } from './components/TumblerScreen';
export { validate, init, apply, type TumblerData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
