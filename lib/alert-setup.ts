import {contactValid} from './alert-rules.ts';
export function applyAlertDefault(s:any){
 if(s.alertPreference===undefined&&s.events?.some((e:any)=>e.text==='자동 알림 중지'))s.alertPreference='off';
 // An explicit stop is durable; defaults only arm a setup being saved by its owner.
 if(s.alertPreference!=='off'&&s.trip&&s.status!=='귀가 완료'&&s.contacts?.some((c:any)=>contactValid(c)&&['가족','친구'].includes(c.relation))){s.alertsEnabled=true;s.alertPreference='on';}
 return s;
}
