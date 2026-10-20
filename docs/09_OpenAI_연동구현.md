# OpenAI 연동 구현 (V1.4 준비)

## 상태
서버 API와 신고자료 화면의 한국어 정리·영어/일본어 번역 UI 구현 완료. 보안 키 연결, 실 API 응답 검증, 배포는 대기 중이다. 모의 응답 검증을 실제 API 성공으로 간주하지 않는다. 기존 공개 서비스는 V1.3 그대로다.

## 호출
- 인증된 본인만 GET/POST `/api/ai` 사용. POST는 동일 Origin, 명시적 전송 동의, 원본 revision 일치가 필요하다.
- 서버의 본인 여행을 읽는다. 클라이언트 제공 원문·모델·외부 URL을 받지 않는다.
- `https://api.openai.com/v1/responses`, 모델 `gpt-6-luna`, `store:false`, strict JSON schema, 출력 2,500 토큰, 60초 제한. 자동 재시도 없음.
- 전송 필드: 이름, 목적지, 여행 날짜, 예정 경로, 숙소, 교통, 인상착의, 등록 추정 지역, 마지막 안전 확인, 자료 수정시각, 마지막 저장 좌표·정확도·취득/업로드 시각.
- 연락망, 전화번호 별도 필드, 집 주소, 사진, 메모, 계정 ID는 제외한다. 허용 필드에 사용자가 직접 기재한 개인정보는 포함될 수 있음을 화면에서 알린다.
- 예정 경로와 마지막 저장 위치를 구분하도록 지시한다. 실종 확정·위험 판정·기관 신고·연락처 추정은 하지 않는다. AI 결과에는 오류가 있을 수 있어 사람이 원본과 대조한다.
- 결과는 화면 메모리에만 보관하고 원본 수정 시 제거한다. 자동 알림·신고·원본 PDF에 AI 초안을 섞지 않는다.

## 비용·오류
D1 `ai_usage`에 계정 ID, UTC 날짜, 요청 수, 마지막 요청시각만 보관한다. 단일 원자적 upsert로 1분 1회/하루 20회 제한. 실패 호출도 횟수에 포함한다. 이 기록은 자료 원문이나 생성 결과를 포함하지 않는다. 전체 시스템 비용 상한은 OpenAI 프로젝트 예산 설정이 별도로 필요하다.
키 미설정은 503, 동의 누락 400, 다른 Origin 403, 자료 변경 409, 제한 초과 429. 외부 오류·불완전 응답·거절·파싱 실패는 초안으로 표시하지 않는다. 원본 자료 기능은 계속 사용할 수 있다.

## 연결 및 배포
1. 사용자 선택: 지금은 키 없이 연동 코드만 준비하고 실제 키는 나중에 입력한다. 로컬은 `.dev.vars.example`을 `.dev.vars`로 복사하여 `OPENAI_API_KEY`를 설정하고 재시작한다. 현재 구성은 `.env`를 직접 읽지 않는다. 키를 채팅·소스·README에 적지 않는다. 호스팅 보안 키 연결이 필요할 때 OpenAI Developers의 보안 절차를 이용할 수 있다.
2. Sites의 서버 비밀값 `OPENAI_API_KEY`에 설정한다. 로컬 개발 시에만 무시된 `.dev.vars`를 사용한다. `.dev.vars.example`은 빈 이름만 제공한다.
3. 마이그레이션 `drizzle/0002_ai_usage.sql`을 적용하여 배포한다.
4. 가상 여행 자료로 한국어/영어/일본어 각각 실호출을 검증하고 결과와 날짜를 기록한다. 실제 사용자 위치를 테스트에 쓰지 않는다.
5. 실제 요청의 모델 접근 권한·비용·오류를 확인한 후 연결 완료로 표시한다.

## 검증
`node --experimental-strip-types tests/openai-report.test.ts`: 제외 필드, 요청 형식, 정상/불완전/거절/잘못된 응답 처리.
`node node_modules/typescript/bin/tsc --noEmit`: 타입 검사.
기존 alert-rules/location-rules 테스트: 24시간 알림·2시간 위치 기능 회귀 확인.
실 API: 아직 미검증(보안 키 미연결).

## 공식 문서
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/reference/resources/responses/methods/create
