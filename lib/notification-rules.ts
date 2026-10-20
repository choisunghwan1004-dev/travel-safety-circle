export function validateNotificationInput(b:any){
 const config:any={};
 if(b.channel==='email'){
 if(typeof b.key!=='string'||!/^re_[A-Za-z0-9_-]{10,200}$/.test(b.key.trim()))throw Error('Resend API 키를 확인하세요.');
 if(typeof b.from!=='string'||b.from.length>200||/[\r\n]/.test(b.from)||!/^([^<>]+ <)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(b.from.trim()))throw Error('인증된 발신 이메일을 입력하세요.');
 config.resendKey=b.key.trim();config.emailFrom=b.from.trim();
 }else if(b.channel==='sms'){
 if(typeof b.key!=='string'||!/^\S{10,200}$/.test(b.key)||typeof b.secret!=='string'||!/^\S{10,200}$/.test(b.secret))throw Error('SOLAPI 키와 비밀키를 확인하세요.');
 const from=String(b.from||'').replace(/[ -]/g,'');if(!/^0\d{8,10}$/.test(from))throw Error('SOLAPI에 등록한 국내 발신번호를 입력하세요.');
 config.solapiKey=b.key;config.solapiSecret=b.secret;config.smsFrom=from;
 }else throw Error('발송 채널을 선택하세요.');
 return config;
}
export function enabledChannels(ready:{sms:boolean;email:boolean}){return (['sms','email'] as const).filter(c=>ready[c]);}
export function eligibleContact(c:any){return c?.consent===true&&['가족','친구'].includes(c.relation);}
