# neo-pkg-blackbox

Machbase Neo용 Blackbox 서비스 패키지.  
`neo-pkg-bbox` 바이너리를 포함하고 JSH `servicectl`로 서비스를 관리합니다.

## 설치

### 1. 패키지 다운로드

```bash
pkg copy github.com/machbase/neo-pkg-blackbox public/neo-pkg-blackbox
```

### 2. bbox 다운로드 (neo-pkg-bbox 릴리스에서)

```bash
pkg run -C public/neo-pkg-blackbox/cgi-bin setup
```

### 3. 서비스 등록 및 시작

```bash
servicectl install /work/public/neo-pkg-blackbox/cgi-bin/blackbox.json
servicectl start neo-blackbox
```

## 서비스 관리

```bash
# 상태 확인
servicectl status neo-blackbox

# 중지
servicectl stop neo-blackbox

# 제거
servicectl uninstall neo-blackbox
```

## 서버 목록 API

서버 목록을 관리하는 CRUD API입니다. 데이터는 `cgi-bin/servers/servers.json`에 저장됩니다.

### 전체 조회

```bash
curl http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/index.js
```

```json
{"ok":true,"data":[{"alias":"87svr","ip":"192.168.0.87","port":8000}]}
```

### 단건 조회

```bash
curl "http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/index.js?alias=87svr"
```

```json
{"ok":true,"data":{"alias":"87svr","ip":"192.168.0.87","port":8000}}
```

### 추가

```bash
curl -X POST http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/index.js \
  -d '{"alias":"87svr","ip":"192.168.0.87","port":8000}'
```

```json
{"ok":true,"data":{"alias":"87svr","ip":"192.168.0.87","port":8000}}
```

### 수정

```bash
curl -X PUT "http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/index.js?alias=87svr" \
  -d '{"port":9000}'
```

```json
{"ok":true,"data":{"alias":"87svr","ip":"192.168.0.87","port":9000}}
```

### 삭제

```bash
curl -X DELETE "http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/index.js?alias=87svr"
```

```json
{"ok":true,"data":{"deleted":"87svr"}}
```

## 서비스 설정 (blackbox.json)

```json
{
  "name": "neo-blackbox",
  "enable": false,
  "working_dir": "/work/public/neo-pkg-blackbox/cgi-bin/bbox",
  "executable": "/work/public/neo-pkg-blackbox/cgi-bin/bbox/bin/neo-blackbox",
  "args": ["-config", "./config/config.yaml", "-web"]
}
```

## 구조

```
neo-pkg-blackbox/
├── package.json
├── index.html              ← 빌드된 프론트엔드
├── main.html
├── side.html
├── frontend/               ← React 소스코드
└── cgi-bin/
    ├── blackbox.json       ← servicectl 서비스 설정
    ├── setup.js            ← bbox 다운로드 스크립트
    ├── package.json
    ├── servers/            ← 서버 목록 CRUD
    │   ├── index.js
    │   └── servers.json
    └── bbox/               ← neo-pkg-bbox 패키지 (setup 후 생성)
        ├── bin/neo-blackbox
        ├── config/config.yaml
        ├── ai/             ← AI 바이너리 + 모델
        └── tools/          ← ffmpeg, mediamtx 등
```
