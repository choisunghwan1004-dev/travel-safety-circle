export const LOCATION_INTERVAL_MS=2*60*60*1000;
export function isTravelActive(s:any,now=Date.now()){
 const start=Date.parse((s?.trip?.start||'')+'T00:00:00+09:00');
 const end=Date.parse((s?.trip?.end||'')+'T00:00:00+09:00')+24*60*60*1000;
 return !!s?.trip&&s.status!=='귀가 완료'&&now>=start&&now<end;
}
export function locationSaveDue(s:any,now=Date.now()){
 const previous=Date.parse(s?.lastAutoLocationAt);
 return isTravelActive(s,now)&&(!Number.isFinite(previous)||now-previous>=LOCATION_INTERVAL_MS);
}
