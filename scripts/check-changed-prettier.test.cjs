'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
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

test('checks only PR-side changes when main advances independently', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swim-prettier-git-'));
  const previousCwd = process.cwd();
  const git = (...args) => cp.execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    git('config', 'user.name', 'CI Test');
    git('config', 'user.email', 'ci@example.invalid');
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'legacy.ts'), 'export const old = 1;\n');
    git('add', '.');
    git('commit', '-qm', 'baseline');
    const base = git('rev-parse', 'HEAD');
    git('checkout', '-qb', 'feature');
    fs.writeFileSync(path.join(dir, 'README.md'), 'docs only\n');
    git('add', '.');
    git('commit', '-qm', 'docs update');
    const head = git('rev-parse', 'HEAD');
    git('checkout', '-q', '-b', 'base-updated', base);
    git('rm', '-q', 'src/legacy.ts');
    git('commit', '-qm', 'base-only deletion');
    const advancedBase = git('rev-parse', 'HEAD');
    process.chdir(dir);
    assert.deepEqual(changedFiles(advancedBase, head), []);
    assert.deepEqual(changedFiles(base, head), []);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
