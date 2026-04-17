# neo-pkg-blackbox

Machbase Neo용 Blackbox 서비스 패키지.  
`neo-pkg-bbox` 바이너리를 포함하고 JSH `servicectl`로 서비스를 관리합니다.

## 설치

### 1. 패키지 배치

```bash
pkg copy github.com/machbase/neo-pkg-blackbox public/cgi-bin/blackbox
```

### 2. 서비스 등록

JSH에서:

```bash
servicectl install /work/public/cgi-bin/blackbox/blackbox.json
```

### 3. 서비스 시작

```bash
servicectl start neo-blackbox
```

## 서비스 관리

```bash
# 상태 ���인
servicectl status neo-blackbox

# 중지
servicectl stop neo-blackbox

# 제거
servicectl uninstall neo-blackbox
```

## 서비스 설정 (blackbox.json)

```json
{
  "name": "neo-blackbox",
  "enable": false,
  "working_dir": "/work/public/cgi-bin/blackbox/bbox",
  "executable": "@/work/public/cgi-bin/blackbox/bbox/bin/neo-blackbox",
  "args": ["-config", "./config/config.yaml", "-web"]
}
```

- `executable`의 `@` 접두사는 네이티브 바이너리 실행을 의미합니다.
- `working_dir`이 `bbox/` 디렉토리로 설정되어 config.yaml의 상대경로가 정상 동작��니다.

## 구조

```
neo-pkg-blackbox/
├── package.json
└── cgi-bin/
    ├── blackbox.json   ← servicectl 서비스 설정
    └── bbox/           ← neo-pkg-bbox 패키지
        ├── bin/neo-blackbox
        ├── config/config.yaml
        ├── ai/         ← AI 바이너리 + 모델
        └── tools/      ← ffmpeg, mediamtx 등
```
