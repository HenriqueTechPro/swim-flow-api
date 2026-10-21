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

test('compares merge base to PR head even when base has advanced separately', () => {
  const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const { execFileSync } = require('node:child_process');
  const original = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), 'swim-flow-pr-diff-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    git('config', 'user.email', 'ci@example.invalid');
    git('config', 'user.name', 'CI Test');
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src/legacy.ts'), 'const legacy=1;\n');
    git('add', '.');
    git('commit', '-qm', 'initial');
    const baseBefore = git('rev-parse', 'HEAD');
    git('checkout', '-qb', 'feature');
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'docs/feature.md'), 'feature\n');
    git('add', '.');
    git('commit', '-qm', 'docs only in PR');
    const head = git('rev-parse', 'HEAD');
    git('checkout', '-q', baseBefore);
    git('checkout', '-qb', 'advanced-main');
    writeFileSync(join(dir, 'src/legacy.ts'), 'const legacy=2;\n');
    git('add', '.');
    git('commit', '-qm', 'base only change');
    const advancedBase = git('rev-parse', 'HEAD');
    process.chdir(dir);
    assert.deepEqual(changedFiles(advancedBase, head), []);
  } finally {
    process.chdir(original);
    rmSync(dir, { recursive: true, force: true });
  }
});
