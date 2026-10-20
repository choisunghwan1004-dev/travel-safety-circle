import {env} from 'cloudflare:workers';
import {getDb} from '../db';
import {journeys,deliveries} from '../db/schema';
import {eq,desc} from 'drizzle-orm';
import {due,contactValid,normalizePhone,alertText,reportSnapshot} from './alert-rules';
import {photoKey} from '../app/photo-storage';
import {Buffer} from 'node:buffer';
export function channelsReady(){return {sms:!!(env.SOLAPI_API_KEY&&env.SOLAPI_API_SECRET&&env.SOLAPI_FROM),email:!!(env.RESEND_API_KEY&&env.ALERT_EMAIL_FROM),scheduler:env.ALERT_SCHEDULER_READY==='true'};}
async function digest(s:string){return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');}
async function solapiAuth(){const date=new Date().toISOString(),salt=crypto.randomUUID().replaceAll('-','');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SOLAPI_API_SECRET!),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(date+salt))).toString('hex');return `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;}
export async function alertStatus(owner:string){return {ready:channelsReady(),deliveries:await getDb().select().from(deliveries).where(eq(deliveries.owner,owner)).orderBy(desc(deliveries.createdAt)).limit(30)};}
export async function scanOwner(owner:string){
 const ready=channelsReady();if(!ready.sms||!ready.email)return {status:'configuration_required',ready};
 const db=getDb();const [row]=await db.select().from(journeys).where(eq(journeys.owner,owner));if(!row)return {status:'no_trip'};const s=JSON.parse(row.data);if(!due(s))return {status:'not_due'};
 const contacts=s.contacts.filter((c:any)=>contactValid(c)&&['가족','친구'].includes(c.relation));let attempts=0;
 for(const c of contacts){for(const channel of ['sms','email']){
 let recipient:string;try{recipient=channel==='sms'?normalizePhone(c.phone):c.email.trim().toLowerCase()}catch{continue}
 const id=await digest([owner,s.lastCheck,channel,recipient].join('|'));
 const [current]=await db.select().from(journeys).where(eq(journeys.owner,owner));const fresh=JSON.parse(current.data);if(!due(fresh)||fresh.lastCheck!==s.lastCheck||!fresh.contacts.some((v:any)=>v.id===c.id&&contactValid(v)&&v.phone===c.phone&&v.email===c.email))continue;
 const inserted=await db.insert(deliveries).values({id,owner,channel,recipient,status:'요청 중',createdAt:new Date().toISOString()}).onConflictDoNothing().returning();if(!inserted.length)continue;
 let status='확인 필요',providerId:string|null=null,error:string|null=null;
 try{
 const text=alertText(fresh);let response:Response;
 if(channel==='sms'){
 const sms=[`[여행안심] ${String(fresh.trip.name).slice(0,30)}님 24시간 안전 확인 미응답.`, `행선지: ${String(fresh.trip.destination).slice(0,80)}`,`연락처: ${String(fresh.trip.phone||'미등록').slice(0,30)}`,fresh.location?`위치 확인시각: ${fresh.location.acquiredAt||fresh.location.at}`:'',fresh.location?`마지막 위치: https://www.google.com/maps/search/?api=1&query=${fresh.location.lat},${fresh.location.lng}`:'마지막 위치 미등록','실종 확정 아님. 먼저 본인에게 연락해 주세요. 상세 자료는 이메일 확인.'].join('\n');
 response=await fetch('https://api.solapi.com/messages/v4/send-many/detail',{method:'POST',headers:{Authorization:await solapiAuth(),'Content-Type':'application/json'},body:JSON.stringify({messages:[{to:recipient,from:env.SOLAPI_FROM!.replace(/\D/g,''),country:'82',type:'LMS',text:sms}],allowDuplicates:false}),signal:AbortSignal.timeout(20000)});
 const j:any=await response.json();if(!response.ok||j.failedMessageList?.length||(!j.groupInfo?.groupId||!(j.groupInfo?.count?.registeredSuccess>0))){status='거절';error=`SOLAPI 요청 거절 (${response.status})`}else{status='업체 접수';providerId=j.groupInfo.groupId}
 }else{
 const attachments:any[]=[];const photoMetadata:any={};if(env.BUCKET)for(const kind of ['person','area']){const photo=await env.BUCKET.get(await photoKey(owner,kind));if(photo){photoMetadata[kind]={uploadedAt:photo.uploaded.toISOString(),size:photo.size};const ext=photo.httpMetadata?.contentType==='image/png'?'png':photo.httpMetadata?.contentType==='image/webp'?'webp':'jpg';attachments.push({filename:`${kind}.${ext}`,content:Buffer.from(await photo.arrayBuffer()).toString('base64')})}}
 const snapshot=reportSnapshot(fresh,photoMetadata);attachments.push({filename:'latest-travel-report.json',content:Buffer.from(JSON.stringify(snapshot,null,2)).toString('base64')});
 response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:env.ALERT_EMAIL_FROM,to:[recipient],subject:'[여행안심] 24시간 미응답 · 안전 확인 필요',text:text+'\n\n자료 생성: '+snapshot.createdAt+'\n최신자료 업로드: '+(snapshot.dataUpdatedAt||'미기록')+'\n위치 상태: '+(snapshot.location?.freshness||'미등록')+'\n사진 업로드 시각: '+JSON.stringify(photoMetadata)+'\n첨부 자료는 서버에 마지막 업로드된 정보이며 실시간 휴대전화 조회 결과가 아닙니다.',attachments}),signal:AbortSignal.timeout(20000)});
 const j:any=await response.json();if(!response.ok||!j.id){status='거절';error=`Resend 요청 거절 (${response.status})`}else{status='업체 접수';providerId=j.id}
 }
 }catch{error='통신 결과 불명. 중복 방지를 위해 자동 재발송하지 않습니다. 업체 발송내역을 확인하세요.'}
 await db.update(deliveries).set({status,providerId,error}).where(eq(deliveries.id,id));attempts++;
 }}return {status:'processed',attempts};
}
