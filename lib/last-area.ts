export function gpsArea(p:any){return Number.isFinite(p?.lat)&&Number.isFinite(p?.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180?`휴대전화 GPS ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`:'';}
export function synchronizeLastArea(s:any){
 const label=gpsArea(s?.location);if(!label||!s?.trip)return s;
 const at=s.location.acquiredAt||s.location.at;
 // A regional name belongs to its acquisition time, never to a later GPS fix.
 if(!s.trip.lastArea||!at||s.trip.lastAreaLocationAt!==at){s.trip.lastArea=label;s.trip.lastAreaLocationAt=at||'';}
 return s;
}
