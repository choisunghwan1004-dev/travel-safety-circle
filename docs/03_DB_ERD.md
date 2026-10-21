# 여행안심 V1.8.1 · DB_ERD

최신 전체 스키마를 먼저 기록하고 기존 단계별 추가 이력을 보존합니다.

## 4. 현재 전체 스키마 (7개 테이블)

기준: 2026-10-21, db/schema.ts. D1/SQLite이며 모든 테이블에 물리 FK가 없습니다. 아래에서 ? 표시는 NULL 허용, 나머지 비-PK 컬럼은 NOT NULL입니다. owner의 계정 연결은 인증 로직으로 적용합니다.

| 테이블 | PK | 나머지 컬럼·타입 | 용도 |
|---|---|---|---|
| journeys | owner TEXT | data TEXT, revision INTEGER DEFAULT 0 | 여행·연락망·최신 위치 JSON·충돌 검사 |
| deliveries | id TEXT | owner/channel/recipient/status/created_at TEXT, provider_id/error TEXT? | 중복 방지·업체 요청 기록 |
| ai_usage | owner TEXT | day TEXT, count/last_at INTEGER | UTC 일별 AI 호출 제한 |
| lookup_cache | id TEXT | data TEXT, expires_at INTEGER | 공개 검색 결과 해시 캐시 |
| user_ai_keys | owner TEXT | ciphertext/iv/last_four/updated_at TEXT | 본인 AI 키 암호화 |
| notification_settings | owner TEXT | ciphertext/iv/updated_at TEXT | 본인 발송 설정 암호화 |
| alert_monitors | owner TEXT | last_at/result TEXT | 본인 최근 점검 기록 |

전체 관계: journeys의 owner와 deliveries·ai_usage·user_ai_keys·notification_settings·alert_monitors의 owner는 논리적으로 연결되며 SQL FK가 아닙니다. lookup_cache는 공개 검색어 해시를 사용하는 별도 캐시입니다. 아래 ERD는 기본 여행/발송 관계를 나타내고, 이후 버전별 항목은 추가 이력입니다.

```mermaid
erDiagram
  JOURNEYS ||..o{ DELIVERIES : "owner 논리 연결, 물리 FK 없음"
  JOURNEYS {
    text owner PK
    text data
    integer revision
  }
  DELIVERIES {
    text id PK
    text owner
    text channel
    text recipient
    text status
    text created_at
    text provider_id
    text error
  }
```

`data` 내부 항목: `trip`, `contacts[]`, `events[]`, `location`, `status`, `lastCheck`, `lastAutoLocationAt`, `alertsEnabled`, `dataUpdatedAt`. 연락처 배열의 `id`는 논리 식별자이며 SQL의 PK/FK가 아닙니다. 이름·전화·이메일·동의·중복은 서버에서 검사합니다. 현 스키마에 물리 FK·JSON 내부 NOT NULL·CHECK가 있다고 표현하지 않습니다.

사진은 R2에 `photos/{사용자ID의 SHA-256}/{person|area}` 형태로 저장하며 최신 파일로 교체합니다. 사진은 별도 SQL 테이블이 아닙니다. 현재 위치도 최신 한 건이며 좌표 이력을 계속 축적하는 테이블은 없습니다.

실제 스키마: `db/schema.ts`, `drizzle/0000_thick_young_avengers.sql`, `drizzle/0001_wakeful_black_cat.sql`.

## V1.4 추가: AI 요청 횟수 제한

운영 V1.3의 두 테이블에 더하여 소스 V1.4에는 `ai_usage`가 추가되었습니다. 배포 전 마이그레이션은 `drizzle/0002_ai_usage.sql`입니다.

| 컬럼 | 타입 | 제약 | 목적 |
|---|---|---|---|
| owner | TEXT | PK, NOT NULL | 인증된 계정 식별자 |
| day | TEXT | NOT NULL | UTC 날짜 |
| count | INTEGER | NOT NULL | 당일 요청 수 |
| last_at | INTEGER | NOT NULL | 마지막 요청 시각(ms) |

`journeys.owner`와 논리적으로 연결되며 물리 FK는 없습니다. 원문·생성 결과·API 키는 저장하지 않습니다. 사용자 자료 전체 삭제와 별개로 요청 제한 기록은 유지됩니다. 1분 1회·하루 20회 제한은 원자적 SQL에서 적용합니다.

## V1.5 보완 — 2026-10-21
lookup_cache(id TEXT PK, data TEXT NOT NULL, expires_at INTEGER NOT NULL) 추가. 검색어는 해시로 식별하고 공개 지역·경찰시설 결과를 24시간 사용합니다. 물리 FK는 없습니다. 마이그레이션 0003_late_lockheed.sql과 0003_snapshot.json 참조. 자세한 전체 흐름은 `10_간편자동입력_검수.md`에 기록했습니다.

## V1.6 본인 AI 키
user_ai_keys 테이블 추가: owner TEXT PK, ciphertext TEXT NOT NULL, iv TEXT NOT NULL, last_four TEXT NOT NULL, updated_at TEXT NOT NULL. 물리 FK 없음. 0004_old_queen_noir.sql 적용. API 키 평문은 보관하지 않으며 보안 환경변수의 별도 마스터키로 AES-GCM 암호화한다. 자세한 처리·삭제 범위는 docs/11 참조.

### V1.7 추가 테이블

- notification_settings: owner PK, ciphertext, iv, updated_at. 개인 발송 설정을 암호화 보관합니다.
- alert_monitors: owner PK, last_at, result. 개인 점검 시각과 처리 상태를 저장합니다.
- 0005 마이그레이션은 신규 두 테이블만 생성합니다. 기존 마이그레이션은 유지합니다.
