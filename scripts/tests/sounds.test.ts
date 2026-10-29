import { SOUND_FILES } from '../../src/shared/sound/cues';

declare const __dirname: string;
/** The parts of Node's Buffer used here. */
interface Buf {
  length: number;
  readInt16LE(at: number): number;
  readUInt16LE(at: number): number;
  readUInt32LE(at: number): number;
  toString(enc: 'ascii', from: number, to: number): string;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync, readdirSync } = require('fs') as {
  readFileSync: (p: string) => Buf;
  readdirSync: (p: string) => string[];
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CUES, RATE, renderAll } = require('../make-sounds.js') as {
  CUES: Record<string, unknown[]>;
  RATE: number;
  renderAll: () => Record<string, Buf>;
};

const dir = `${__dirname}/../../assets/sounds`;
const samples = (b: Buf) => {
  const out: number[] = [];
  for (let i = 44; i < b.length; i += 2) out.push(b.readInt16LE(i));
  return out;
};

describe('GIVEN the sounds in assets/sounds (AF-013)', () => {
  describe('WHEN make-sounds renders the website’s notes again', () => {
    it('THEN every committed file is what it renders (to within one step of rounding)', () => {
      const files = renderAll();
      expect(readdirSync(dir).sort()).toEqual(Object.keys(files).sort());
      for (const [name, made] of Object.entries(files)) {
        const kept = readFileSync(`${dir}/${name}`);
        expect({ name, size: kept.length }).toEqual({ name, size: made.length });
        const a = samples(kept);
        const b = samples(made);
        const worst = a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i]!)), 0);
        expect({ name, close: worst <= 1 }).toEqual({ name, close: true });
      }
    });
  });

  describe('WHEN the app plays one', () => {
    it('THEN the app knows exactly the cues the script makes', () => {
      expect(Object.keys(SOUND_FILES).sort()).toEqual(Object.keys(CUES).sort());
    });

    it('THEN each is short 16-bit mono PCM at the script’s rate, never clipping', () => {
      for (const name of Object.keys(CUES)) {
        const b = readFileSync(`${dir}/${name}.wav`);
        expect(b.toString('ascii', 0, 4)).toBe('RIFF');
        expect(b.readUInt16LE(20)).toBe(1); // PCM
        expect(b.readUInt16LE(22)).toBe(1); // mono
        expect(b.readUInt32LE(24)).toBe(RATE);
        expect(b.readUInt16LE(34)).toBe(16);
        const secs = (b.length - 44) / 2 / RATE;
        expect(secs).toBeLessThan(1.1);
        expect(Math.max(...samples(b).map(Math.abs))).toBeLessThan(32767);
      }
    });
  });
});
