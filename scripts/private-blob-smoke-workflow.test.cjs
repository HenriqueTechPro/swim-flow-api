'use strict';
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github/workflows/private-blob-smoke.yml'),
  'utf8',
);
test('no automatic, PR, release, schedule or deployment trigger', () => {
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  for (const forbidden of ['pull_request:', 'push:', 'schedule:',
    'workflow_call:', 'repository_dispatch:', 'deployment_status:']) {
    assert.equal(workflow.includes(forbidden), false);
  }
});
test('requires exact approval, main branch, GitHub Environment and separate secret', () => {
  assert.match(workflow, /refs\/heads\/main/);
  assert.match(workflow, /I_APPROVE_DISPOSABLE_PRIVATE_BLOB_SMOKE_ONLY/);
  assert.match(workflow, /environment: blob-smoke/);
  assert.match(workflow, /secrets\.BLOB_SMOKE_READ_WRITE_TOKEN/);
  assert.match(workflow, /vars\.BLOB_SMOKE_STORE_ID/);
  assert.match(workflow, /vars\.BLOB_SMOKE_STORE_NAME/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /secrets\.BLOB_READ_WRITE_TOKEN/);
});
test('normal API CI runs OFFLINE guard only; no live script as part of release', () => {
  const ci = fs.readFileSync(path.join(__dirname, '..',
    '.github/workflows/api-ci.yml'), 'utf8');
  assert.match(ci, /blob:smoke:guard:test/);
  assert.doesNotMatch(ci, /blob:smoke:live/);
});
