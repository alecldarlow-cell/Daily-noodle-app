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
const icons = require('../make-icons') as { GREEN: string; GREEN_DARK: string };
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

describe('GIVEN the brand mark', () => {
  it('THEN the icons’ greens are the app’s own accent, light and dark', () => {
    expect(icons.GREEN).toBe(GREEN);
    expect(icons.GREEN_DARK).toBe(tokensFor('dark').accent);
  });
});

describe('GIVEN the app icon', () => {
  describe('WHEN Android draws it as an adaptive icon', () => {
    it('THEN the letters sit on a clear layer over the house green, with a themed-icon version', () => {
      const a = appJson.expo.android.adaptiveIcon;
      expect(a.backgroundColor).toBe(GREEN);
      for (const f of [a.foregroundImage, a.monochromeImage])
        expect(png(f)).toEqual({ w: 1024, h: 1024, colour: 6 });
    });

    it('THEN every letter pixel is inside the 66/108 safe circle, so no launcher mask clips it', () => {
      const p = pixels(appJson.expo.android.adaptiveIcon.foregroundImage);
      expect(p.at(0, 0)[3]).toBe(0);
      const box = inkBox(p, (_r, _g, _b, a) => a > 0);
      const r = (1024 * 33) / 108;
      for (const [x, y] of [
        [box.x0, box.y0],
        [box.x1, box.y0],
        [box.x0, box.y1],
        [box.x1, box.y1],
      ])
        expect(Math.hypot(x! - 512, y! - 512)).toBeLessThan(r);
      // The letters are a real size, not a speck: about 40% of the canvas wide.
      expect(box.x1 - box.x0).toBeGreaterThan(1024 * 0.38);
      // White letters on the clear layer (the D's stem, at mid height).
      expect(hex(p.at(box.x0 + 8, Math.round((box.y0 + box.y1) / 2)))).toBe('#FFFFFF');
    });
  });

  describe('WHEN iOS and the Play listing use it', () => {
    it('THEN iOS gets an opaque 1024 square and Play a 512 one', () => {
      expect(appJson.expo.icon).toBe('./assets/images/icon.png');
      expect(png('assets/images/icon.png')).toEqual({ w: 1024, h: 1024, colour: 2 });
      expect(png('assets/images/play-store-icon.png')).toEqual({ w: 512, h: 512, colour: 2 });
    });

    it('THEN they are white DP on the green, with no trace of the old blue', () => {
      for (const f of ['assets/images/icon.png', 'assets/images/play-store-icon.png']) {
        const p = pixels(f);
        expect(hex(p.at(0, 0))).toBe(GREEN);
        expect(hex(p.at(p.w - 1, p.h - 1))).toBe(GREEN);
        const green = isColour(GREEN);
        const box = inkBox(p, (r, g, b, a) => !green(r, g, b, a));
        // DP is wider than tall, centred, and white at its heart (the D's stem).
        expect(box.x1 - box.x0).toBeGreaterThan((box.y1 - box.y0) * 1.5);
        expect(Math.abs((box.x0 + box.x1) / 2 - p.w / 2)).toBeLessThan(2);
        expect(hex(p.at(box.x0 + 8, Math.round((box.y0 + box.y1) / 2)))).toBe('#FFFFFF');
        const blue = inkBox(p, isColour('#1C46C2'));
        expect(blue.x1).toBe(-1);
      }
    });
  });
});

describe('GIVEN the splash', () => {
  it('THEN light and dark each show the masthead’s monogram in that theme’s green', () => {
    const entry = appJson.expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === 'expo-splash-screen',
    ) as [string, { image: string; dark: { image: string } }];
    const s = entry[1];
    const light = pixels(s.image);
    const dark = pixels(s.dark.image);
    expect(light.at(0, 0)[3]).toBe(0); // the rounded corner is clear
    expect(hex(light.at(256, 40))).toBe(GREEN);
    expect(hex(dark.at(256, 40))).toBe(tokensFor('dark').accent);
    // Light: white letters; dark: the dark theme's ink on its brighter green (onAccent).
    const lb = inkBox(light, isColour('#FFFFFF'));
    expect(lb.x1 - lb.x0).toBeGreaterThan(256);
    const db = inkBox(dark, isColour(tokensFor('dark').onAccent));
    expect(db.x1 - db.x0).toBeGreaterThan(256);
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
