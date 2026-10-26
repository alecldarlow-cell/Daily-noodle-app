#!/usr/bin/env node
/**
 * Draws the app's icons and splash from the in-app "DP" monogram (src/shared/ui/Screen's
 * masthead: Archivo ExtraBold capitals, white on the house green, as the site's front-page
 * .mono): the letters' outlines are read straight from assets/fonts/Archivo-ExtraBold.ttf
 * and filled with a small anti-aliased rasteriser, and the PNGs written with Node's zlib.
 * No dependencies, so it runs anywhere Node does:
 *
 *   node scripts/make-icons.js          writes the PNGs into assets/images
 *
 * What it makes (app.json points at each):
 * - icon.png             1024 opaque square, DP on green (iOS rounds it; it must be opaque).
 * - play-store-icon.png  512 opaque square, the same (the Play listing's icon).
 * - android-icon-foreground.png / -monochrome.png  1024, DP alone on a clear layer, 40% of
 *   the canvas wide, well inside the adaptive icon's 66/108 safe circle; app.json gives the
 *   green as its background colour.
 * - splash-icon.png / splash-icon-dark.png  the masthead's monogram itself: a rounded green
 *   square (radius 4/30, as the masthead's) with white DP; in dark mode the dark theme's
 *   brighter green with dark letters, as the masthead draws it there.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const FONT = path.join(ROOT, 'assets/fonts/Archivo-ExtraBold.ttf');

/** The house green and the masthead's letter colours (src/shared/theme/tokens.ts accent). */
const GREEN = '#0E7A4B';
const GREEN_DARK = '#4CC793';
const WHITE = '#FFFFFF';
const INK_DARK = '#0B0D12';
/** The masthead's "DP": 17 pt with -1 pt between letters, so -1/17 em. */
const TRACKING = -1 / 17;

// ---------- the font: just enough TrueType to read two simple glyphs ----------

function readFont(file) {
  const b = fs.readFileSync(file);
  const tables = {};
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const at = 12 + i * 16;
    tables[b.toString('latin1', at, at + 4)] = b.readUInt32BE(at + 8);
  }
  const head = tables.head;
  const unitsPerEm = b.readUInt16BE(head + 18);
  const longLoca = b.readInt16BE(head + 50) === 1;
  const numberOfHMetrics = b.readUInt16BE(tables.hhea + 34);

  // cmap: the Windows Unicode BMP subtable (format 4).
  const cmap = tables.cmap;
  let sub = -1;
  for (let i = 0; i < b.readUInt16BE(cmap + 2); i++) {
    const rec = cmap + 4 + i * 8;
    const pid = b.readUInt16BE(rec);
    const eid = b.readUInt16BE(rec + 2);
    const off = cmap + b.readUInt32BE(rec + 4);
    if (((pid === 3 && eid === 1) || pid === 0) && b.readUInt16BE(off) === 4) sub = off;
  }
  if (sub < 0) throw new Error('No format-4 cmap');
  const segX2 = b.readUInt16BE(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  const glyphId = (code) => {
    for (let s = 0; s < segX2 / 2; s++) {
      const end = b.readUInt16BE(ends + s * 2);
      if (code > end) continue;
      const start = b.readUInt16BE(starts + s * 2);
      if (code < start) return 0;
      const delta = b.readInt16BE(deltas + s * 2);
      const ro = b.readUInt16BE(ranges + s * 2);
      if (ro === 0) return (code + delta) & 0xffff;
      const g = b.readUInt16BE(ranges + s * 2 + ro + (code - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };

  const loca = (g) =>
    longLoca ? b.readUInt32BE(tables.loca + g * 4) : b.readUInt16BE(tables.loca + g * 2) * 2;
  const advance = (g) => b.readUInt16BE(tables.hmtx + Math.min(g, numberOfHMetrics - 1) * 4);

  /** A glyph's contours as lists of {x, y, on} points, in font units (y up). */
  const contours = (g) => {
    const at = tables.glyf + loca(g);
    const n = b.readInt16BE(at);
    if (n < 0) throw new Error('Composite glyphs are not supported');
    const endPts = [];
    for (let i = 0; i < n; i++) endPts.push(b.readUInt16BE(at + 10 + i * 2));
    const count = endPts[n - 1] + 1;
    let p = at + 10 + n * 2;
    p += 2 + b.readUInt16BE(p);
    const flags = [];
    while (flags.length < count) {
      const f = b[p++];
      flags.push(f);
      if (f & 8) for (let r = b[p++]; r > 0; r--) flags.push(f);
    }
    const coords = (short, same) => {
      const out = [];
      let v = 0;
      for (const f of flags) {
        if (f & short) {
          const d = b[p++];
          v += f & same ? d : -d;
        } else if (!(f & same)) {
          v += b.readInt16BE(p);
          p += 2;
        }
        out.push(v);
      }
      return out;
    };
    const xs = coords(2, 16);
    const ys = coords(4, 32);
    const out = [];
    let from = 0;
    for (const end of endPts) {
      const c = [];
      for (let i = from; i <= end; i++) c.push({ x: xs[i], y: ys[i], on: !!(flags[i] & 1) });
      out.push(c);
      from = end + 1;
    }
    return out;
  };

  return { unitsPerEm, glyphId, advance, contours };
}

/** A contour's quadratic spline flattened to a closed polygon, `steps` lines per curve. */
function flatten(contour, steps = 24) {
  const pts = contour.slice();
  // Start on an on-curve point (or the midpoint of two off-curve ones).
  let s = pts.findIndex((q) => q.on);
  if (s < 0) {
    pts.unshift({ x: (pts[0].x + pts.at(-1).x) / 2, y: (pts[0].y + pts.at(-1).y) / 2, on: true });
    s = 0;
  }
  const ring = pts.slice(s).concat(pts.slice(0, s));
  const out = [[ring[0].x, ring[0].y]];
  let prev = ring[0];
  for (let i = 1; i <= ring.length; i++) {
    const cur = ring[i % ring.length];
    if (cur.on) {
      out.push([cur.x, cur.y]);
      prev = cur;
      continue;
    }
    const next = ring[(i + 1) % ring.length];
    const end = next.on ? next : { x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2, on: true };
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const a = (1 - t) * (1 - t);
      const m = 2 * (1 - t) * t;
      const e = t * t;
      out.push([a * prev.x + m * cur.x + e * end.x, a * prev.y + m * cur.y + e * end.y]);
    }
    prev = end;
    if (next.on) i++;
  }
  return out;
}

/** "DP" as polygons in em units (x right, y down, baseline at 0), and its ink box. */
function monogram(font) {
  const polys = [];
  let x = 0;
  for (const ch of 'DP') {
    const g = font.glyphId(ch.charCodeAt(0));
    for (const c of font.contours(g))
      polys.push(flatten(c).map(([px, py]) => [(x + px) / font.unitsPerEm, -py / font.unitsPerEm]));
    x += font.advance(g) + TRACKING * font.unitsPerEm;
  }
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of polys)
    for (const [px, py] of p) {
      x0 = Math.min(x0, px);
      x1 = Math.max(x1, px);
      y0 = Math.min(y0, py);
      y1 = Math.max(y1, py);
    }
  return { polys, box: { x0, y0, x1, y1 } };
}

/** The letters placed `width` pixels wide, centred on (cx, cy). */
function place(mono, width, cx, cy) {
  const { x0, y0, x1, y1 } = mono.box;
  const k = width / (x1 - x0);
  const ox = cx - ((x0 + x1) / 2) * k;
  const oy = cy - ((y0 + y1) / 2) * k;
  return mono.polys.map((p) => p.map(([x, y]) => [ox + x * k, oy + y * k]));
}

/** A rounded rectangle as a polygon. */
function roundRect(x, y, w, h, r, steps = 32) {
  const out = [];
  const corner = (cx, cy, a0) => {
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (k / steps) * (Math.PI / 2);
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return [out];
}

// ---------- the rasteriser: non-zero fill, 4 × 4 samples a pixel ----------

const SS = 4;

/** Coverage (0..1) of `polys` over a `size` square, one value a pixel. */
function cover(polys, size) {
  const cov = new Float32Array(size * size);
  const edges = [];
  for (const p of polys)
    for (let i = 0; i < p.length; i++) {
      const [ax, ay] = p[i];
      const [bx, by] = p[(i + 1) % p.length];
      if (ay !== by) edges.push({ ax, ay, bx, by, dir: by > ay ? 1 : -1 });
    }
  const w = 1 / (SS * SS);
  for (let sy = 0; sy < size * SS; sy++) {
    const y = (sy + 0.5) / SS;
    const hits = [];
    for (const e of edges) {
      const lo = Math.min(e.ay, e.by);
      const hi = Math.max(e.ay, e.by);
      if (y < lo || y >= hi) continue;
      hits.push({ x: e.ax + ((y - e.ay) * (e.bx - e.ax)) / (e.by - e.ay), dir: e.dir });
    }
    hits.sort((a, b) => a.x - b.x);
    const row = Math.floor(sy / SS) * size;
    let wind = 0;
    for (let i = 0; i < hits.length - 1; i++) {
      wind += hits[i].dir;
      if (wind === 0) continue;
      const first = Math.max(0, Math.ceil(hits[i].x * SS - 0.5));
      const last = Math.min(size * SS - 1, Math.ceil(hits[i + 1].x * SS - 0.5) - 1);
      for (let sx = first; sx <= last; sx++) cov[row + Math.floor(sx / SS)] += w;
    }
  }
  return cov;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * A `size` square of RGBA pixels: `layers` painted in order over a clear (or `bg`) canvas,
 * each {polys, colour}.
 */
function paint(size, layers, bg) {
  const px = new Float32Array(size * size * 4);
  if (bg) {
    const [r, g, b] = rgb(bg);
    for (let i = 0; i < size * size; i++) px.set([r, g, b, 1], i * 4);
  }
  for (const { polys, colour } of layers) {
    const cov = cover(polys, size);
    const [r, g, b] = rgb(colour);
    for (let i = 0; i < size * size; i++) {
      const a = Math.min(1, cov[i]);
      if (a <= 0) continue;
      const da = px[i * 4 + 3];
      const oa = a + da * (1 - a);
      for (const [k, c] of [
        [0, r],
        [1, g],
        [2, b],
      ])
        px[i * 4 + k] = (c * a + px[i * 4 + k] * da * (1 - a)) / oa;
      px[i * 4 + 3] = oa;
    }
  }
  return px;
}

// ---------- PNG ----------

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const x of buf) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** 8-bit PNG bytes from float RGBA pixels: RGB (opaque) or RGBA. */
function encodePng(px, size, alpha) {
  const ch = alpha ? 4 : 3;
  const raw = Buffer.alloc((size * ch + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * ch + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      for (let k = 0; k < ch; k++)
        raw[row + 1 + x * ch + k] = Math.round(px[i + k] * (k === 3 ? 255 : 1));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- the set ----------

/** Every icon and splash image, as {file, size, alpha, px}. */
function render() {
  const mono = monogram(readFont(FONT));
  const square = (size, letters) =>
    paint(size, [{ polys: place(mono, size * 0.58, size / 2, size / 2), colour: letters }], GREEN);
  const fg = paint(1024, [{ polys: place(mono, 1024 * 0.4, 512, 512), colour: WHITE }]);
  // The masthead's monogram: a 30 pt square, radius 4, the letters about 80% of its width.
  const splash = (bg, ink) =>
    paint(512, [
      { polys: roundRect(0, 0, 512, 512, (512 * 4) / 30), colour: bg },
      { polys: place(mono, 512 * 0.66, 256, 256), colour: ink },
    ]);
  return [
    { file: 'icon.png', size: 1024, alpha: false, px: square(1024, WHITE) },
    { file: 'play-store-icon.png', size: 512, alpha: false, px: square(512, WHITE) },
    { file: 'android-icon-foreground.png', size: 1024, alpha: true, px: fg },
    { file: 'android-icon-monochrome.png', size: 1024, alpha: true, px: fg },
    { file: 'splash-icon.png', size: 512, alpha: true, px: splash(GREEN, WHITE) },
    { file: 'splash-icon-dark.png', size: 512, alpha: true, px: splash(GREEN_DARK, INK_DARK) },
  ];
}

module.exports = { render, encodePng, readFont, monogram, cover, GREEN, GREEN_DARK };

if (require.main === module) {
  for (const { file, size, alpha, px } of render()) {
    const out = path.join(ROOT, 'assets/images', file);
    fs.writeFileSync(out, encodePng(px, size, alpha));
    console.log(`wrote ${path.relative(ROOT, out)}`);
  }
}
