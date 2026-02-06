# Blackbox Backend 설계서

CCTV 카메라의 영상을 실시간으로 녹화하고, AI 객체 감지 결과를 저장하며, 이벤트 규칙에 따라 알림을 발생시키는 백엔드 서버입니다.

블랙박스처럼 영상을 계속 저장하고, AI가 분석한 결과(사람, 차량 등)를 기록하며, 사용자가 정의한 조건(예: 사람이 5명 이상)에 맞으면 이벤트를 발생시킵니다.

---

## 주요 구성 요소

### 1. Camera Manager (카메라 관리자)
**위치**: `internal/server/handler_camera.go`

카메라를 등록하고 관리하며, FFmpeg 프로세스를 시작/중지합니다.

- 카메라 설정을 JSON 파일로 저장 (`data/cameras/{camera_id}.json`)
- 각 카메라마다 RTSP URL, WebRTC URL, FFmpeg 옵션 설정
- 이벤트 규칙(Event Rule)을 카메라별로 관리
- FFmpeg 프로세스 생성 및 종료 제어

**파일 구조**:
```
data/cameras/
├── cam1.json          # 카메라1 설정
├── cam2.json          # 카메라2 설정
└── ...
```

---

### 2. FFmpeg Runner (영상 녹화기)
**위치**: `internal/ffmpeg/runner.go`

IP 카메라에서 RTSP 스트림을 받아서 DASH 형식으로 저장합니다.

- 카메라 연결 → 영상 수신 → 세그먼트로 분할 저장
- 저장 형식: DASH (웹에서 바로 재생 가능)
- 파일명 예시: `chunk-stream0-00001.m4s`

**동작 과정**:
1. 카메라 활성화 시 FFmpeg 프로세스 시작
2. RTSP 스트림을 DASH 세그먼트로 변환
3. `{camera_id}/in/` 폴더에 저장
4. Watcher가 파일 완성 감지

---

### 3. Watcher (파일 감시자)
**위치**: `internal/watcher/watcher.go`

FFmpeg이 생성한 영상 파일을 감지하고 DB에 메타정보를 저장합니다.

- 카메라 설정 파일 직접 읽기 (config 의존성 제거)
- 테이블 ↔ 카메라 ID 자동 매핑
- 파일 생성 감지 → DB 저장 → 파일 이동
- 여러 카메라가 같은 테이블 공유 가능

**동작 과정**:
1. `{camera_id}/in/` 폴더 감시
2. 새 영상 파일 감지
3. Machbase에 메타정보 저장 (시간, 크기, 길이 등)
4. `{camera_id}/out/`으로 이동

---

### 4. Event Rule Engine (이벤트 규칙 엔진)
**위치**: `internal/server/handler_camera.go` (evaluateEventRules)

AI 감지 결과를 기반으로 사용자 정의 규칙을 평가합니다.

- DSL(Domain Specific Language)로 규칙 작성
- 예: `person > 5 AND car >= 2` (사람 5명 초과 & 차량 2대 이상)
- 1초마다 규칙 평가
- 조건 만족 시 이벤트 발생

**규칙 모드**:
- `ALL_MATCHES`: 매 초마다 평가 결과 저장
- `EDGE_ONLY`: 상태 변화 시점만 저장 (0→1, 1→0)

---

### 5. MediaMTX Controller (미디어 서버 컨트롤러)
**위치**: `internal/mediamtx/runner.go`

MediaMTX 미디어 서버를 실행하고 관리합니다.

- 로컬 MediaMTX 서버 시작/중지
- 외부 서버 연결 테스트
- 프로세스 상태 모니터링
- HTTP API를 통한 서버 정보 조회

---

### 6. HTTP Server (API 서버)
**위치**: `internal/server/server.go`

외부에서 카메라, 영상, 센서, 이벤트 규칙을 관리할 수 있는 REST API 제공

**표준 응답 형식**:
```json
{
  "success": true,
  "reason": "success",
  "elapse": "10.5ms",
  "data": { ... }
}
```

---

### 7. Machbase Client (데이터베이스 연결)
**위치**: `internal/db/machbase*.go`

Machbase 시계열 데이터베이스와 연동하여 데이터 저장/조회

**주요 테이블**:
- `blackbox3` - 영상 청크 메타정보
- `sensor3` - 센서 데이터
- `{camera}_log` - AI 감지 결과 (OR_LOG)
- `camera_event` - 이벤트 발생 기록 (EventLog)

---

## 제공하는 API

### 📹 카메라 관리
| API | 설명 | 예시 |
|-----|------|------|
| `POST /api/camera` | 카메라 생성 | table, name, rtsp_url 등 |
| `GET /api/camera/:id` | 카메라 정보 조회 | 설정, 이벤트 규칙 포함 |
| `POST /api/camera/:id` | 카메라 정보 수정 | rtsp_url, 옵션 변경 |
| `DELETE /api/camera/:id` | 카메라 삭제 | 설정 파일 삭제 |
| `POST /api/camera/:id/enable` | 카메라 활성화 | FFmpeg 프로세스 시작 |
| `POST /api/camera/:id/disable` | 카메라 비활성화 | FFmpeg 프로세스 종료 |
| `GET /api/camera/:id/status` | 카메라 상태 조회 | 실행중 여부, PID, 가동시간 |
| `GET /api/cameras` | 카메라 목록 | cam1, cam2, ... |
| `GET /api/cameras/health` | 전체 카메라 상태 | 실행중/중지 대수 |

### 📋 이벤트 규칙
| API | 설명 | 예시 |
|-----|------|------|
| `GET /api/event_rule/:camera_id` | 규칙 목록 조회 | 카메라의 모든 규칙 |
| `POST /api/event_rule` | 규칙 추가 | camera_id, rule 정보 |
| `POST /api/event_rule/:camera_id/:rule_id` | 규칙 수정 | name, expression, mode 등 |
| `DELETE /api/event_rule/:camera_id/:rule_id` | 규칙 삭제 | 규칙 제거 |

### 🎥 영상 조회
| API | 설명 | 예시 |
|-----|------|------|
| `GET /api/get_time_range` | 녹화 시간 범위 | 10:00 ~ 18:00 |
| `GET /api/get_chunk_info` | 특정 시간 영상 정보 | 크기, 길이 등 |
| `GET /api/v_get_chunk` | 실제 영상 다운로드 | 바이너리 데이터 |
| `GET /api/get_camera_rollup_info` | 시간대별 집계 | 1시간 단위 데이터 크기 |

### 📊 센서 데이터
| API | 설명 | 예시 |
|-----|------|------|
| `GET /api/sensors` | 센서 목록 | sensor-1, sensor-2 |
| `GET /api/sensor_data` | 센서 측정값 | 시간별 온도, 습도 등 |

### 🤖 AI 결과
| API | 설명 | 예시 |
|-----|------|------|
| `POST /api/ai/result` | AI 감지 결과 업로드 | person: 3, car: 2 |

---

## 설정 파일 구조

### config.yaml
```yaml
# 웹서버 설정
server:
  addr: "0.0.0.0:8000"
  data_dir: "/data"
  camera_dir: "/data/cameras"
  mvs_dir: "/data/mvs"

# 데이터베이스 설정
machbase:
  host: "127.0.0.1"
  port: 5654
  user: "sys"
  password: "manager"

# FFmpeg 설정
ffmpeg:
  binary: "/usr/local/bin/ffmpeg"
```

### 카메라 설정 파일 (data/cameras/cam1.json)
```json
{
  "table": "blackbox3",
  "name": "cam1",
  "desc": "현관 카메라",
  "rtsp_url": "rtsp://192.168.1.100:554/stream1",
  "webrtc_url": "ws://192.168.1.100:8889/cam1/whep",
  "model_id": 1,
  "detect_objects": ["person", "car"],
  "save_objects": true,
  "event_rule": [
    {
      "rule_id": "rule1",
      "name": "사람 감지",
      "expression_text": "person > 0",
      "record_mode": "EDGE_ONLY",
      "enabled": true
    }
  ],
  "ffmpeg_options": [
    { "k": "rtsp_transport", "v": "tcp" }
  ],
  "output_dir": "/data/cam1/in",
  "output_name": "manifest.mpd"
}
```

---

## 폴더 구조

```
blackbox-backend/
├── main.go                    # 프로그램 시작점
├── config.yaml                # 메인 설정
├── API_SPEC.md                # API 문서
├── internal/
│   ├── config/               # 설정 관리
│   ├── db/                   # Machbase 연결
│   │   ├── machbase.go
│   │   ├── machbase_blackbox.go
│   │   ├── machbase_camera.go
│   │   └── machbase_watcher.go
│   ├── ffmpeg/               # FFmpeg 실행
│   │   └── runner.go
│   ├── mediamtx/             # MediaMTX 실행
│   │   └── runner.go
│   ├── server/               # HTTP API
│   │   ├── server.go
│   │   ├── handler.go
│   │   ├── handler_camera.go
│   │   ├── handler_eventrule.go
│   │   ├── handler_blackbox.go
│   │   └── types.go
│   ├── watcher/              # 파일 감시
│   │   ├── watcher.go
│   │   └── watcher_stub.go
│   └── logger/               # 로깅
├── web/                      # 관리 웹 페이지
│   └── index.html
├── test_api.sh               # 개발용 API 테스트
└── prod_api.sh               # 운영용 API 테스트
```

---

## 데이터 저장 구조

### 영상 파일
```
/data/
└── cam1/                      # 카메라별 폴더
    ├── in/                    # FFmpeg이 저장
    │   ├── init-stream0.mp4
    │   ├── chunk-stream0-00001.m4s
    │   ├── chunk-stream0-00002.m4s
    │   └── manifest.mpd
    └── out/                   # Watcher가 이동
        ├── chunk-stream0-00001.m4s
        └── chunk-stream0-00002.m4s
```

### 카메라 설정
```
/data/cameras/
├── cam1.json
├── cam2.json
└── cam3.json
```

### MVS 설정 (AI 모델용)
```
/data/mvs/
├── cam1_1_1738824000.mvs
└── cam2_1_1738824100.mvs
```

---

## 데이터베이스 구조

### blackbox3 (영상 메타정보)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| name | string | 카메라 이름 |
| time | datetime | 영상 시작 시간 |
| value | binary | 영상 데이터 (바이너리) |

### {camera}_log (AI 감지 결과)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| name | string | camera_id.ident (예: cam1.person) |
| time | datetime | 감지 시간 |
| value | int | 감지 개수 |
| model_id | int | AI 모델 ID |

### camera_event (이벤트 발생 기록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| name | string | camera_id.rule_id |
| time | datetime | 평가 시간 |
| value | int | 결과 코드 (2=MATCH, 1=TRIGGER, 0=RESOLVE, -1=ERROR) |
| expression_text | string | DSL 표현식 |
| used_counts_snapshot | JSON | 사용된 감지 개수 스냅샷 |

---

## 프로그램 실행 방식

프로그램이 시작되면 동시에 실행됩니다:

1. **HTTP Server** - API 요청 대기
2. **Watcher** - 백그라운드에서 파일 감시
3. **Camera Manager** - 활성화된 카메라의 FFmpeg 프로세스 시작

모두 독립적으로 동작하며 서로 협력합니다.

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP API
┌──────▼──────────────────────────────┐
│        HTTP Server                  │
│  - Camera CRUD                      │
│  - Event Rule CRUD                  │
│  - Video Query                      │
└─────┬───────────────┬───────────────┘
      │               │
      │          ┌────▼────────┐
      │          │   Watcher   │
      │          │ File Watch  │
      │          └────┬────────┘
      │               │
┌─────▼─────┐   ┌────▼────────┐
│  FFmpeg   │   │  Machbase   │
│  Runner   │──▶│   (DB)      │
└───────────┘   └─────────────┘
```

---

## Event Rule DSL 문법

### 지원 연산자
- **산술**: `+`, `-`, `*`, `/`
- **비교**: `>`, `<`, `>=`, `<=`, `==`, `!=`
- **논리**: `AND`, `OR`, `NOT`
- **괄호**: `(`, `)`

### 예시
```
person > 5                           # 사람 5명 초과
person > 5 AND car >= 2              # 사람 5명 초과 & 차량 2대 이상
(person + car) > 10                  # 사람+차량 합계 10 초과
NOT (person == 0)                    # 사람이 0명이 아님
```

### 에러 처리
- 0으로 나누기 → ERROR(-1) 반환
- EDGE_ONLY 모드에서는 ERROR 상태 유지 (상태 변화 없음)

---

## 주요 기능 흐름

### 1. 카메라 등록 및 활성화
```
사용자 → POST /api/camera (카메라 정보)
     → cam1.json 파일 생성
     → POST /api/camera/cam1/enable
     → FFmpeg 프로세스 시작
     → 영상 녹화 시작
```

### 2. AI 감지 결과 처리
```
AI 시스템 → POST /api/ai/result (감지 결과)
         → {camera}_log 테이블에 저장
         → Event Rule 평가
         → 조건 만족 시 camera_event에 기록
```

### 3. 영상 조회
```
사용자 → GET /api/get_time_range?tagname=cam1
     → DB에서 녹화 시간 범위 조회
     → GET /api/v_get_chunk?tagname=cam1&time=2024-01-30T10:00:00Z
     → 해당 시간의 영상 청크 다운로드
```

---

## 빌드 및 실행

### 빌드
```bash
# Mage 사용
mage build

# 또는 직접 빌드
go build -o blackbox-backend
```

### 실행
```bash
./blackbox-backend
```

### 테스트
```bash
# 개발 환경
./test_api.sh

# 운영 환경
./prod_api.sh
```

---

## 참고 문서
- [API 상세 문서](API_SPEC.md)
- [이벤트 설계 문서](/.claude/projects/-home-aloha-machbase-blackbox-backend/memory/event-design.md)
