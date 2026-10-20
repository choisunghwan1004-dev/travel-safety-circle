export function validPoint(p:any){return Number.isFinite(p?.lat)&&Number.isFinite(p?.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;}
// Planned destinations and home regions must never silently become the traveler's GPS.
export async function resolveSearchPoint(where:string,draft:any,saved:any,capture:()=>Promise<any>){
 if(where==='destination'||where==='home')return {point:undefined,captured:false};
 if(where==='last'){
  const candidates=[draft,saved].filter(validPoint).sort((a,b)=>(Date.parse(b.acquiredAt||b.at)||0)-(Date.parse(a.acquiredAt||a.at)||0));
  if(candidates.length)return {point:candidates[0],captured:false};
 }
 const point=await capture();
 if(!validPoint(point))throw Error('GPS 좌표가 올바르지 않습니다. 다시 선택하세요.');
 return {point,captured:true};
}
