# neo-pkg-blackbox

Machbase Neo용 Blackbox 서비스 패키지.  
`neo-pkg-bbox` 바이너리를 다운로드하고 서비스로 관리하는 CGI 패키지입니다.

## 설치

```bash
pkg copy github.com/machbase/neo-pkg-blackbox public/blackbox
pkg run -C public/blackbox/cgi-bin setup
```

## CGI API

모든 API는 JSON 응답을 반환합니다.

### POST /public/blackbox/cgi-bin/install.js

서비스 등록.

```bash
curl -X POST http://localhost:5654/public/blackbox/cgi-bin/install.js
```

```json
{"ok":true,"data":{"name":"neo-blackbox"}}
```

### POST /public/blackbox/cgi-bin/start.js

서비스 시작.

```bash
curl -X POST http://localhost:5654/public/blackbox/cgi-bin/start.js
```

```json
{"ok":true,"data":{"name":"neo-blackbox"}}
```

### GET /public/blackbox/cgi-bin/status.js

서비스 상태 확인.

```bash
curl http://localhost:5654/public/blackbox/cgi-bin/status.js
```

```json
{
  "ok": true,
  "data": {
    "config": {
      "name": "neo-blackbox",
      "enable": false,
      "working_dir": "/work/public/blackbox/cgi-bin/bbox",
      "executable": "/work/public/blackbox/cgi-bin/blackbox-launcher.js"
    },
    "status": "running",
    "exit_code": 0,
    "pid": 12345
  }
}
```

### POST /public/blackbox/cgi-bin/stop.js

서비스 중지.

```bash
curl -X POST http://localhost:5654/public/blackbox/cgi-bin/stop.js
```

```json
{"ok":true,"data":{"name":"neo-blackbox"}}
```

### POST /public/blackbox/cgi-bin/uninstall.js

서비스 제거.

```bash
curl -X POST http://localhost:5654/public/blackbox/cgi-bin/uninstall.js
```

```json
{"ok":true,"data":{"name":"neo-blackbox"}}
```

## 구조

```
neo-pkg-blackbox/
├── package.json
└── cgi-bin/
    ├── package.json
    ├── setup.js              ← 바이너리 다운로드 (neo-pkg-bbox 릴리스)
    ├── blackbox-launcher.js  ← 네이티브 바이너리 실행 래퍼
    ├── install.js            ← 서비스 등록
    ├── start.js              ← 서비스 시작
    ├── status.js             ← 상태 확인
    ├── stop.js               ← 서비스 중지
    ├── uninstall.js          ← 서비스 제거
    └── bbox/                 ← 바이너리 디렉토리 (setup 후 생성)
```
