'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  selectChangedTypeScriptFiles,
  changedFiles,
  run,
} = require('./check-changed-prettier.cjs');

test('selects modified TypeScript under src, test, scripts only', () => {
  assert.deepEqual(
    selectChangedTypeScriptFiles(
      [
        'src/domain/students/application/use-cases/create-student.ts',
        'test/attendance.e2e-spec.ts',
        'scripts/seed-smoke.ts',
        'src/components/Example.tsx',
        'src/domain/students/application/use-cases/create-student.ts',
        'docs/DEPLOY.md',
        'prisma/schema.prisma',
        'node_modules/hidden.ts',
        'dist/main.ts',
        '.github/workflows/api-ci.yml',
        '',
      ].join('\0'),
    ),
    [
      'src/domain/students/application/use-cases/create-student.ts',
      'test/attendance.e2e-spec.ts',
      'scripts/seed-smoke.ts',
      'src/components/Example.tsx',
    ],
  );
});

test('handles filenames with spaces and repeated names without shell expansion', () => {
  assert.deepEqual(
    selectChangedTypeScriptFiles(
      'src/domain/my module/use-case.ts\0src/domain/my module/use-case.ts\0',
    ),
    ['src/domain/my module/use-case.ts'],
  );
});

test('rejects missing, abbreviated or injected Git refs before executing commands', () => {
  assert.throws(() => changedFiles('HEAD', 'a'.repeat(40)), /40-character/);
  assert.throws(
    () => changedFiles('a'.repeat(40) + ';touch bad', 'b'.repeat(40)),
    /40-character/,
  );
  assert.throws(() => run(['a'.repeat(40), 'b'.repeat(40), '--fix-all']), /Mode/);
});

test('skips non-code paths without requiring a formatter invocation', () => {
  assert.deepEqual(selectChangedTypeScriptFiles('docs/review.md\0README.md\0'), []);
});
