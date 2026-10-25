/**
 * The script the app runs inside a puzzle page before the page's own scripts. It:
 * - sets window.__DN_APP = 2, so the site's tracker records inst 2 (dn-track.js);
 * - writes the player's saves into the page's localStorage (the app is the source of
 *   truth: it has merged every earlier write from every page and from native play);
 * - reports every later write to a puzzle save back to the app;
 * - shares the site tracker's visitor code, session and opt-out (digi.aid, digi.sid,
 *   digi.last, digi.optout) both ways, so the page and the app's native puzzles are one
 *   visitor, and the privacy page's switch applies to both (shared/track);
 * - routes the finish sheet's Share to the phone's share sheet;
 * - forwards the site's `dn:puzzle_end` event (for leagues, WP5).
 * It must stay plain ES5 and end with `true;` (react-native-webview's rule).
 */

/** Puzzle save keys the bridge carries, both ways. Game and board keys are left alone. */
export const BRIDGED_KEY = /^digi-(mini|doku|sweep|path|link|tangle|borders|reckon)-(v1|streak)$/;

/** The site tracker's own keys (dn-track.js), shared both ways. '' in the app means absent. */
export const ID_KEY = /^digi\.(aid|sid|last|optout)$/;

export function buildInjection(seed: Record<string, string>): string {
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(seed))
    if ((BRIDGED_KEY.test(k) || (ID_KEY.test(k) && v !== '')) && typeof v === 'string') safe[k] = v;
  // JSON is valid JS; escape "</" and line separators so it can't end or break the script.
  const literal = JSON.stringify(safe)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `(function () {
  if (window.__DN_BRIDGE) return;
  window.__DN_BRIDGE = 1;
  window.__DN_APP = 2;
  var KEY = ${BRIDGED_KEY.toString()};
  var ID = ${ID_KEY.toString()};
  function post(m) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {}
  }
  // The open puzzle's id, so the app merges an unfinished round the right way.
  function pid() {
    try { return (window.DN_PUZZLE && window.DN_PUZZLE.id) || ''; } catch (e) { return ''; }
  }
  var seed = ${literal};
  var ls = null;
  try { ls = window.localStorage; } catch (e) {}
  if (ls) {
    for (var k in seed) {
      if (Object.prototype.hasOwnProperty.call(seed, k)) {
        try { ls.setItem(k, seed[k]); } catch (e) {}
      }
    }
    // Opted out in the app: no visitor code on the page either (dn-track.js's setOptOut).
    if (seed['digi.optout'] === '1') {
      try { ls.removeItem('digi.aid'); ls.removeItem('digi.aid.prev'); ls.removeItem('digi.sid'); ls.removeItem('digi.last'); } catch (e) {}
    }
    // Saves and tracker keys only this page had (from before the app knew them) go up to the app.
    try {
      for (var i = 0; i < ls.length; i++) {
        var key = ls.key(i);
        if (Object.prototype.hasOwnProperty.call(seed, key)) continue;
        if (KEY.test(key)) post({ t: 'save', key: key, value: ls.getItem(key), id: pid() });
        else if (ID.test(key)) post({ t: 'id', key: key, value: ls.getItem(key) });
      }
    } catch (e) {}
    try {
      var proto = Object.getPrototypeOf(ls);
      var set = proto.setItem, rem = proto.removeItem;
      proto.setItem = function (key, value) {
        var r = set.apply(this, arguments);
        if (this === ls && KEY.test(String(key))) post({ t: 'save', key: String(key), value: String(value), id: pid() });
        else if (this === ls && ID.test(String(key))) post({ t: 'id', key: String(key), value: String(value) });
        return r;
      };
      proto.removeItem = function (key) {
        var r = rem.apply(this, arguments);
        if (this === ls && ID.test(String(key))) post({ t: 'id', key: String(key), value: null });
        return r;
      };
    } catch (e) {}
  }
  try {
    var share = function (data) {
      post({ t: 'share', text: (data && data.text) || '', url: (data && data.url) || '' });
      return Promise.resolve();
    };
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
  } catch (e) {}
  try {
    document.addEventListener('dn:puzzle_end', function (e) { post({ t: 'end', detail: e.detail || {} }); });
  } catch (e) {}
})();
true;`;
}
