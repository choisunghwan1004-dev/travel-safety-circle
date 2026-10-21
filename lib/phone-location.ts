export function locationError(e:any){return e?.code===1?'위치 접근이 차단되었습니다. 휴대전화 설정에서 브라우저와 이 사이트의 위치 접근·정확한 위치를 허용한 뒤 다시 눌러 주세요.':e?.code===3?'위치 수신 시간이 초과되었습니다. 휴대전화 위치 서비스를 켜고 창가나 실외에서 다시 시도하세요.':'휴대전화 위치를 확인하지 못했습니다. GPS·위치 서비스와 인터넷 연결을 확인하세요.';}
export function phoneLocation(geo:Geolocation|undefined):Promise<GeolocationPosition>{
 if(!geo)return Promise.reject(Error('이 브라우저는 위치 기능을 제공하지 않습니다. Safari 또는 Chrome에서 HTTPS 사이트를 직접 열어 주세요.'));
 return new Promise((resolve,reject)=>geo.getCurrentPosition(resolve,e=>reject(Error(locationError(e))),{enableHighAccuracy:true,timeout:25000,maximumAge:0}));
}
