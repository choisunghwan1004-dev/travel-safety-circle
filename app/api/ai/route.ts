import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {journeys} from '../../../db/schema';
import {eq} from 'drizzle-orm';
import {AI_MODEL,aiSource,languages,responseRequest,parseResponse,type Language} from '../../../lib/openai-report';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){if(!await getChatGPTUser())return reply({error:'로그인이 필요합니다.'},401);return reply({ready:!!env.OPENAI_API_KEY,model:AI_MODEL});}
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return reply({error:'로그인이 필요합니다.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'잘못된 요청입니다.'},403);
 const raw=await req.text();if(raw.length>1000)return reply({error:'요청이 너무 큽니다.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'잘못된 요청입니다.'},400)}
 if(b.consent!==true||!Object.hasOwn(languages,b.language))return reply({error:'전송 동의와 언어를 확인하세요.'},400);
 if(!env.OPENAI_API_KEY)return reply({error:'OpenAI 보안 키 연결이 필요합니다. 현재 실제 생성은 사용할 수 없습니다.'},503);
 const [row]=await getDb().select().from(journeys).where(eq(journeys.owner,u.userId));
 if(!row)return reply({error:'여행을 먼저 등록하세요.'},400);
 if(b.revision!==row.revision)return reply({error:'자료가 변경되었습니다. 새로고침 후 다시 생성하세요.'},409);
 const s=JSON.parse(row.data);if(!s.trip)return reply({error:'여행을 먼저 등록하세요.'},400);
 // Durable atomic budget, shared across tabs and Worker instances. Failed calls also count.
 const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
 const claim=await env.DB!.prepare(`INSERT INTO ai_usage(owner,day,count,last_at) VALUES(?,?,1,?) ON CONFLICT(owner) DO UPDATE SET day=excluded.day,count=CASE WHEN ai_usage.day=excluded.day THEN ai_usage.count+1 ELSE 1 END,last_at=excluded.last_at WHERE ai_usage.last_at<=? AND (ai_usage.day<>excluded.day OR ai_usage.count<20) RETURNING owner`).bind(u.userId,day,now,now-60000).first();
 if(!claim)return reply({error:'1분에 1회, 하루 20회까지 생성할 수 있습니다. 잠시 후 다시 시도하세요.'},429);
 const source=aiSource(s);if(JSON.stringify(source).length>25000)return reply({error:'여행 자료가 너무 길어 생성할 수 없습니다.'},413);
 try{
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(responseRequest(source,b.language as Language)),signal:AbortSignal.timeout(60000)});
  if(!r.ok)return reply({error:r.status===429?'OpenAI 사용 한도에 도달했습니다. 나중에 다시 시도하세요.':'OpenAI 요청을 완료하지 못했습니다. 관리자에게 키·모델 권한을 확인해 달라고 요청하세요.'},502);
  const output=parseResponse(await r.json());
  return reply({...output,model:AI_MODEL,createdAt:new Date().toISOString(),sourceUpdatedAt:s.dataUpdatedAt||null,revision:row.revision});
 }catch{return reply({error:'AI 응답이 지연되었거나 올바르지 않습니다. 원본 신고자료를 사용하거나 나중에 다시 시도하세요.'},502);}
}
