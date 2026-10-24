#!/usr/bin/env node
// Proves the feature-first boundary rules in eslint.config.js bite: each case lints
// a snippet as if it lived at `file` and expects a boundaries error or not. Run in CI
// (`npm run lint:selftest`); exits 1 if a rule stopped catching what it should.
const { ESLint } = require('eslint');

const CASES = [
  {
    name: 'a feature importing another feature is refused',
    file: 'src/features/today/hooks/useX.ts',
    code: "import { LeaguesScreen } from '@/features/leagues';\nexport const x = LeaguesScreen;\n",
    expectError: true,
  },
  {
    name: 'shared importing a feature is refused',
    file: 'src/shared/ui/X.ts',
    code: "import { TodayScreen } from '@/features/today';\nexport const x = TodayScreen;\n",
    expectError: true,
  },
  {
    name: 'a route reaching inside a feature is refused',
    file: 'src/app/x.tsx',
    code: "import { TodayScreen } from '@/features/today/components/TodayScreen/TodayScreen';\nexport default TodayScreen;\n",
    expectError: true,
  },
  {
    name: 'a feature importing shared and core is allowed',
    file: 'src/features/today/hooks/useY.ts',
    code: "import { londonDay } from '@noodle/core';\nimport { tokensFor } from '@/shared/theme';\nexport const y = [londonDay, tokensFor];\n",
    expectError: false,
  },
  {
    name: 'a route importing a feature index is allowed',
    file: 'src/app/y.tsx',
    code: "export { TodayScreen as default } from '@/features/today';\n",
    expectError: false,
  },
];

const RULES = /^(boundaries\/|no-restricted-imports$)/;

(async () => {
  const eslint = new ESLint();
  let failed = 0;
  for (const c of CASES) {
    const [result] = await eslint.lintText(c.code, { filePath: c.file });
    const hits = result.messages.filter((m) => m.ruleId && RULES.test(m.ruleId));
    const ok = c.expectError ? hits.length > 0 : hits.length === 0;
    if (!ok) failed++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${c.name}${hits.length ? ` (${hits.map((h) => h.ruleId).join(', ')})` : ''}`,
    );
  }
  process.exit(failed ? 1 : 0);
})();
