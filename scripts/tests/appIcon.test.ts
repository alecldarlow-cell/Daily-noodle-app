import appJson from '../../app.json';
import { tokensFor } from '../../src/shared/theme/tokens';

declare const __dirname: string;
declare const process: { execPath: string };
/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require('fs') as { readFileSync: (p: string) => Uint8Array };
const { inflateSync } = require('zlib') as { inflateSync: (b: Uint8Array) => Uint8Array };
const { execFileSync } = require('child_process') as {
  execFileSync: (cmd: string, args: string[], o: { encoding: 'utf8' }) => string;
};
const icons = require('../make-icons') as {
  GREEN: string;
  TILE_TOP: string;
  TILE_BOTTOM: string;
  MARIGOLD: string;
};
/* eslint-enable @typescript-eslint/no-require-imports */

const read = (rel: string) => readFileSync(`${__dirname}/../../${rel.replace(/^\.\//, '')}`);

/** A PNG's size and colour type, from its IHDR chunk (2: RGB, 6: RGB with alpha). */
function png(rel: string) {
  const b = read(rel);
  expect(String.fromCharCode(...b.subarray(1, 4))).toBe('PNG');
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { w: v.getUint32(16), h: v.getUint32(20), colour: b[25] };
}

/** A PNG's pixels as RGBA bytes (8-bit, unfiltered rows, as make-icons.js writes them). */
function pixels(rel: string) {
  const b = read(rel);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const { w, h, colour } = png(rel);
  const parts: Uint8Array[] = [];
  for (let at = 8; at < b.length; ) {
    const len = v.getUint32(at);
    const type = String.fromCharCode(...b.subarray(at + 4, at + 8));
    if (type === 'IDAT') parts.push(b.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  const raw = inflateSync(all);
  const ch = colour === 6 ? 4 : 3;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = y * (w * ch + 1);
    if (raw[row] !== 0) throw new Error(`${rel}: row ${y} is filtered`);
    for (let x = 0; x < w; x++)
      for (let k = 0; k < 4; k++)
        out[(y * w + x) * 4 + k] = k < ch ? raw[row + 1 + x * ch + k]! : 255;
  }
  const at = (x: number, y: number) =>
    Array.from(out.subarray((y * w + x) * 4, (y * w + x) * 4 + 4));
  return { w, h, out, at };
}

const hex = ([r, g, b]: number[]) =>
  '#' + [r, g, b].map((n) => n!.toString(16).padStart(2, '0').toUpperCase()).join('');

/** The box round every pixel that `isInk` picks (given its red, green, blue and alpha). */
function inkBox(
  p: ReturnType<typeof pixels>,
  isInk: (r: number, g: number, b: number, a: number) => boolean,
) {
  let [x0, y0, x1, y1] = [p.w, p.h, -1, -1];
  const o = p.out;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const i = (y * p.w + x) * 4;
      if (!isInk(o[i]!, o[i + 1]!, o[i + 2]!, o[i + 3]!)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return { x0, y0, x1, y1 };
}

const rgbOf = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const isColour = (h: string) => {
  const [R, G, B] = rgbOf(h);
  return (r: number, g: number, b: number, a: number) => a > 0 && r === R && g === G && b === B;
};

const GREEN = tokensFor('light').accent;

/** Channel-by-channel closeness of two colours. */
const near = (a: string, b: string, tol: number) => {
  const [x, y] = [rgbOf(a), rgbOf(b)];
  return x.every((v, i) => Math.abs(v - y[i]!) <= tol);
};
/** Bright pixels: the white noodle and the marigold dot (red at full), never the greens. */
const isMark = (r: number, _g: number, _b: number, a: number) => a > 0 && r > 200;
const isWhite = isColour('#FFFFFF');

describe('GIVEN the brand mark (the noodle n)', () => {
  it('THEN its greens centre on the app’s own accent, and the dot is the play marigold', () => {
    expect(icons.GREEN).toBe(GREEN);
    // The tile's glow runs either side of the house green: its midpoint is the accent.
    const [t, b] = [rgbOf(icons.TILE_TOP), rgbOf(icons.TILE_BOTTOM)];
    const mid =
      '#' +
      t
        .map((v, i) =>
          Math.round((v + b[i]!) / 2)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    expect(near(mid, GREEN, 2)).toBe(true);
    expect(icons.MARIGOLD).toBe(tokensFor('light').play);
  });
});

describe('GIVEN the app icon', () => {
  describe('WHEN Android draws it as an adaptive icon', () => {
    it('THEN the mark sits on a clear layer over the green glow, with a themed-icon version', () => {
      const a = appJson.expo.android.adaptiveIcon;
      expect(a.backgroundColor).toBe(GREEN);
      expect(png(a.backgroundImage)).toEqual({ w: 1024, h: 1024, colour: 2 });
      for (const f of [a.foregroundImage, a.monochromeImage])
        expect(png(f)).toEqual({ w: 1024, h: 1024, colour: 6 });
      // The background glows from TILE_TOP to TILE_BOTTOM across the visible 72 dp.
      const bg = pixels(a.backgroundImage);
      expect(near(hex(bg.at(512, 172)), icons.TILE_TOP, 3)).toBe(true);
      expect(near(hex(bg.at(512, 852)), icons.TILE_BOTTOM, 3)).toBe(true);
    });

    it('THEN every mark pixel, shadow included, is inside the 66/108 safe circle with room to spare', () => {
      const r = (1024 * 33) / 108;
      for (const f of [
        appJson.expo.android.adaptiveIcon.foregroundImage,
        appJson.expo.android.adaptiveIcon.monochromeImage,
      ]) {
        const p = pixels(f);
        expect(p.at(0, 0)[3]).toBe(0);
        let far = 0;
        for (let y = 0; y < p.h; y += 2)
          for (let x = 0; x < p.w; x += 2)
            if (p.at(x, y)[3]! > 0) far = Math.max(far, Math.hypot(x - 512, y - 512));
        expect(far).toBeLessThan(r - 20);
        // A real size, not a speck: the noodle is over 40% of the canvas tall.
        const box = inkBox(p, isMark);
        expect(box.y1 - box.y0).toBeGreaterThan(1024 * 0.4);
      }
    });

    it('THEN the themed icon is one colour, and the full one has the marigold dot', () => {
      const mono = pixels(appJson.expo.android.adaptiveIcon.monochromeImage);
      const fg = pixels(appJson.expo.android.adaptiveIcon.foregroundImage);
      expect(inkBox(mono, isColour(icons.MARIGOLD)).x1).toBe(-1);
      expect(inkBox(fg, isColour(icons.MARIGOLD)).x1).toBeGreaterThan(0);
    });
  });

  describe('WHEN iOS and the Play listing use it', () => {
    it('THEN iOS gets an opaque 1024 square and Play a 512 one', () => {
      expect(appJson.expo.icon).toBe('./assets/images/icon.png');
      expect(png('assets/images/icon.png')).toEqual({ w: 1024, h: 1024, colour: 2 });
      expect(png('assets/images/play-store-icon.png')).toEqual({ w: 512, h: 512, colour: 2 });
    });

    it('THEN they are the white noodle and marigold dot on the green glow, centred and 73% tall', () => {
      for (const f of ['assets/images/icon.png', 'assets/images/play-store-icon.png']) {
        const p = pixels(f);
        // The glow: the top corner is TILE_TOP, the bottom corner TILE_BOTTOM.
        expect(near(hex(p.at(0, 0)), icons.TILE_TOP, 3)).toBe(true);
        expect(near(hex(p.at(p.w - 1, p.h - 1)), icons.TILE_BOTTOM, 3)).toBe(true);
        // The mark: centred both ways, 70–76% of the tile tall, taller than it is wide.
        const box = inkBox(p, isMark);
        expect(Math.abs((box.x0 + box.x1) / 2 - p.w / 2)).toBeLessThan(p.w * 0.005);
        expect(Math.abs((box.y0 + box.y1) / 2 - p.h / 2)).toBeLessThan(p.h * 0.005);
        expect((box.y1 - box.y0) / p.h).toBeGreaterThan(0.7);
        expect((box.y1 - box.y0) / p.h).toBeLessThan(0.76);
        expect(box.y1 - box.y0).toBeGreaterThan(box.x1 - box.x0);
        // White noodle: the first stroke at mid height.
        const mid = Math.round((box.y0 + box.y1) / 2);
        const s = p.w / 1024;
        expect(hex(p.at(box.x0 + Math.round(40 * s), mid))).toBe('#FFFFFF');
        // The dot is marigold, and its top is level with the top of the noodle's arch.
        const dot = inkBox(p, isColour(icons.MARIGOLD));
        const white = inkBox(p, isWhite);
        expect(dot.x1).toBeGreaterThan(0);
        expect(Math.abs(dot.y0 - white.y0)).toBeLessThanOrEqual(Math.ceil(3 * s));
        expect(inkBox(p, isColour('#1C46C2')).x1).toBe(-1);
      }
    });
  });
});

describe('GIVEN the splash', () => {
  it('THEN light and dark each show the icon on a rounded tile', () => {
    const entry = appJson.expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === 'expo-splash-screen',
    ) as [string, { image: string; dark: { image: string } }];
    const s = entry[1];
    for (const f of [s.image, s.dark.image]) {
      const p = pixels(f);
      expect(p.at(0, 0)[3]).toBe(0); // the rounded corner is clear
      expect(near(hex(p.at(256, 4)), icons.TILE_TOP, 4)).toBe(true);
      expect(inkBox(p, isWhite).x1).toBeGreaterThan(0);
      expect(inkBox(p, isColour(icons.MARIGOLD)).x1).toBeGreaterThan(0);
      expect(inkBox(p, isMark).y1 - inkBox(p, isMark).y0).toBeGreaterThan(512 * 0.7);
    }
  });
});

describe('GIVEN the masthead mark', () => {
  it('THEN it is the icon’s noodle on a rounded green tile, 120 px for the 30 pt masthead', () => {
    const p = pixels('./assets/images/masthead-mark.png');
    expect(p.at(0, 0)[3]).toBe(0); // the rounded corner is clear
    expect(near(hex(p.at(60, 2)), icons.TILE_TOP, 6)).toBe(true);
    expect(inkBox(p, isWhite).x1).toBeGreaterThan(0);
    expect(inkBox(p, isColour(icons.MARIGOLD)).x1).toBeGreaterThan(0);
  });
});

describe('GIVEN scripts/make-icons.js', () => {
  it('THEN the committed images are exactly what it draws (rerun it after changing the mark)', () => {
    // In plain Node: the rasteriser is far slower under Jest's transform.
    const out = execFileSync(process.execPath, [`${__dirname}/../make-icons.js`, '--check'], {
      encoding: 'utf8',
    });
    expect(out).toContain('icons up to date');
  });
});
