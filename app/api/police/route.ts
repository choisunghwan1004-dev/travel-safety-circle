import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {claimBudget} from '../../../lib/service-budget';
import {policeCandidates} from '../../../lib/assist-rules';
export const dynamic='force-dynamic';
const reply=(d:unknown,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store'}});
const headers={'User-Agent':'TravelSafetyCircle/1.5 (+https://travel-safety-circle.leafytiger512.chatgpt.site)','Accept-Language':'ko,en'};
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return reply({error:'로그인이 필요합니다.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'잘못된 요청입니다.'},403);
 const raw=await req.text();if(raw.length>1500)return reply({error:'입력 내용이 너무 깁니다.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'잘못된 요청입니다.'},400)}
 if(b.consent!==true)return reply({error:'지도 검색 전송 동의가 필요합니다.'},400);
 const region=typeof b.region==='string'?b.region.trim():'';
 const point=b.point;const hasPoint=Number.isFinite(point?.lat)&&Number.isFinite(point?.lng)&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180;
 if(!hasPoint&&(!region||region.length>80))return reply({error:'시·구·동 지역 또는 위치를 확인하세요.'},400);
 if(!await claimBudget('map:'+u.userId,10000,30))return reply({error:'지도 검색은 10초에 1회·하루 30회까지 가능합니다.'},429);
 // Cache public regional lookups by hashed query; never include account, name or detailed home address.
 const query=hasPoint?`point:${point.lat.toFixed(2)},${point.lng.toFixed(2)}`:'region:'+region;
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(query)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const cached:any=await env.DB!.prepare('SELECT data FROM lookup_cache WHERE id=? AND expires_at>?').bind(hash,Date.now()).first();if(cached)return reply({...JSON.parse(cached.data),cached:true});
 if(!await claimBudget('map:global',1500,1000))return reply({error:'지도 서비스가 사용 중입니다. 잠시 후 다시 눌러 주세요.'},429);
 try{
 const base=env.GEOCODER_BASE_URL||'https://nominatim.openstreetmap.org';let lat:number,lng:number,area:string;
 if(hasPoint){lat=Number(point.lat.toFixed(2));lng=Number(point.lng.toFixed(2));const r=await fetch(`${base}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,{headers,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const v:any=await r.json();const a=v.address||{};area=[a.country,a.state,a.city||a.town||a.county,a.suburb||a.village].filter(Boolean).join(' ');if(!area)area=`${lat}, ${lng}`;
 }else{const r=await fetch(`${base}/search?format=jsonv2&limit=1&q=${encodeURIComponent(region)}`,{headers,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const v:any=await r.json();if(!v.length)return reply({error:'지역을 찾지 못했습니다. 국가·시·구·동을 더 정확히 입력하세요.'},404);lat=Number(v[0].lat);lng=Number(v[0].lon);area=String(v[0].display_name).slice(0,500);}
 if(!Number.isFinite(lat)||!Number.isFinite(lng))throw Error();
 const q=`[out:json][timeout:18];nwr["amenity"="police"](around:15000,${lat},${lng});out center tags;`;
 let candidates:any[]=[],warning='';try{const r=await fetch(env.OVERPASS_API_URL||'https://overpass-api.de/api/interpreter',{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:q}),signal:AbortSignal.timeout(22000)});if(!r.ok)throw Error();candidates=policeCandidates(await r.json(),lat,lng);}catch{warning='지역은 찾았지만 경찰서 검색이 지연되었습니다. 직접 입력하거나 나중에 다시 검색하세요.';}
 const result={area,lat,lng,candidates,warning,checkedAt:new Date().toISOString(),source:'OpenStreetMap',approximate:hasPoint};
 if(!warning){await env.DB!.prepare('DELETE FROM lookup_cache WHERE expires_at<?').bind(Date.now()).run();await env.DB!.prepare('INSERT OR REPLACE INTO lookup_cache(id,data,expires_at) VALUES(?,?,?)').bind(hash,JSON.stringify(result),Date.now()+86400000).run();}
 return reply(result);
 }catch{return reply({error:'공개 지도 검색을 완료하지 못했습니다. 직접 입력하거나 잠시 후 다시 시도하세요.'},502);}
}
