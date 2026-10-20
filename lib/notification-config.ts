import {env} from 'cloudflare:workers';
import {sealKey,openKey} from './key-crypto';
export type NotifyConfig={resendKey?:string;emailFrom?:string;solapiKey?:string;solapiSecret?:string;smsFrom?:string};
export async function notificationConfig(owner:string):Promise<NotifyConfig>{
 const base={resendKey:env.RESEND_API_KEY,emailFrom:env.ALERT_EMAIL_FROM,solapiKey:env.SOLAPI_API_KEY,solapiSecret:env.SOLAPI_API_SECRET,smsFrom:env.SOLAPI_FROM};
 const row:any=await env.DB!.prepare('SELECT ciphertext,iv FROM notification_settings WHERE owner=?').bind(owner).first();
 if(!row)return base;
 if(!env.USER_KEY_ENCRYPTION_SECRET)return {};
 try{return JSON.parse(await openKey(row,owner+':notifications',env.USER_KEY_ENCRYPTION_SECRET))}catch{return {}}
}
export async function saveNotificationConfig(owner:string,config:NotifyConfig){
 if(!env.USER_KEY_ENCRYPTION_SECRET)throw Error('암호화 보관 설정이 없습니다.');
 const sealed=await sealKey(JSON.stringify(config),owner+':notifications',env.USER_KEY_ENCRYPTION_SECRET);
 await env.DB!.prepare('INSERT INTO notification_settings(owner,ciphertext,iv,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET ciphertext=excluded.ciphertext,iv=excluded.iv,updated_at=excluded.updated_at').bind(owner,sealed.ciphertext,sealed.iv,new Date().toISOString()).run();
}
export function readyChannels(c:NotifyConfig){return {sms:!!(c.solapiKey&&c.solapiSecret&&c.smsFrom),email:!!(c.resendKey&&c.emailFrom)};}
export async function monitorStatus(owner:string){const row:any=await env.DB!.prepare('SELECT last_at,result FROM alert_monitors WHERE owner=?').bind(owner).first();return {lastRunAt:row?.last_at||null,lastResult:row?.result||null,recent:!!row&&Date.now()-Date.parse(row.last_at)<3*3600000};}
export async function recordMonitor(owner:string,result:string){await env.DB!.prepare('INSERT INTO alert_monitors(owner,last_at,result) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET last_at=excluded.last_at,result=excluded.result').bind(owner,new Date().toISOString(),result).run();}
