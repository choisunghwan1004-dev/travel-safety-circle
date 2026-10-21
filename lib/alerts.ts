import {synchronizeLastArea} from './last-area';
import {paceEmail} from './provider-pacing';
import {env} from 'cloudflare:workers';
import {getDb} from '../db';
import {journeys,deliveries} from '../db/schema';
import {eq,desc} from 'drizzle-orm';
import {due,contactValid,normalizePhone,alertText,reportSnapshot,sameAlertConsent} from './alert-rules';
import {photoKey} from '../app/photo-storage';
import {Buffer} from 'node:buffer';
import {notificationConfig,readyChannels,monitorStatus,recordMonitor} from './notification-config';
import {enabledChannels,eligibleContact} from './notification-rules';
export async function channelsReady(owner:string){const monitor=await monitorStatus(owner);return {...readyChannels(await notificationConfig(owner)),scheduler:monitor.recent,monitor};}
async function digest(s:string){return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');}
async function solapiAuth(config:any){const date=new Date().toISOString(),salt=crypto.randomUUID().replaceAll('-','');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.solapiSecret!),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(date+salt))).toString('hex');return `HMAC-SHA256 apiKey=${config.solapiKey}, date=${date}, salt=${salt}, signature=${signature}`;}
export async function alertStatus(owner:string){return {ready:await channelsReady(owner),deliveries:await getDb().select().from(deliveries).where(eq(deliveries.owner,owner)).orderBy(desc(deliveries.createdAt)).limit(30)};}
export async function scanOwner(owner:string){
 try{const result=await processOwner(owner);await recordMonitor(owner,result.status);return result}catch{await recordMonitor(owner,'error');return {status:'error',message:'점검에 실패했습니다. 자동 알림 설정과 발송내역을 확인하세요.'}}
}
async function processOwner(owner:string){
 const config=await notificationConfig(owner),ready=readyChannels(config),channels=enabledChannels(ready);if(!channels.length)return {status:'configuration_required',ready};
 const db=getDb();const [row]=await db.select().from(journeys).where(eq(journeys.owner,owner));if(!row)return {status:'no_trip'};const s=synchronizeLastArea(JSON.parse(row.data));if(!due(s))return {status:'not_due'};
 const contacts=s.contacts.filter((c:any)=>contactValid(c)&&eligibleContact(c));let attempts=0,pending=0,unsupported=0;
 const known=new Set((await db.select().from(deliveries).where(eq(deliveries.owner,owner))).map(d=>d.id));
 const stopAt=Date.now()+45000;
 for(const c of contacts){for(const channel of channels){
 let recipient:string;try{recipient=channel==='sms'?normalizePhone(c.phone):c.email.trim().toLowerCase()}catch{
 const id=await digest([owner,s.lastCheck,channel,c.phone].join('|'));if(!known.has(id)){await db.insert(deliveries).values({id,owner,channel,recipient:c.phone,status:'지원번호 확인 필요',createdAt:new Date().toISOString(),error:'자동 문자는 한국 휴대전화 번호만 지원합니다. 이메일 채널을 연결해 주세요.'}).onConflictDoNothing();known.add(id);}unsupported++;continue;
 }
 const id=await digest([owner,s.lastCheck,channel,recipient].join('|'));if(known.has(id))continue;if(attempts>=50||Date.now()>=stopAt){pending++;continue;}
 const [current]=await db.select().from(journeys).where(eq(journeys.owner,owner));if(!current)continue;const fresh=synchronizeLastArea(JSON.parse(current.data));if(!sameAlertConsent(s,fresh,c))continue;
 const inserted=await db.insert(deliveries).values({id,owner,channel,recipient,status:'요청 중',createdAt:new Date().toISOString()}).onConflictDoNothing().returning();if(!inserted.length)continue;
 let status='확인 필요',providerId:string|null=null,error:string|null=null;
 try{
 const [beforeSend]=await db.select().from(journeys).where(eq(journeys.owner,owner));
 if(!beforeSend||!sameAlertConsent(s,JSON.parse(beforeSend.data),c)){await db.update(deliveries).set({status:'취소',error:'안전 확인·알림 중지·연락처 변경으로 취소'}).where(eq(deliveries.id,id));continue;}
 const text=alertText(fresh);let response:Response;
 if(channel==='sms'){
 const sms=[`[여행안심] ${String(fresh.trip.name).slice(0,30)}님 24시간 안전 확인 미응답.`, `행선지: ${String(fresh.trip.destination).slice(0,80)}`,`연락처: ${String(fresh.trip.phone||'미등록').slice(0,30)}`,fresh.location?`위치 확인시각: ${fresh.location.acquiredAt||fresh.location.at}`:'',fresh.location?`마지막 위치: https://www.google.com/maps/search/?api=1&query=${fresh.location.lat},${fresh.location.lng}`:'마지막 위치 미등록','실종 확정 아님. 먼저 본인에게 연락해 주세요. 등록된 이메일 알림이 있다면 첨부 자료도 확인하세요.'].join('\n');
 response=await fetch('https://api.solapi.com/messages/v4/send-many/detail',{method:'POST',headers:{Authorization:await solapiAuth(config),'Content-Type':'application/json'},body:JSON.stringify({messages:[{to:recipient,from:config.smsFrom!.replace(/\D/g,''),country:'82',type:'LMS',text:sms}],allowDuplicates:false}),signal:AbortSignal.timeout(20000)});
 const j:any=await response.json();if(!response.ok||j.failedMessageList?.length||(!j.groupInfo?.groupId||!(j.groupInfo?.count?.registeredSuccess>0))){status='거절';error=`SOLAPI 요청 거절 (${response.status})`}else{status='업체 접수';providerId=j.groupInfo.groupId}
 }else{
 const attachments:any[]=[];const photoMetadata:any={};if(env.BUCKET)for(const kind of ['person','area']){const photo=await env.BUCKET.get(await photoKey(owner,kind));if(photo){photoMetadata[kind]={uploadedAt:photo.uploaded.toISOString(),size:photo.size};const ext=photo.httpMetadata?.contentType==='image/png'?'png':photo.httpMetadata?.contentType==='image/webp'?'webp':'jpg';attachments.push({filename:`${kind}.${ext}`,content:Buffer.from(await photo.arrayBuffer()).toString('base64')})}}
 const snapshot=reportSnapshot(fresh,photoMetadata);attachments.push({filename:'travel-report.txt',content:Buffer.from(text).toString('base64')});attachments.push({filename:'latest-travel-report.json',content:Buffer.from(JSON.stringify(snapshot,null,2)).toString('base64')});
 await paceEmail();
 const [afterPrepare]=await db.select().from(journeys).where(eq(journeys.owner,owner));if(!afterPrepare||!sameAlertConsent(s,JSON.parse(afterPrepare.data),c)){await db.update(deliveries).set({status:'취소',error:'자료 준비 중 안전 확인·알림/연락처 변경'}).where(eq(deliveries.id,id));continue;}
 response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.resendKey}`,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:config.emailFrom,to:[recipient],subject:'[여행안심] 24시간 미응답 · 안전 확인 필요',text:text+'\n\n자료 생성: '+snapshot.createdAt+'\n최신자료 업로드: '+(snapshot.dataUpdatedAt||'미기록')+'\n위치 상태: '+(snapshot.location?.freshness||'미등록')+'\n사진 업로드 시각: '+JSON.stringify(photoMetadata)+'\n첨부 자료는 서버에 마지막 업로드된 정보이며 실시간 휴대전화 조회 결과가 아닙니다.',attachments}),signal:AbortSignal.timeout(20000)});
 const j:any=await response.json();if(!response.ok||!j.id){status='거절';error=`Resend 요청 거절 (${response.status})`}else{status='업체 접수';providerId=j.id}
 }
 }catch{error='통신 결과 불명. 중복 방지를 위해 자동 재발송하지 않습니다. 업체 발송내역을 확인하세요.'}
 await db.update(deliveries).set({status,providerId,error}).where(eq(deliveries.id,id));attempts++;
 }}return {status:pending?'pending':unsupported?'partial':'processed',attempts,pending,unsupported,eligibleContacts:contacts.length,excludedContacts:s.contacts.length-contacts.length};
}
