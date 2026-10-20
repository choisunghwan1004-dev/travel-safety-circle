import {getChatGPTUser} from '../../chatgpt-auth';
import {alertStatus} from '../../../lib/alerts';
export const dynamic='force-dynamic';
export async function GET(){const u=await getChatGPTUser();if(!u)return Response.json({error:'로그인이 필요합니다.'},{status:401});return Response.json(await alertStatus(u.userId),{headers:{'Cache-Control':'no-store'}});}
