'use client';
import {useState} from 'react';
import {policeEmergency,telephoneHref} from '../lib/emergency';
export default function EmergencyLinks({trip}:{trip:any}){
 const [country,setCountry]=useState('');const p=policeEmergency(country||trip?.country);
 return <div className="assist-box"><h3>긴급 경찰 전화</h3><label>현재 통화할 국가 · 실제 체류 국가를 확인하세요<select value={country||trip?.country||''} onChange={e=>setCountry(e.target.value)}><option value="">국가 선택</option><option value="대한민국">한국 · 경찰 112</option><option value="일본">일본 · 경찰 110</option><option value="기타">다른 국가 · 공식 번호 직접 확인</option></select></label>{p?<a className="danger" href={'tel:'+p.number}>{p.country} 경찰 {p.number} 전화하기</a>:<p>한국에서는 112, 일본에서는 110입니다. 현재 있는 국가를 선택하세요.</p>}<p className="muted">일본 경찰은 100이 아닌 110입니다. 국가 선택은 여행 국가를 기본으로 표시하며 실제 현재 국가를 자동 확인한 결과는 아닙니다. 전화 앱에서 통화를 실행하세요. 해외에서 한국의 관할 경찰서에 연락하려면 해당 경찰서의 국제전화 가능한 번호를 사용하세요.</p><div className="actions">{telephoneHref(trip?.police)&&<a className="secondary" href={telephoneHref(trip.police)!}>{trip.policeName||'등록한 현지 경찰서'} 전화</a>}{telephoneHref(trip?.homePolicePhone)&&<a className="secondary" href={telephoneHref(trip.homePolicePhone)!}>{trip.homePolice||'집 근처 경찰서'} 전화</a>}</div></div>;
}
