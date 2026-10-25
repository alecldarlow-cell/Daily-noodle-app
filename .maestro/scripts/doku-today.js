// Maestro runScript (WP11): today's Doku, from the site's own files, as the moves the flow
// makes: for every open square in reading order, its cell's testID and its letter.
/* global http, json, output */
const SITE = 'https://dailynoodle.co.uk/';
const list = json(http.get(SITE + 'puzzles-today.json').body);
const item = list.items.filter(function (it) {
  return it.type === 'doku';
})[0];
const file = json(http.get(SITE + item.path.replace(/\.html$/, '.json')).body);
const d = file.data;
const lock = {};
d.locked.forEach(function (x) {
  lock[x[0] - 1 + ',' + (x[1] - 1)] = true;
});
const cells = [];
const letters = [];
for (let r = 0; r < 5; r++)
  for (let c = 0; c < 5; c++)
    if (d.grid[r][c] !== '#' && !lock[r + ',' + c]) {
      cells.push('cell-' + r + '-' + c);
      letters.push(String(d.grid[r][c]).toLowerCase());
    }
output.cells = cells;
output.letters = letters;
output.n = cells.length;
output.i = 0;
