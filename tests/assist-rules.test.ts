import assert from 'node:assert/strict';
import {cleanFlight,flightRequest,policeCandidates,validDate} from '../lib/assist-rules.ts';
assert(!validDate('2026-02-30'));assert(validDate('2028-02-29'));
const f=cleanFlight({ticketName:'TEST PERSON',flightNumber:'KE001',seat:'12A',flightDate:'2026-02-30',departureTime:'27:00',arrivalDate:null,bookingReference:'SECRET',warnings:['연도 없음',123]});
assert.equal(f.fields.seat,'12A');assert(!('flightDate' in f.fields));assert(!('bookingReference' in f.fields));assert.deepEqual(f.warnings,['연도 없음']);
const q=flightRequest('data:image/jpeg;base64,/9j/AAAA');assert.equal(q.store,false);assert.equal(q.input[0].content[1].type,'input_image');assert.equal(q.text.format.strict,true);
const p=policeCandidates({elements:[{type:'node',id:1,lat:37.01,lon:127,tags:{name:'먼 곳',phone:'02-123-4567'}},{type:'way',id:2,center:{lat:37.001,lon:127},tags:{name:'가까운 곳'}},{type:'node',id:3,tags:{name:'좌표 없음'}}]},37,127);
assert.equal(p[0].name,'가까운 곳');assert.equal(p[0].phone,'');assert.equal(p.length,2);assert.equal(p[1].source,'https://www.openstreetmap.org/node/1');
console.log('PASS ticket fields, invalid date/time rejection, police distance and missing phone');
