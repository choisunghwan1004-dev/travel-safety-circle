import {applyAlertDefault} from '../../../lib/alert-setup';
import {synchronizeLastArea} from '../../../lib/last-area';
import {validDate} from '../../../lib/assist-rules';
import {sanitizeLocation} from '../../../lib/trip-autofill';
import {locationSaveDue} from '../../../lib/location-rules';
import {env} from 'cloudflare:workers';
import {photoKey} from '../../photo-storage';
import {getChatGPTUser} from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {contactValid} from '../../../lib/alert-rules';
import {journeys,deliveries} from '../../../db/schema';
import {eq,and} from 'drizzle-orm';
export const dynamic='force-dynamic';
const initial=()=>({trip:null,contacts:[],events:[],location:null,status:'준비 중',lastCheck:null,alertsEnabled:false,alertPreference:'on',lastAutoLocationAt:null});
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const u=await getChatGPTUser();if(!u)return reply({error:'로그인이 필요합니다.'},401);const rows=await getDb().select().from(journeys).where(eq(journeys.owner,u.userId));return reply({state:rows[0]?synchronizeLastArea(JSON.parse(rows[0].data)):initial(),revision:rows[0]?.revision??0});}
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return reply({error:'로그인이 필요합니다.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'잘못된 요청입니다.'},403);
 const raw=await req.text();if(raw.length>100000)return reply({error:'자료 크기가 너무 큽니다.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'잘못된 자료입니다.'},400)}
 const db=getDb();await db.insert(journeys).values({owner:u.userId,data:JSON.stringify(initial())}).onConflictDoNothing();
 const [row]=await db.select().from(journeys).where(eq(journeys.owner,u.userId));
 if(b.revision!==row.revision)return reply({error:'다른 화면에서 변경되었습니다. 새로고침 후 다시 시도하세요.'},409);
 const s=JSON.parse(row.data);const now=new Date().toISOString();const log=(text:string)=>s.events.unshift({id:crypto.randomUUID(),at:now,text});
 const str=(x:unknown,max=1000)=>typeof x==='string'?x.trim().slice(0,max):'';
 if(b.action==='trip'){
 const t=b.value;if(!t||!str(t.name)||!str(t.destination)||!validDate(t.start)||!validDate(t.end)||Date.parse(t.end)<Date.parse(t.start)||!Number.isFinite(Date.parse(t.deadline)))return reply({error:'여행자, 행선지, 여행 날짜, 안전 확인 예정시간을 확인하세요.'},400);
 const captured=t.locationDraft?sanitizeLocation(t.locationDraft):null;if(t.locationDraft&&!captured)return reply({error:'현재 위치가 올바르지 않거나 하루 이상 지났습니다. 위치를 다시 확인하세요.'},400);
 s.trip=Object.fromEntries(['name','phone','destination','start','end','hotel','transport','route','deadline','police','embassy','homeAddress','homePolice','homePolicePhone','missingArea','appearance','notes','homeRegion','homePoliceAddress','homePoliceSource','policeName','policeAddress','policeSource','lastArea','ticketName','airline','flightNumber','departureAirport','arrivalAirport','flightDate','departureTime','arrivalDate','arrivalTime','seat','gate','country','transportType','lastAreaLocationAt'].map(k=>[k,str(t[k],5000)]));if(!s.lastCheck||s.status==='귀가 완료'){s.lastCheck=now;s.lastAutoLocationAt=null;s.alertPreference='on';}if(captured&&(!s.location||Date.parse(captured.acquiredAt)>=Date.parse(s.location.acquiredAt||s.location.at)))s.location=captured;s.status='여행 중';log('여행 일정 등록·수정');
 }else if(b.action==='contact'){
 const c=b.value;const v={id:c?.id||crypto.randomUUID(),name:str(c?.name,80),phone:str(c?.phone,30),relation:str(c?.relation,30),email:str(c?.email,200).toLowerCase(),consent:c?.consent===true};
 if(!contactValid(v))return reply({error:'이름·전화번호·이메일은 모두 필수이며, 등록·자동 알림 수신 동의가 필요합니다.'},400);
 if(c.id&&!s.contacts.some((x:any)=>x.id===c.id))return reply({error:'수정할 연락처가 없습니다.'},404);
 if(s.contacts.some((x:any)=>x.id!==v.id&&(x.phone.replace(/\D/g,'')===v.phone.replace(/\D/g,'')||x.email?.toLowerCase()===v.email)))return reply({error:'이미 등록된 전화번호 또는 이메일입니다.'},409);
 if(c.id)s.contacts=s.contacts.map((x:any)=>x.id===c.id?v:x);else s.contacts.push(v);log(c.id?'비상연락처 수정':'비상연락처 등록');
 }else if(b.action==='alerts'){
 if(b.value===true&&(!s.trip||!s.contacts.some((c:any)=>contactValid(c))))return reply({error:'여행과 이름·전화번호·이메일·수신동의를 갖춘 비상연락망을 먼저 등록하세요.'},400);
 s.alertsEnabled=b.value===true;s.alertPreference=s.alertsEnabled?'on':'off';log(s.alertsEnabled?'가족·친구 24시간 자동 알림 사용 요청 저장':'자동 알림 중지');
 }else if(b.action==='deleteContact'){s.contacts=s.contacts.filter((c:any)=>c.id!==b.id);log('비상연락처 삭제');
 }else if(b.action==='check'){
 if(!s.trip||s.status==='귀가 완료')return reply({error:'진행 중인 여행이 필요합니다.'},400);
 if(!Number.isFinite(Date.parse(b.deadline))||Date.parse(b.deadline)<=Date.now())return reply({error:'다음 안전 확인 시간을 미래로 지정하세요.'},400);
 s.lastCheck=now;s.trip.deadline=b.deadline;s.status='안전 확인';log('본인 안전 확인 · 다음 확인시간 설정');
 }else if(b.action==='sos'){if(!s.trip)return reply({error:'여행을 먼저 등록하세요.'},400);s.status='긴급 도움 요청';log('SOS 기록 생성 · 긴급 전화 연결은 단말에서 실행');
 }else if(b.action==='finish'){if(!s.trip)return reply({error:'여행을 먼저 등록하세요.'},400);s.status='귀가 완료';s.alertsEnabled=false;log('귀가 완료 · 확인시간 감시 종료');
 }else if(b.action==='location'){
 const p=b.value;if(p?.mode==='automatic'&&!locationSaveDue(s))return reply({state:s,revision:row.revision,locationSkipped:true});if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||Math.abs(p.lat)>90||Math.abs(p.lng)>180)return reply({error:'위치를 확인할 수 없습니다.'},400);
 const acquired=typeof p.acquiredAt==='string'?Date.parse(p.acquiredAt):Date.now();if(!Number.isFinite(acquired)||acquired>Date.now()+300000)return reply({error:'위치 확인시각이 올바르지 않습니다.'},400);if(s.location&&acquired<Date.parse(s.location.acquiredAt||s.location.at))return reply({state:s,revision:row.revision});s.location={lat:p.lat,lng:p.lng,accuracy:Number.isFinite(p.accuracy)?Math.max(0,p.accuracy):null,acquiredAt:new Date(acquired).toISOString(),at:now,mode:p.mode==='automatic'?'automatic':'manual'};if(p.mode==='automatic')s.lastAutoLocationAt=now;log(p.mode==='automatic'?'여행 중 2시간 간격 위치 자동 저장':'현재 위치 수동 저장');
 }else if(b.action==='clear'){Object.assign(s,initial());}else return reply({error:'지원하지 않는 작업입니다.'},400);
 synchronizeLastArea(s);
 if(['trip','contact'].includes(b.action))applyAlertDefault(s);
 if(b.action!=='clear')s.dataUpdatedAt=now;
 s.events=s.events.slice(0,100);const result=await db.update(journeys).set({data:JSON.stringify(s),revision:row.revision+1}).where(and(eq(journeys.owner,u.userId),eq(journeys.revision,row.revision))).returning();
 if(!result.length)return reply({error:'자료가 변경되었습니다. 새로고침 후 다시 시도하세요.'},409);
 if(b.action==='clear'){await db.delete(deliveries).where(eq(deliveries.owner,u.userId));await env.DB!.prepare('DELETE FROM user_ai_keys WHERE owner=?').bind(u.userId).run();await env.DB!.prepare('DELETE FROM notification_settings WHERE owner=?').bind(u.userId).run();await env.DB!.prepare('DELETE FROM alert_monitors WHERE owner=?').bind(u.userId).run();}
 if(b.action==='clear'&&env.BUCKET){await env.BUCKET.delete([await photoKey(u.userId,'person'),await photoKey(u.userId,'area')]);}
 return reply({state:s,revision:row.revision+1});
}
