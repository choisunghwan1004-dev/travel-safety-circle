import {getChatGPTUser} from '../../chatgpt-auth';
import {alertStatus,scanOwner} from '../../../lib/alerts';
export const dynamic='force-dynamic';
export async function GET(){const u=await getChatGPTUser();if(!u)return Response.json({error:'로그인이 필요합니다.'},{status:401});return Response.json(await alertStatus(u.userId),{headers:{'Cache-Control':'no-store'}});}

export async function POST(req:Request){const u=await getChatGPTUser();if(!u)return Response.json({error:'로그인이 필요합니다.'},{status:401});if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'잘못된 요청입니다.'},{status:403});return Response.json(await scanOwner(u.userId),{headers:{'Cache-Control':'no-store'}});}
