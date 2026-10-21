import {applyAlertDefault} from '../../../lib/alert-setup';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {notificationConfig,saveNotificationConfig,readyChannels,monitorStatus} from '../../../lib/notification-config';
import {validateNotificationInput} from '../../../lib/notification-rules';
export const dynamic='force-dynamic';
const reply=(d:unknown,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store'}});
export async function GET(){const u=await getChatGPTUser();if(!u)return reply({error:'로그인이 필요합니다.'},401);return reply({ready:readyChannels(await notificationConfig(u.userId)),monitor:await monitorStatus(u.userId),storageReady:!!env.USER_KEY_ENCRYPTION_SECRET});}
export async function POST(req:Request){const u=await getChatGPTUser();if(!u)return reply({error:'로그인이 필요합니다.'},401);if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'잘못된 요청입니다.'},403);const raw=await req.text();if(raw.length>2000)return reply({error:'입력이 너무 깁니다.'},413);let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'잘못된 요청입니다.'},400)}
 try{const config=await notificationConfig(u.userId);
 if(b.action==='delete'){
 if(b.channel==='email'){delete config.resendKey;delete config.emailFrom}else if(b.channel==='sms'){delete config.solapiKey;delete config.solapiSecret;delete config.smsFrom}else return reply({error:'채널을 선택하세요.'},400);
 }else if(b.action==='save'&&b.consent===true)Object.assign(config,validateNotificationInput(b));else return reply({error:'키 보관과 발송 비용 및 개인정보 전달 동의를 확인하세요.'},400);
 await saveNotificationConfig(u.userId,config);
 // Compare-and-swap: never overwrite a concurrent check-in or explicit stop.
 let armed=false;
 if(b.action==='save')for(let attempt=0;attempt<3;attempt++){
 const row:any=await env.DB!.prepare('SELECT data,revision FROM journeys WHERE owner=?').bind(u.userId).first();if(!row)break;
 const state=JSON.parse(row.data);applyAlertDefault(state);
 const result=await env.DB!.prepare('UPDATE journeys SET data=?,revision=revision+1 WHERE owner=? AND revision=?').bind(JSON.stringify(state),u.userId,row.revision).run();
 if(result.meta.changes){armed=state.alertsEnabled===true;break;}
 }
 return reply({ready:readyChannels(config),armed});
 }catch(e:any){return reply({error:e.message||'설정을 저장하지 못했습니다.'},400)}
}
