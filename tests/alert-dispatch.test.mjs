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
 insert(){return {values(value){return {onConflictDoNothing(){const claim=()=>{if(ledger.has(value.id))return [];ledger.set(value.id,{...value});return [value]};return {async returning(){return claim()},then(ok,bad){return Promise.resolve(claim()).then(ok,bad)}}}}}}},
 update(){return {set(value){return {async where(filter){const row=ledger.get(filter.value);if(row)Object.assign(row,value)}}}}}
};
const modules=new Map();
function load(file){file=resolve(file);if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const local=(name)=>{if(name==='./provider-pacing')return {paceEmail:async()=>{}};if(name==='cloudflare:workers')return {env};if(name==='../db')return {getDb:()=>db};if(name==='../db/schema')return {journeys,deliveries};if(name==='drizzle-orm')return {eq:(key,value)=>({key,value}),desc:v=>v};if(name.includes('photo-storage'))return {photoKey:async(owner,kind)=>owner+'/'+kind};if(name.startsWith('.'))return load(resolve(dirname(file),name.replace(/\.ts$/,'')+'.ts'));return require(name)};new Function('require','exports',js)(local,exports);return exports;}
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
 reset();state.contacts=[{...contact,consent:false},{...contact,id:'other',relation:'기타'}];await scanOwner('owner-test');assert.equal(requests.length,1);
 reset();env.RESEND_API_KEY=undefined;assert.equal((await scanOwner('owner-test')).status,'configuration_required');assert.equal(requests.length,0);assert.equal(ledger.size,0);
 reset();state.contacts=Array.from({length:61},(_,i)=>({...contact,id:'c'+i,name:'Contact '+i,phone:'010'+String(i).padStart(8,'0'),email:'contact'+i+'@example.test',relation:['가족','친구','동행자','기타'][i%4]}));state.contacts.push({...contact,id:'excluded',consent:false});
 const first=await scanOwner('owner-test');assert.equal(first.status,'pending');assert.equal(first.attempts,50);assert.equal(first.pending,11);assert.equal(first.eligibleContacts,61);assert.equal(first.excludedContacts,1);
 const second=await scanOwner('owner-test');assert.equal(second.attempts,11);assert.equal(second.pending,0);await scanOwner('owner-test');assert.equal(requests.length,61);assert.equal(new Set(requests.map(r=>r.body.to[0])).size,61);
 const snapshot=JSON.parse(Buffer.from(requests[0].body.attachments.find(a=>a.filename==='latest-travel-report.json').content,'base64').toString());assert.equal(snapshot.contacts.length,61);assert.equal(snapshot.contacts[0].email,'contact0@example.test');assert.match(snapshot.trip.lastArea,/GPS 0.00000, 0.00000/);
 reset();state.contacts=[{...contact,phone:'+819012345678'}];env.SOLAPI_API_KEY='test';env.SOLAPI_API_SECRET='test';env.SOLAPI_FROM='01012345678';const partial=await scanOwner('owner-test');assert.equal(partial.unsupported,1);assert.equal(partial.status,'partial');assert.equal(requests.length,1);assert.ok([...ledger.values()].some(d=>d.status==='지원번호 확인 필요'));
 reset();globalThis.fetch=async()=>{requests.push({});throw Error('network result unknown')};await scanOwner('owner-test');await scanOwner('owner-test');assert.equal(requests.length,1);assert.equal([...ledger.values()][0].status,'확인 필요');
 console.log('PASS dispatch integration: email-only, photos/report attachments, concurrent duplicate claim, no repeat, 24h/finish/consent/config gates, ambiguous transport not retried, monitor persisted');
}finally{globalThis.fetch=realFetch}
