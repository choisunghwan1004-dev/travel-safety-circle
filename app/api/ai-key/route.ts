import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {sealKey,validApiKey} from '../../../lib/key-crypto';
import {userKeyStatus} from '../../../lib/user-ai-key';
export const dynamic='force-dynamic';
const reply=(d:unknown,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
export async function GET(){const u=await getChatGPTUser();if(!u)return reply({error:'로그인이 필요합니다.'},401);return reply(await userKeyStatus(u.userId));}
export async function POST(req:Request){const u=await getChatGPTUser();if(!u)return reply({error:'로그인이 필요합니다.'},401);if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'잘못된 요청입니다.'},403);const raw=await req.text();if(raw.length>1500)return reply({error:'입력값이 너무 깁니다.'},413);let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'잘못된 요청입니다.'},400)}
 if(b?.action==='delete'){await env.DB!.prepare('DELETE FROM user_ai_keys WHERE owner=?').bind(u.userId).run();return reply({ready:false,deleted:true});}
 if(b?.action!=='save'||b?.consent!==true)return reply({error:'본인 비용 부담 및 키 보관 동의를 확인하세요.'},400);
 if(!env.USER_KEY_ENCRYPTION_SECRET)return reply({error:'서버의 보안 키 보관 설정이 준비되지 않았습니다. 관리자에게 문의하세요.'},503);
 const key=typeof b.key==='string'?b.key.trim():'';if(!validApiKey(key))return reply({error:'sk-로 시작하는 본인의 OpenAI API 키를 확인하세요.'},400);
 const sealed=await sealKey(key,u.userId,env.USER_KEY_ENCRYPTION_SECRET);const updatedAt=new Date().toISOString();
 await env.DB!.prepare('INSERT INTO user_ai_keys(owner,ciphertext,iv,last_four,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET ciphertext=excluded.ciphertext,iv=excluded.iv,last_four=excluded.last_four,updated_at=excluded.updated_at').bind(u.userId,sealed.ciphertext,sealed.iv,key.slice(-4),updatedAt).run();
 return reply({ready:true,lastFour:key.slice(-4),updatedAt});
}
