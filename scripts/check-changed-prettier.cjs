#!/usr/bin/env node
'use strict';

/**
 * Phase 02D-9: enforce formatting only for TypeScript sources touched by a PR.
 * The legacy repository has a large Prettier-only baseline; new changes must
 * not increase it, without mixing unrelated formatting with functional fixes.
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const SHA = /^[a-f0-9]{40}$/i;

function selectChangedTypeScriptFiles(diffOutput) {
  return [...new Set(diffOutput.split('\0').filter(Boolean))].filter(
    (file) =>
      /^(?:src|test|scripts)\/(?:[^\0]+\/)*[^\0/]+\.tsx?$/.test(file) &&
      !file.includes('/node_modules/') &&
      !file.includes('/dist/'),
  );
}

function changedFiles(base, head) {
  if (!SHA.test(base || '') || !SHA.test(head || '')) {
    throw new Error('Expected full 40-character Git base and head commit SHAs.');
  }
  const output = execFileSync(
    'git',
    [
      'diff', '--name-only', '-z', '--diff-filter=ACMR',
      base, head, '--', 'src', 'test', 'scripts',
    ],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );
  return selectChangedTypeScriptFiles(output);
}

function run(argv) {
  const [base, head, mode = '--check'] = argv;
  if (mode !== '--check' && mode !== '--write') {
    throw new Error('Mode must be --check or --write.');
  }
  const files = changedFiles(base, head);
  if (files.length === 0) {
    process.stdout.write('Prettier: no TypeScript source changed.\n');
    return;
  }
  process.stdout.write(`Prettier ${mode}: ${files.length} changed file(s).\n`);
  const cli = path.resolve(__dirname, '../node_modules/prettier/bin/prettier.cjs');
  execFileSync(process.execPath, [cli, mode, '--', ...files], {
    stdio: 'inherit',
    maxBuffer: 16 * 1024 * 1024,
  });
}

if (require.main === module) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Incremental Prettier check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { selectChangedTypeScriptFiles, changedFiles, run };
