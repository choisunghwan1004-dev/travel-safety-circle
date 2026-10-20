import {userOpenAIKey,userKeyStatus} from '../../../lib/user-ai-key';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {claimBudget} from '../../../lib/service-budget';
import {cleanFlight,flightRequest,outputObject} from '../../../lib/assist-rules';
export const dynamic='force-dynamic';
const reply=(d:unknown,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return reply({error:'로그인이 필요합니다.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'잘못된 요청입니다.'},403);
 const apiKey=await userOpenAIKey(u.userId);if(!apiKey)return reply({error:'사진 읽기는 본인 API 키 등록 후 사용 가능합니다. AI 설정에서 비용 안내를 확인하세요.'},503);
 if(Number(req.headers.get('content-length'))>2200000)return reply({error:'사진 용량이 큽니다.'},413);
 const raw=await req.text();if(raw.length>2200000)return reply({error:'사진 용량이 큽니다.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'잘못된 요청입니다.'},400)}
 if(b?.consent!==true||typeof b.image!=='string'||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(b.image))return reply({error:'사진과 전송 동의를 확인하세요.'},400);
 if(!await claimBudget(u.userId))return reply({error:'AI 기능은 합산 1분 1회·하루 20회까지 사용 가능합니다.'},429);
 try{const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(flightRequest(b.image)),signal:AbortSignal.timeout(60000)});if(!r.ok)return reply({error:'사진을 읽지 못했습니다. AI 설정에서 본인 OpenAI 키·잔액·모델 권한을 확인하세요.'},502);const result=cleanFlight(outputObject(await r.json()));if(!Object.keys(result.fields).length)return reply({error:'탑승권 항목을 찾지 못했습니다. 글자가 선명하게 나오도록 다시 촬영하거나 직접 입력하세요.'},422);return reply({...result,readAt:new Date().toISOString()});}catch{return reply({error:'사진 인식이 지연되거나 응답이 올바르지 않습니다. 다시 촬영하거나 직접 입력하세요.'},502);}
}
