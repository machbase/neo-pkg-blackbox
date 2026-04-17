# neo-pkg-blackbox

Machbase Neo용 Blackbox 서비스 패키지.  
`neo-pkg-bbox` 바이너리를 포함하고 JSH `servicectl`로 서비스를 관리합니다.

## 설치

### 1. 패키지 다운로드

```bash
pkg copy github.com/machbase/neo-pkg-blackbox public/neo-pkg-blackbox
```

### 2. bbox 다운로드

```bash
pkg run -C public/neo-pkg-blackbox/cgi-bin setup
```

### 3. Config 생성

```bash
curl -X POST http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/config.js \
  -d '{"server":{"addr":"0.0.0.0:8000","camera_dir":"../bin/cameras","mvs_dir":"../ai/mvs","data_dir":"../bin/data"},"machbase":{"scheme":"http","host":"127.0.0.1","port":5654,"timeout_seconds":30,"api_token":"","user":"sys","password":"manager"},"mediamtx":{"binary":"../tools/mediamtx","config_file":"../tools/mediamtx.yml","host":"127.0.0.1","port":9997},"ffmpeg":{"binary":"../tools/ffmpeg","defaults":{"probe_binary":"../tools/ffprobe","probe_args":[{"flag":"v","value":"error"},{"flag":"select_streams","value":"v:0"},{"flag":"show_entries","value":"packet=pts_time,duration_time"},{"flag":"of","value":"csv=p=0"}]}},"ai":{"binary":"../ai/blackbox-ai-manager","config_file":"../ai/config.json"},"log":{"dir":"../logs","level":"info","format":"json","output":"both","file":{"filename":"blackbox.log","max_size":100,"max_backups":10,"max_age":30,"compress":true}}}'
```

### 4. 서비스 등록 및 시작

JSH에서:

```bash
servicectl install /work/public/neo-pkg-blackbox/cgi-bin/blackbox.json
servicectl start neo-blackbox
servicectl status neo-blackbox
```

## Config API

`bbox/config/config.yaml`을 생성/조회/수정합니다.

모든 응답 형식:

```json
{"success": true, "reason": "success", "elapse": "3ms", "data": { ... }}
```

### GET - Config 조회

```bash
curl http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/config.js
```

```json
{
  "success": true,
  "reason": "success",
  "elapse": "1ms",
  "data": {
    "server": {"addr": "0.0.0.0:8000", "camera_dir": "../bin/cameras", "mvs_dir": "../ai/mvs", "data_dir": "../bin/data"},
    "machbase": {"scheme": "http", "host": "127.0.0.1", "port": 5654, "timeout_seconds": 30, "user": "sys"},
    "mediamtx": {"binary": "../tools/mediamtx", "config_file": "../tools/mediamtx.yml", "host": "127.0.0.1", "port": 9997},
    "ffmpeg": {"binary": "../tools/ffmpeg", "defaults": {"probe_binary": "../tools/ffprobe", "probe_args": [{"flag": "v", "value": "error"}, {"flag": "select_streams", "value": "v:0"}, {"flag": "show_entries", "value": "packet=pts_time,duration_time"}, {"flag": "of", "value": "csv=p=0"}]}},
    "ai": {"binary": "../ai/blackbox-ai-manager", "config_file": "../ai/config.json"},
    "log": {"dir": "../logs", "level": "info", "format": "json", "output": "both", "file": {"filename": "blackbox.log", "max_size": 100, "max_backups": 10, "max_age": 30, "compress": true}}
  }
}
```

### POST - Config 생성

config.yaml이 없을 때 새로 생성합니다. 이미 존재하면 409를 반환합니다.

```bash
curl -X POST http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/config.js \
  -d '{"machbase":{"host":"192.168.0.87","port":5654,"user":"sys","password":"manager"}}'
```

```json
{"success": true, "reason": "success", "elapse": "2ms", "data": null}
```

### PUT - Config 수정

기존 config에서 전달한 필드만 덮어씁니다. config가 없으면 404를 반환합니다.

```bash
curl -X PUT http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/config.js \
  -d '{"machbase":{"host":"192.168.0.100"}}'
```

```json
{"success": true, "reason": "success", "elapse": "1ms", "data": null}
```

## 서버 목록 API

블랙박스 서버 목록을 관리합니다. 데이터는 `cgi-bin/servers/servers.json`에 저장됩니다.

### GET - 전체 조회

```bash
curl http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/index.js
```

```json
{
  "success": true,
  "reason": "success",
  "elapse": "1ms",
  "data": [{"alias": "87svr", "ip": "192.168.0.87", "port": 8000}]
}
```

### GET - 단건 조회

```bash
curl "http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/index.js?alias=87svr"
```

```json
{
  "success": true,
  "reason": "success",
  "elapse": "1ms",
  "data": {"alias": "87svr", "ip": "192.168.0.87", "port": 8000}
}
```

### POST - 서버 추가

```bash
curl -X POST http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/index.js \
  -d '{"alias":"87svr","ip":"192.168.0.87","port":8000}'
```

```json
{
  "success": true,
  "reason": "success",
  "elapse": "2ms",
  "data": {"alias": "87svr", "ip": "192.168.0.87", "port": 8000}
}
```

### PUT - 서버 수정

```bash
curl -X PUT "http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/index.js?alias=87svr" \
  -d '{"port":9000}'
```

```json
{
  "success": true,
  "reason": "success",
  "elapse": "1ms",
  "data": {"alias": "87svr", "ip": "192.168.0.87", "port": 9000}
}
```

### DELETE - 서버 삭제

```bash
curl -X DELETE "http://<host>:5654/public/neo-pkg-blackbox/cgi-bin/servers/index.js?alias=87svr"
```

```json
{
  "success": true,
  "reason": "success",
  "elapse": "1ms",
  "data": {"deleted": "87svr"}
}
```

## 서비스 관리

JSH에서:

```bash
# 상태 확인
servicectl status neo-blackbox

# 중지
servicectl stop neo-blackbox

# 제거
servicectl uninstall neo-blackbox
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
    ├── servers/
    │   ├── index.js        ← 서버 목록 CRUD
    │   ├── config.js       ← Config CRUD → bbox/config/config.yaml
    │   └── servers.json    ← 서버 목록 데이터
    └── bbox/               ← neo-pkg-bbox 패키지 (setup 후 생성)
        ├── bin/neo-blackbox
        ├── config/         ← config.yaml (API로 생성)
        ├── ai/
        └── tools/
```
