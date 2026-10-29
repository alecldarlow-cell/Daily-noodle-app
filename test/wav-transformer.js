// Jest only: a required sound file (assets/sounds/<cue>.wav) becomes its cue's name, so
// tests can tell which sound played (Metro gives each a number; jest-expo's own asset
// stub gives every file the same one).
const path = require('path');

module.exports = {
  process(_src, filename) {
    return { code: `module.exports = ${JSON.stringify(path.basename(filename, '.wav'))};` };
  },
};
