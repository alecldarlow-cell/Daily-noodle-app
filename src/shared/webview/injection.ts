/**
 * The script the app runs inside a puzzle page before the page's own scripts. It:
 * - sets window.__DN_APP = 2, so the site's tracker records inst 2 (dn-track.js);
 * - writes the player's saves into the page's localStorage (the app is the source of
 *   truth: it has merged every earlier write from every page and from native play);
 * - reports every later write to a puzzle save back to the app;
 * - routes the finish sheet's Share to the phone's share sheet;
 * - forwards the site's `dn:puzzle_end` event (for leagues, WP5).
 * It must stay plain ES5 and end with `true;` (react-native-webview's rule).
 */

/** Puzzle save keys the bridge carries, both ways. Game and board keys are left alone. */
export const BRIDGED_KEY = /^digi-(mini|doku|sweep|path|link|tangle|borders|reckon)-(v1|streak)$/;

export function buildInjection(seed: Record<string, string>): string {
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(seed))
    if (BRIDGED_KEY.test(k) && typeof v === 'string') safe[k] = v;
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
    // Saves only this page had (from before the app knew them) go up to the app.
    try {
      for (var i = 0; i < ls.length; i++) {
        var key = ls.key(i);
        if (KEY.test(key) && !Object.prototype.hasOwnProperty.call(seed, key)) post({ t: 'save', key: key, value: ls.getItem(key), id: pid() });
      }
    } catch (e) {}
    try {
      var proto = Object.getPrototypeOf(ls);
      var set = proto.setItem;
      proto.setItem = function (key, value) {
        var r = set.apply(this, arguments);
        if (this === ls && KEY.test(String(key))) post({ t: 'save', key: String(key), value: String(value), id: pid() });
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
