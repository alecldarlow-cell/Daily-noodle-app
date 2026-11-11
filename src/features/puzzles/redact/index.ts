/**
 * Redact, native (Lab trial, 11 Nov 2026). On since 11 Nov 2026: `enabled` turns it on in the play route;
 * `node scripts/replay.js --type redact --all` was identical to engines/redact.js on all 63 pages (252 runs).
 */
export const enabled = true;

export { RedactScreen } from './components/RedactScreen';
export { validate, init, apply, type RedactData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
