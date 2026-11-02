'use strict';

/**
 * V2: signed server-to-server operations for normalized PRIVATE JPEG only.
 * The Nest API authenticates the user/resource BEFORE calling this module.
 * The Vercel broker authenticates the Nest request and performs no ACL guesses.
 * The nonce store MUST be durable + atomic across serverless instances.
 */
const { createHmac, createHash, randomUUID, timingSafeEqual } = require('node:crypto');
const AUD = 'swim-flow-private-media-staging-v2';
const STORE_ID = 'store_PJZzrdBiiVcRyLHj';
const MAX_BYTES = 2_800_000; // Vercel Functions have a ~4.5 MB body limit, base64 adds 33%.
const MAX_SKEW_MS = 30000;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const PATH = new RegExp('^private/(?:profiles|students|teachers|parents)/'+UUID+'/'+UUID+'\\.jpg$');
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ETAG = /^"[A-Za-z0-9-]{1,120}"$/;
const SIGNATURE = /^[a-zA-Z0-9_-]{43}$/;
const OPS = new Set(['put','get','stat','delete']);
const FIELDS = ['audience','bytes','contentType','etag','issuedAtMs','nonce','operation','pathname','signature','version'];

function deny() { throw new Error('private-media-broker-rejected'); }
function secret(secret) {
  if (typeof secret !== 'string' || !SIGNATURE.test(secret)) deny();
  const key = Buffer.from(secret,'base64url');
  if (key.length !== 32 || key.toString('base64url') !== secret) deny();
  return key;
}
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function canonical(v) {
  return ['swimflow-private-media/v2',v.version,v.audience,v.operation,
    v.pathname,v.etag,v.contentType,v.issuedAtMs,v.nonce,sha(Buffer.from(v.bytes,'base64'))].join('\n');
}
function sign(key,v) {
  return createHmac('sha256',key).update(canonical(v)).digest('base64url');
}
function validInput(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v) ||
      Object.keys(v).sort().join(',') !== FIELDS.join(',') ||
      v.version !== 2 || v.audience !== AUD || !OPS.has(v.operation) ||
      typeof v.pathname !== 'string' || !PATH.test(v.pathname) ||
      typeof v.nonce !== 'string' || !NONCE.test(v.nonce) ||
      typeof v.signature !== 'string' || !SIGNATURE.test(v.signature) ||
      typeof v.issuedAtMs !== 'number' || !Number.isSafeInteger(v.issuedAtMs) ||
      typeof v.etag !== 'string' || typeof v.contentType !== 'string' ||
      typeof v.bytes !== 'string') return false;
  if (v.operation === 'put') {
    if (v.contentType !== 'image/jpeg' || v.etag !== '' ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v.bytes) ||
        v.bytes.length < 8 || v.bytes.length > Math.ceil(MAX_BYTES / 3) * 4) return false;
    const raw = Buffer.from(v.bytes,'base64');
    if (raw.length < 8 || raw.length > MAX_BYTES ||
        raw[0] !== 0xff || raw[1] !== 0xd8 || raw[2] !== 0xff ||
        raw.toString('base64') !== v.bytes) return false;
  } else if (
    v.bytes !== '' || v.contentType !== '' ||
    (v.operation === 'stat' ? v.etag !== '' : !ETAG.test(v.etag))
  ) return false;
  return true;
}
function createMediaRequest(secretValue,input,issuedAtMs=Date.now()) {
  const key = secret(secretValue);
  if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 0 ||
      !OPS.has(input.operation)) deny();
  const v = {
    version:2,audience:AUD,operation:input.operation,pathname:input.pathname,
    etag:input.etag || '',contentType:input.contentType || '',
    bytes:input.bytes ? Buffer.from(input.bytes).toString('base64') : '',
    issuedAtMs,nonce:randomUUID(),signature:''
  };
  // Validate exact body bytes BEFORE signing, never sign unvalidated paths.
  const probe = {...v,signature:'A'.repeat(43)};
  if (!validInput(probe)) deny();
  return {...v,signature:sign(key,v)};
}
async function verifyMediaRequest(secretValue,v,options) {
  const key = secret(secretValue);
  if (!validInput(v) || !options || !Number.isSafeInteger(options.nowMs) ||
      typeof options.claimNonce !== 'function' ||
      Math.abs(options.nowMs-v.issuedAtMs)>MAX_SKEW_MS) deny();
  const expected=Buffer.from(sign(key,v),'base64url');
  const actual=Buffer.from(v.signature,'base64url');
  if (actual.length!==expected.length || !timingSafeEqual(expected,actual)) deny();
  const nonceKey='swim-flow-blob-staging-broker-v1:'+v.nonce;
  let ok=false;
  try { ok=await options.claimNonce(nonceKey,v.issuedAtMs+MAX_SKEW_MS+1000); }
  catch { deny(); }
  if(ok!==true) deny();
  return {operation:v.operation,pathname:v.pathname,etag:v.etag,contentType:v.contentType,
    bytes:v.operation==='put'?Buffer.from(v.bytes,'base64'):Buffer.alloc(0)};
}
module.exports={createMediaRequest,verifyMediaRequest,MAX_BYTES,AUD,STORE_ID};
