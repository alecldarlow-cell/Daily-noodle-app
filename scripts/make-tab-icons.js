#!/usr/bin/env node
/**
 * Writes the tab bar's icons (#199, Alec's pick of 27 Nov 2026: the noodle line), in
 * assets/images/tabs/: today, leagues, archive, account, each at 24, 48 and 72 px (@1x, @2x,
 * @3x). One rule for all four: a single rounded 2-unit line, like the noodle-n, plus one dot.
 *
 *   Today    the noodle-n itself
 *   Leagues  a podium drawn as one line; the dot is the winner on the top step
 *   Archive  a calendar page; the dot is a day you played
 *   Account  the n's arch as shoulders; the dot is the head
 *
 * Drawn white on clear: the tab bar tints them (grey, or the accent when selected). The marigold
 * dot of Option A needs untinted icons, which waits for expo-router 58.0.33's `renderingMode` on
 * Android and so the next store build.
 *
 *   node scripts/make-tab-icons.js          writes the PNGs
 *   node scripts/make-tab-icons.js --check  fails if any PNG differs from what this draws
 */
'use strict';
const fs = require('fs');
const path = require('path');

const { encodePng, decodePng, paint, stroke, circle, clockwise } = require('./make-icons');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'assets/images/tabs');
const LINE = 2;
const WHITE = '#FFFFFF';
const SCALES = [1, 2, 3];
const BASE = 24;

/** Points along an arc (y down), from angle a0 to a1. */
function arc(cx, cy, rx, ry, a0, a1, steps = 24) {
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

/** A rounded rectangle's outline, closed. */
function roundRect(x, y, w, h, r) {
  return [
    ...arc(x + w - r, y + r, r, r, -Math.PI / 2, 0),
    ...arc(x + w - r, y + h - r, r, r, 0, Math.PI / 2),
    ...arc(x + r, y + h - r, r, r, Math.PI / 2, Math.PI),
    ...arc(x + r, y + r, r, r, Math.PI, (3 * Math.PI) / 2),
    [x + w - r, y],
  ];
}

/** The icons in 24-unit space: polylines (each stroked LINE wide, round ends and joins) and dots. */
const ICONS = {
  today: {
    lines: [
      [
        [7, 19],
        [7, 8.5],
        ...arc(9.5, 8.5, 2.5, 2.5, Math.PI, 2 * Math.PI),
        [12, 16.5],
        ...arc(14.5, 16.5, 2.5, 2.5, Math.PI, 0),
        [17, 7],
      ],
    ],
    dots: [[17, 6.6, 1.9]],
  },
  leagues: {
    lines: [
      [
        [3, 20],
        [3, 15],
        [8.5, 15],
        [8.5, 10.5],
        [15.5, 10.5],
        [15.5, 13],
        [21, 13],
        [21, 20],
        [3, 20],
      ],
    ],
    dots: [[12, 5.6, 1.9]],
  },
  archive: {
    lines: [
      roundRect(3.5, 5.5, 17, 15, 3),
      [
        [3.5, 10],
        [20.5, 10],
      ],
      [
        [8, 3.5],
        [8, 7],
      ],
      [
        [16, 3.5],
        [16, 7],
      ],
    ],
    dots: [[15.5, 15.2, 1.9]],
  },
  account: {
    lines: [[[5, 20.5], [5, 19], ...arc(12, 19, 7, 6, Math.PI, 2 * Math.PI), [19, 20.5]]],
    dots: [[12, 8, 3.3]],
  },
};

/** One icon at `px` pixels: every segment its own round-ended stroke, so joins come out round. */
function draw(name, px) {
  const k = px / BASE;
  const at = ([x, y]) => [x * k, y * k];
  const polys = [];
  for (const line of ICONS[name].lines)
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) continue;
      polys.push(clockwise(stroke([at(a), at(b)], LINE * k, 12)));
    }
  for (const [x, y, r] of ICONS[name].dots) polys.push(clockwise(circle(x * k, y * k, r * k)));
  return paint(px, [{ polys, colour: WHITE }]);
}

/** Every file: { file, size, px }. */
function render() {
  const out = [];
  for (const name of Object.keys(ICONS))
    for (const s of SCALES) {
      const size = BASE * s;
      out.push({ file: `${name}${s === 1 ? '' : `@${s}x`}.png`, size, px: draw(name, size) });
    }
  return out;
}

/** The files that differ from what render() draws (by pixel). */
function stale() {
  const bad = [];
  for (const { file, size, px } of render()) {
    const f = path.join(DIR, file);
    const got = fs.existsSync(f) ? decodePng(fs.readFileSync(f)) : null;
    const want = decodePng(encodePng(px, size, true));
    if (!got || got.w !== size || !got.out.equals(want.out)) bad.push(file);
  }
  return bad;
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const bad = stale();
    if (bad.length) {
      console.error(`stale tab icons: ${bad.join(', ')}. Run node scripts/make-tab-icons.js`);
      process.exit(1);
    }
    console.log('tab icons current');
  } else {
    fs.mkdirSync(DIR, { recursive: true });
    for (const { file, size, px } of render())
      fs.writeFileSync(path.join(DIR, file), encodePng(px, size, true));
    console.log(`wrote ${Object.keys(ICONS).length * SCALES.length} tab icons`);
  }
}

module.exports = { ICONS, render, stale, TAB_ICONS: Object.keys(ICONS) };
