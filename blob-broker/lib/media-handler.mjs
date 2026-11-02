import { createRequire } from 'node:module';
import { isIsolatedNonceDatabase } from './handler.mjs';
const require = createRequire(import.meta.url);
const { verifyMediaRequest, MAX_BYTES, STORE_ID } = require('./private-blob-broker-media-v2.cjs');
const { createAtomicPostgresNonceClaim } = require('./private-blob-broker-postgres-nonce.cjs');

const PROJECT = 'prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz';
const TEAM = 'team_ONfSvrgCkVLlDaKIeFuPlrEL';
const MAX_REQUEST = 3_900_000;
const REPLY_HEADERS = {
  'Cache-Control':'private, no-store',
  'Content-Type':'application/json; charset=utf-8',
  'X-Content-Type-Options':'nosniff',
};
function reply(status,code,data) {
  return new Response(JSON.stringify(data||{code}),{status,headers:REPLY_HEADERS});
}
function enableChecks(env) {
  return {
    mediaFlag: env.SWIMFLOW_BLOB_BROKER_MEDIA_ENABLED === 'true',
    previewEnvironment: env.VERCEL_ENV === 'preview',
    projectIdentity: env.VERCEL_PROJECT_ID === PROJECT && env.VERCEL_ORG_ID === TEAM,
    projectIdMatches: env.VERCEL_PROJECT_ID === PROJECT,
    teamIdMatches: env.VERCEL_ORG_ID === TEAM,
    storeIdentity: env.BLOB_STORE_ID === STORE_ID,
    forbiddenVariablesAbsent: !env.BLOB_READ_WRITE_TOKEN && !env.BLOB_SMOKE_STORE_ID &&
      !env.DATABASE_URL && !env.DIRECT_URL && !env.VERCEL_BLOB_API_URL,
    nonceDatabaseConfiguration: isIsolatedNonceDatabase(env),
    sharedKeyFormat: typeof env.SWIMFLOW_BLOB_BROKER_SHARED_KEY === 'string' &&
      /^[a-zA-Z0-9_-]{43}$/.test(env.SWIMFLOW_BLOB_BROKER_SHARED_KEY),
  };
}
function enabled(env) {
  return Object.values(enableChecks(env)).every(Boolean);
}
async function readLimited(request) {
  const len=request.headers.get('content-length');
  if (len!==null && (!/^[0-9]{1,8}$/.test(len) || Number(len)>MAX_REQUEST)) return null;
  const reader=request.body?.getReader();
  if(!reader)return null;
  const chunks=[];let size=0;
  try {
    while(true) {
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.length;
      if(size>MAX_REQUEST)return null;
      chunks.push(Buffer.from(value));
    }
    const input=Buffer.concat(chunks,size).toString('utf8');
    if(!input||Buffer.byteLength(input)>MAX_REQUEST)return null;
    return JSON.parse(input);
  }catch{return null;}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
function safeMetadata(meta,req) {
  return meta && meta.pathname===req.pathname &&
    meta.contentType==='image/jpeg' && Number.isSafeInteger(meta.size) &&
    meta.size>=8 && meta.size<=MAX_BYTES && 
    typeof meta.etag==='string' && /^"[A-Za-z0-9-]{1,120}"$/.test(meta.etag) &&
    typeof meta.url==='string' &&
    /^https:\/\/[a-z0-9-]+\.private\.blob\.vercel-storage\.com\/private\//.test(meta.url) &&
    meta.url.endsWith('/'+req.pathname);
}
async function dispatch(req,sdk) {
  const opts={abortSignal:AbortSignal.timeout(8000)};
  if(req.operation==='put') {
    const saved=await sdk.put(req.pathname,req.bytes,{
      access:'private',allowOverwrite:false,addRandomSuffix:false,
      contentType:'image/jpeg',cacheControlMaxAge:60,...opts,
    });
    const checked=await sdk.head(req.pathname,opts);
    if(!safeMetadata(checked,req) || checked.size!==req.bytes.length ||
        checked.etag!==saved.etag) return reply(502,'invalid-upload-receipt');
    return reply(200,'ok',{pathname:req.pathname,etag:checked.etag,
      sizeBytes:checked.size,contentType:checked.contentType});
  }
  if(req.operation==='stat') {
    let checked;
    try{checked=await sdk.head(req.pathname,opts);}
    catch(e){if(e instanceof sdk.BlobNotFoundError)return reply(404,'not-found');throw e;}
    if(!safeMetadata(checked,req))return reply(502,'invalid-blob-metadata');
    return reply(200,'ok',{pathname:req.pathname,etag:checked.etag,
      sizeBytes:checked.size,contentType:checked.contentType});
  }
  if(req.operation==='delete') {
    await sdk.del(req.pathname,{ifMatch:req.etag,...opts});
    return reply(200,'ok',{deleted:true});
  }
  if(req.operation==='get') {
    const received=await sdk.get(req.pathname,{
      access:'private',useCache:false,headers:{'If-Match':req.etag},...opts,
    });
    if(!received)return reply(404,'not-found');
    if(received.statusCode!==200 || !received.stream ||
       !safeMetadata(received.blob,req) ||
       received.blob.etag!==req.etag)return reply(409,'blob-version-mismatch');
    const buffer=Buffer.from(await new Response(received.stream).arrayBuffer());
    if(buffer.length!==received.blob.size || buffer.length>MAX_BYTES ||
       buffer[0]!==0xff || buffer[1]!==0xd8 || buffer[2]!==0xff)
      return reply(502,'invalid-blob-data');
    return reply(200,'ok',{pathname:req.pathname,etag:req.etag,
      sizeBytes:buffer.length,contentType:'image/jpeg',bytes:buffer.toString('base64')});
  }
  return reply(400,'unsupported-operation');
}

export function createMediaHandler({
  env=process.env,now=Date.now,
  loadBlob=()=>import('@vercel/blob'),
  createQuery=async(connectionString)=>{
    const lib=await import('pg'); const Pool=lib.Pool||lib.default?.Pool;
    const pool=new Pool({connectionString,max:2,connectionTimeoutMillis:3000,
      idleTimeoutMillis:2000,statement_timeout:3500});
    pool.on('error',()=>{});
    return (sql,params)=>pool.query(sql,params);
  },
}={}) {
  let queryPromise;
  return { async fetch(request) {
    if(!enabled(env)) {
      // Diagnostic is restricted to preview and explicit short-lived opt-in.
      // Never return identifiers, credentials, hosts or raw environment values.
      const diagnosticRequested = env.VERCEL_ENV === 'preview' &&
        env.SWIMFLOW_BLOB_BROKER_DIAGNOSTICS_ENABLED === 'true' &&
        request instanceof Request && request.method === 'POST' &&
        new URL(request.url).pathname === '/api/media' &&
        request.headers.get('content-type') === 'application/json' &&
        !request.headers.has('origin');
      if (diagnosticRequested) {
        return reply(503, 'broker-disabled', {
          code: 'broker-disabled', checks: enableChecks(env),
        });
      }
      return reply(503,'broker-disabled');
    }
    if(!(request instanceof Request) ||
       request.method!=='POST' ||
       new URL(request.url).pathname!=='/api/media' ||
       new URL(request.url).search ||
       request.headers.has('origin') ||
       request.headers.get('content-type')!=='application/json')
      return reply(400,'invalid-request');

    const body=await readLimited(request);
    if(!body)return reply(413,'invalid-or-too-large-request');
    try {
      if(!queryPromise)queryPromise=Promise.resolve().then(()=>
        createQuery(env.SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL));
      const query=await queryPromise;
      const req=await verifyMediaRequest(env.SWIMFLOW_BLOB_BROKER_SHARED_KEY,body,{
        nowMs:now(),claimNonce:createAtomicPostgresNonceClaim(query)
      });
      const sdk=await loadBlob();
      return await dispatch(req,sdk);
    }catch {
      // No DB errors, tokens, URLs, image bytes or object keys in responses.
      return reply(502,'private-media-request-failed');
    }
  }};
}
