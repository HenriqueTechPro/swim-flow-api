import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createMediaHandler } from '../lib/media-handler.mjs';

const require=createRequire(import.meta.url);
const {createMediaRequest,verifyMediaRequest}=require('../lib/private-blob-broker-media-v2.cjs');
const KEY=randomBytes(32).toString('base64url'),NOW=1793570000000;
const PATH='private/students/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg';
const ETAG='"d41d8cd98f00b204e9800998ecf8427e"';
const URL='https://abc123.private.blob.vercel-storage.com/'+PATH;
const JPEG=Buffer.from([0xff,0xd8,0xff,0xe0,0x01,0x02,0x03,0x04,0xff,0xd9]);
const DB_URL='postgresql://swimflow_blob_broker_nonce_rw:synthetic-secret-only@ep-test.aws.neon.tech/swimflow_blob_broker_nonce_staging?sslmode=require';
const env={
  SWIMFLOW_BLOB_BROKER_MEDIA_ENABLED:'true',
  VERCEL_ENV:'preview',
  VERCEL_PROJECT_ID:'prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz',
  VERCEL_ORG_ID:'team_ONfSvrgCkVLlDaKIeFuPlrEL',
  BLOB_STORE_ID:'store_PJZzrdBiiVcRyLHj',
  SWIMFLOW_BLOB_BROKER_NONCE_DB_HOST:'ep-test.aws.neon.tech',
  SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL:DB_URL,
  SWIMFLOW_BLOB_BROKER_SHARED_KEY:KEY,
};
function request(v) {
  return new Request('https://broker.example.test/api/media',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)
  });
}
function setup(overrides={}) {
  const seen=new Set();
  const blob=new Map();
  let calls=0;
  class BlobNotFoundError extends Error{}
  const sdk={
    BlobNotFoundError,
    put:async(path,bytes,opts)=>{
      calls++;assert.equal(opts.access,'private');assert.equal(opts.allowOverwrite,false);
      assert.equal(path,PATH);
      assert.equal(Buffer.from(bytes).toString('hex'),JPEG.toString('hex'));
      if(blob.has(path))throw Error('no-overwrite');
      blob.set(path,Buffer.from(bytes));
      return {pathname:path,contentType:'image/jpeg',etag:ETAG,url:URL};
    },
    head:async(path)=>{
      calls++;if(!blob.has(path))throw new BlobNotFoundError();
      return {pathname:path,contentType:'image/jpeg',size:blob.get(path).length,etag:ETAG,url:URL};
    },
    get:async(path,opts)=>{
      calls++;assert.equal(opts.access,'private');assert.equal(opts.headers['If-Match'],ETAG);
      if(!blob.has(path))return null;
      return {statusCode:200,blob:{pathname:path,contentType:'image/jpeg',size:blob.get(path).length,etag:ETAG,url:URL},
        stream:new ReadableStream({start(c){c.enqueue(blob.get(path));c.close();}})};
    },
    del:async(path,opts)=>{
      calls++;assert.equal(opts.ifMatch,ETAG);blob.delete(path);
    },
  };
  const handler=createMediaHandler({
    env:{...env,...overrides},now:()=>NOW,
    loadBlob:async()=>sdk,
    createQuery:async()=>async(_sql,params)=>{
      const key=params[0];if(seen.has(key))return{rowCount:0,rows:[]};
      seen.add(key);return{rowCount:1,rows:[{nonce_key:key}]};
    },
  });
  return {handler,sdk,calls:()=>calls,blob};
}
test('HMAC v2 rejects tampering, wrong operation, key and path before SQL claim',async()=>{
  const req=createMediaRequest(KEY,{operation:'put',pathname:PATH,contentType:'image/jpeg',bytes:JPEG},NOW);
  const ok=await verifyMediaRequest(KEY,req,{nowMs:NOW,claimNonce:async()=>true});
  assert.equal(ok.operation,'put');
  assert.equal(ok.bytes.toString('hex'),JPEG.toString('hex'));
  for(const mutation of [
    {pathname:'../../secret.jpg'},
    {operation:'list'},
    {operation:'delete'},
    {bytes:Buffer.from('wrong').toString('base64')},
    {signature:'A'.repeat(43)},
  ])await assert.rejects(verifyMediaRequest(KEY,{...req,...mutation},{
    nowMs:NOW,claimNonce:async()=>{throw Error('nonce must not be claimed');}
  }),/private-media-broker-rejected/);
});
test('one synthetic JPEG can be PUT, STAT, GET and conditionally DELETE; reply has no blob URL',async()=>{
  const {handler,blob}=setup();
  for(const input of [
    {operation:'put',pathname:PATH,contentType:'image/jpeg',bytes:JPEG},
    {operation:'stat',pathname:PATH},
    {operation:'get',pathname:PATH,etag:ETAG},
    {operation:'delete',pathname:PATH,etag:ETAG},
  ]){
    const signed=createMediaRequest(KEY,input,NOW);
    const res=await handler.fetch(request(signed));
    assert.equal(res.status,200);
    const body=await res.json();
    assert.ok(!JSON.stringify(body).includes('blob.vercel-storage.com'));
    assert.equal(res.headers.get('Cache-Control'),'private, no-store');
    if(input.operation==='get')assert.equal(Buffer.from(body.bytes,'base64').toString('hex'),JPEG.toString('hex'));
  }
  assert.equal(blob.size,0);
});
test('same signed request is accepted once only, including against a new transport call',async()=>{
  const {handler,calls}=setup();
  const envelope=createMediaRequest(KEY,{operation:'stat',pathname:PATH},NOW);
  assert.equal((await handler.fetch(request(envelope))).status,404);
  assert.notEqual((await handler.fetch(request(envelope))).status,404);
  assert.equal(calls(),1);
});
test('production, wrong project/store, absent secret/DB and browser origin stay OFF',async()=>{
  for(const patch of [
    {SWIMFLOW_BLOB_BROKER_MEDIA_ENABLED:undefined},{VERCEL_ENV:'production'},
    {VERCEL_PROJECT_ID:'prj_wrong'},{BLOB_STORE_ID:'store_wrong'},
    {SWIMFLOW_BLOB_BROKER_SHARED_KEY:undefined},
    {SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL:undefined},
    {DATABASE_URL:'postgresql://app'},
  ]){
    const s=setup(patch);
    assert.equal((await s.handler.fetch(request({}))).status,503);
    assert.equal(s.calls(),0);
  }
  const s=setup();
  const response=await s.handler.fetch(new Request('https://broker.example.test/api/media',{
    method:'POST',headers:{origin:'https://evil.invalid','Content-Type':'application/json'},body:'{}'
  }));
  assert.equal(response.status,400);
});
test('rejects arbitrary image path or larger JPEG before storage or nonce claim',async()=>{
  const s=setup();
  assert.throws(()=>createMediaRequest(KEY,{operation:'put',pathname:'private/students/anything/file.jpg',contentType:'image/jpeg',bytes:JPEG},NOW));
  assert.throws(()=>createMediaRequest(KEY,{operation:'put',pathname:PATH,contentType:'image/jpeg',bytes:Buffer.alloc(2_800_001)},NOW));
  assert.equal(s.calls(),0);
});
