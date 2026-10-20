import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
const require=createRequire(import.meta.url),ts=require('typescript');
const journeys={owner:'owner'},deliveries={id:'id',owner:'owner',createdAt:'createdAt'};
let state,ledger,requests,monitor;
const env={
 RESEND_API_KEY:'test-key-not-real',ALERT_EMAIL_FROM:'sender@example.test',
 DB:{prepare(sql){return {bind(...args){return {
  async first(){return sql.includes('alert_monitors')?monitor:null},
  async run(){if(sql.includes('alert_monitors'))monitor={last_at:args[1],result:args[2]}}
 }}}}},
 BUCKET:{async get(){return {
  uploaded:new Date('2026-10-20'),size:2,httpMetadata:{contentType:'image/jpeg'},
  async arrayBuffer(){return new Uint8Array([1,2]).buffer}
 }}}
};
const db={
 select(){return {from(table){return {async where(filter){return table===journeys?(state?[{data:JSON.stringify(state)}]:[]):[...ledger.values()].filter(v=>v[filter.key]===filter.value)}}}}},
 insert(){return {values(value){return {onConflictDoNothing(){return {async returning(){if(ledger.has(value.id))return [];ledger.set(value.id,{...value});return [value]}}}}}}},
 update(){return {set(value){return {async where(filter){const row=ledger.get(filter.value);if(row)Object.assign(row,value)}}}}}
};
const modules=new Map();
function load(file){file=resolve(file);if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const local=(name)=>{if(name==='cloudflare:workers')return {env};if(name==='../db')return {getDb:()=>db};if(name==='../db/schema')return {journeys,deliveries};if(name==='drizzle-orm')return {eq:(key,value)=>({key,value}),desc:v=>v};if(name.includes('photo-storage'))return {photoKey:async(owner,kind)=>owner+'/'+kind};if(name.startsWith('.'))return load(resolve(dirname(file),name.replace(/\.ts$/,'')+'.ts'));return require(name)};new Function('require','exports',js)(local,exports);return exports;}
const {scanOwner}=load('lib/alerts.ts');
const contact={id:'family1',name:'Family test',phone:'01012345678',email:'family@example.test',relation:'가족',consent:true};
function reset(){state={alertsEnabled:true,status:'여행 중',lastCheck:'2026-01-01T00:00:00Z',trip:{start:'2026-01-01',end:'2026-12-31',name:'Traveler test',destination:'Test city'},contacts:[contact],location:{lat:0,lng:0,acquiredAt:'2026-01-01T00:00:00Z'}};ledger=new Map();requests=[];monitor=null;env.RESEND_API_KEY='test-key-not-real';env.SOLAPI_API_KEY=undefined;env.SOLAPI_API_SECRET=undefined;env.SOLAPI_FROM=undefined;}
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return Response.json({id:'provider-test'})};
try{
 reset();await Promise.all([scanOwner('owner-test'),scanOwner('owner-test')]);assert.equal(requests.length,1);assert.equal(requests[0].url,'https://api.resend.com/emails');assert.deepEqual(requests[0].body.to,[contact.email]);assert.equal(requests[0].body.attachments.length,4);assert.ok(requests[0].body.text.includes('24시간'));assert.equal([...ledger.values()][0].status,'업체 접수');assert.equal(monitor.result,'processed');
 await scanOwner('owner-test');assert.equal(requests.length,1);
 reset();state.alertsEnabled=false;await scanOwner('owner-test');assert.equal(requests.length,0);
 reset();state.status='귀가 완료';await scanOwner('owner-test');assert.equal(requests.length,0);
 reset();state.lastCheck=new Date().toISOString();await scanOwner('owner-test');assert.equal(requests.length,0);
 reset();state.contacts=[{...contact,consent:false},{...contact,id:'other',relation:'기타'}];await scanOwner('owner-test');assert.equal(requests.length,0);
 reset();env.RESEND_API_KEY=undefined;assert.equal((await scanOwner('owner-test')).status,'configuration_required');assert.equal(requests.length,0);assert.equal(ledger.size,0);
 reset();globalThis.fetch=async()=>{requests.push({});throw Error('network result unknown')};await scanOwner('owner-test');await scanOwner('owner-test');assert.equal(requests.length,1);assert.equal([...ledger.values()][0].status,'확인 필요');
 console.log('PASS dispatch integration: email-only, photos/report attachments, concurrent duplicate claim, no repeat, 24h/finish/consent/config gates, ambiguous transport not retried, monitor persisted');
}finally{globalThis.fetch=realFetch}
