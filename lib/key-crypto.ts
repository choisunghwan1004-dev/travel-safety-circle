const enc=new TextEncoder();
const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const base64=(b:Uint8Array)=>btoa(String.fromCharCode(...b));
async function master(secret:string){if(!/^[a-f0-9]{64}$/i.test(secret))throw Error('key storage unavailable');return crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g)!,x=>parseInt(x,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function sealKey(value:string,owner:string,secret:string){const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('travel-safety:user-key:'+owner)},await master(secret),enc.encode(value));return {iv:base64(iv),ciphertext:base64(new Uint8Array(ciphertext))};}
export async function openKey(row:{iv:string;ciphertext:string},owner:string,secret:string){const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(row.iv),additionalData:enc.encode('travel-safety:user-key:'+owner)},await master(secret),bytes(row.ciphertext));return new TextDecoder().decode(raw);}
export function validApiKey(k:unknown):k is string{return typeof k==='string'&&/^sk-[A-Za-z0-9_-]{20,490}$/.test(k);}
