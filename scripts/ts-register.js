/**
 * Lets Node scripts require the app's TypeScript (pure modules only: models, oracles,
 * @noodle/core) without a build step or a new dependency: each .ts file is
 * transpiled with the repo's own `typescript` as it is loaded, and the path aliases
 * from tsconfig.json (@/…, @noodle/core) are resolved here.
 */
const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const ALIASES = [
  [/^@noodle\/core$/, () => path.join(ROOT, 'packages/core/src/index.ts')],
  [/^@\/(.*)$/, (m) => path.join(ROOT, 'src', m[1])],
];

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  for (const [re, to] of ALIASES) {
    const m = re.exec(request);
    if (m) return resolve.call(this, to(m), parent, ...rest);
  }
  return resolve.call(this, request, parent, ...rest);
};

require.extensions['.ts'] = (mod, filename) => {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      sourceMap: false,
    },
  });
  mod._compile(out.outputText, filename);
};
