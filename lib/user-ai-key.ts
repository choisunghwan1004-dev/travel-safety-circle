import {env} from 'cloudflare:workers';
import {openKey} from './key-crypto';
export async function userKeyStatus(owner:string){const row:any=await env.DB!.prepare('SELECT last_four,updated_at FROM user_ai_keys WHERE owner=?').bind(owner).first();return {ready:!!row&&!!env.USER_KEY_ENCRYPTION_SECRET,storageReady:!!env.USER_KEY_ENCRYPTION_SECRET,lastFour:row?.last_four||null,updatedAt:row?.updated_at||null};}
export async function userOpenAIKey(owner:string){if(!env.USER_KEY_ENCRYPTION_SECRET)return null;const row:any=await env.DB!.prepare('SELECT ciphertext,iv FROM user_ai_keys WHERE owner=?').bind(owner).first();if(!row)return null;try{return await openKey(row,owner,env.USER_KEY_ENCRYPTION_SECRET)}catch{return null;}}
