/**
 * Cryptic, native (Lab trial, from 21 Nov 2026; Alec, 20 Nov: Redact retired, Cryptic in its
 * slot). On since 20 Nov 2026: `node scripts/replay.js --type cryptic --all` was identical to
 * engines/cryptic.js on all 29 pages (145 runs, 1,290 moves).
 */
export const enabled = true;

export { CrypticScreen } from './components/CrypticScreen';
export { validate, init, apply, type CrypticData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
