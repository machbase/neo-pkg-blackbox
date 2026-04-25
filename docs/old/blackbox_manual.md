# Blackbox Server Admin 사용자 매뉴얼

> **Machbase Neo v8.0.75** | 블랙박스 카메라 서버 관리 시스템

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [화면 구성](#2-화면-구성)
3. [Settings](#3-settings)
   - 3.1 [General Settings](#31-general-settings)
   - 3.2 [FFmpeg Default Settings](#32-ffmpeg-default-settings)
   - 3.3 [Log Configuration](#33-log-configuration)
4. [블랙박스 서버 관리](#4-블랙박스-서버-관리)
5. [카메라 관리](#5-카메라-관리)
6. [운영 가이드](#6-운영-가이드)
7. [문제 해결](#7-문제-해결)

---

## 1. 시스템 개요

**Blackbox Admin**은 Machbase Neo 플랫폼에 내장된 블랙박스(차량 영상 기록장치) 카메라 서버 관리 도구입니다.  
웹 브라우저에서 직접 접근하여 카메라 서버를 추가·관리하고, 영상 처리(FFmpeg), 로그, 연동 설정을 일괄 구성할 수 있습니다.

**접속 URL:**
```
http://<서버IP>:5654/public/neo-pkg-blackbox#/settings
```

### 주요 기능

- 블랙박스 서버 추가 및 연결 관리
- **General Settings**: 서버 경로, Machbase 연동, MediaMTX, FFmpeg 경로 구성
- **FFmpeg Default**: 미디어 스트림 분석용 기본 probe 인수 설정
- **Log Configuration**: 로그 레벨, 형식, 파일 보존 정책 관리
- 카메라 목록 조회 및 상태 모니터링

### 시스템 구성 요소

| 구성 요소 | 기본 주소 | 설명 |
|---|---|---|
| Blackbox Server | `0.0.0.0:8000` | 블랙박스 전용 HTTP 서버 |
| Machbase Neo | `127.0.0.1:5654` | 시계열 데이터베이스 연동 엔드포인트 |
| MediaMTX | `127.0.0.1:9997` | 미디어 스트리밍 프록시 서버 |
| FFmpeg | `../tools/ffmpeg` | 영상 처리 및 메타데이터 추출 도구 |

---

## 2. 화면 구성

Blackbox Admin UI는 **좌측 사이드바**와 **우측 콘텐츠 영역**으로 구성됩니다.

### 2.1 좌측 사이드바

| 영역 | 설명 |
|---|---|
| **Blackbox Admin** (상단 제목) | 앱 제목 및 설정(⚙) 아이콘 |
| **BLACKBOX SERVER** 섹션 | 등록된 블랙박스 서버 목록 |
| `+` 버튼 | 신규 블랙박스 서버 추가 |
| `↺` 버튼 | 서버 목록 새로고침 |
| *No servers configured* | 서버 미등록 시 표시되는 초기 상태 메시지 |

### 2.2 상단 탭 (Settings 화면)

| 탭 | 설명 |
|---|---|
| **General** | 서버 주소, 디렉터리, Machbase·MediaMTX·FFmpeg 연동 경로 설정 |
| **FFmpeg Default** | 미디어 스트림 분석 시 사용할 기본 probe 인수 목록 관리 |
| **Log Configuration** | 로그 레벨, 형식, 출력 대상, 파일 보존 정책 관리 |

---

## 3. Settings

### 3.1 General Settings

> 경로: `Settings > General`  
> 서버 핵심 경로와 서드파티 통합을 구성합니다.

#### Server

| 항목 | 기본값 | 설명 |
|---|---|---|
| **ADDRESS** | `0.0.0.0:8000` | 블랙박스 서버가 수신 대기할 IP 및 포트 |
| **CAMERA DIRECTORY** | `../bin/cameras` | 카메라 설정 파일이 저장되는 디렉터리 |
| **MVS DIRECTORY** | `../ai/mvs` | AI MVS(머신 비전) 모델 파일 경로 |
| **DATA DIRECTORY** | `../bin/data` | 영상·데이터 파일 저장 경로 |

#### Machbase

| 항목 | 기본값 | 설명 |
|---|---|---|
| **HOST** | `127.0.0.1` | Machbase Neo 서버 IP 주소 |
| **PORT** | `5654` | Machbase Neo 수신 포트 |
| **TIMEOUT SECONDS** | `30` | Machbase 요청 타임아웃 (초) |
| **Use Token** | OFF | Machbase 요청에 토큰 기반 인증 사용 여부 |

> 📌 **Use Token**을 활성화하면 Machbase 연동 시 토큰 인증이 적용됩니다. 보안이 요구되는 운영 환경에서 권장합니다.

#### MediaMTX

| 항목 | 기본값 | 설명 |
|---|---|---|
| **HOST** | `127.0.0.1` | MediaMTX 서버 IP |
| **PORT** | `9997` | MediaMTX API 포트 |
| **BINARY** | `../tools/mediamtx` | MediaMTX 실행 파일 경로 |

#### FFmpeg

| 항목 | 기본값 | 설명 |
|---|---|---|
| **BINARY** | `../tools/ffmpeg` | FFmpeg 실행 파일 경로 |
| **FFPROBE BINARY** | `../tools/ffprobe` | FFprobe 실행 파일 경로 |

---

### 3.2 FFmpeg Default Settings

> 경로: `Settings > FFmpeg Default`  
> 미디어 스트림 분석(probe) 시 기본으로 적용되는 ffprobe 명령 인수를 관리합니다.

각 항목은 **FLAG**와 **VALUE** 쌍으로 구성되며, `+ Add Argument` 버튼으로 추가하고 🗑 버튼으로 삭제합니다.

#### 기본 probe_args 목록

| FLAG | VALUE | 설명 |
|---|---|---|
| `v` | `error` | 로그 레벨을 error로 설정 (불필요한 출력 억제) |
| `select_streams` | `v:0` | 첫 번째 비디오 스트림만 선택 |
| `show_entries` | `packet=pts_time,duration_time` | 패킷의 PTS 및 재생 시간 정보 출력 |
| `of` | `csv=p=0` | 출력 형식을 CSV (헤더 없음)로 지정 |

> 📌 probe 인수는 미디어 메타데이터 추출 성능에 직접적인 영향을 줍니다. 프로그래밍 방식 파싱을 위해서는 JSON 출력 형식 사용을 권장합니다.

---

### 3.3 Log Configuration

> 경로: `Settings > Log Configuration`  
> 서버 로그 생성, 저장, 순환(rotation) 방식을 관리합니다.

#### General Logging

| 항목 | 기본값 | 설명 |
|---|---|---|
| **LOG DIRECTORY** | `../logs` | 로그 파일 저장 디렉터리 |
| **LOG LEVEL** | `info` | 로그 레벨 (`debug` / `info` / `warn` / `error`) |
| **LOG FORMAT** | `JSON` | 로그 출력 형식 (`JSON` / `Text`) |
| **OUTPUT DESTINATION** | `Both` | 로그 출력 대상 (`File` / `Console` / `Both`) |

#### File Retention & Rotation

| 항목 | 기본값 | 설명 |
|---|---|---|
| **FILENAME PATTERN** | `blackbox.log` | 로그 파일명 패턴 |
| **MAX FILE SIZE (MB)** | `100` | 개별 로그 파일 최대 크기 (초과 시 rotation) |
| **MAX BACKUPS** | `10` | 보관할 최대 백업 파일 수 |
| **MAX AGE (DAYS)** | `30` | 로그 파일 최대 보관 기간 (일) |
| **Compress Old Logs** | ON | 오래된 로그 파일 자동 압축 여부 |

> 📌 **Compress Old Logs**를 활성화하면 오래된 로그 파일을 자동으로 압축하여 디스크 공간을 절약합니다.

---

## 4. 블랙박스 서버 관리

### 4.1 새 서버 추가

좌측 사이드바의 `BLACKBOX SERVER` 섹션에서 `+` 버튼을 클릭하면 **New Blackbox Server** 다이얼로그가 표시됩니다.

| 항목 | 예시 | 설명 |
|---|---|---|
| **ALIAS** | `BlackBox Server 1` | 서버를 식별하는 이름 (별칭) |
| **IP ADDRESS** | `127.0.0.1` | 블랙박스 서버의 IP 주소 |
| **PORT** | `8000` | 블랙박스 서버 수신 포트 |

**등록 절차:**
1. ALIAS, IP ADDRESS, PORT 입력
2. `Test Connection` 버튼으로 연결 확인
3. `Save` 버튼을 클릭하여 등록 완료

### 4.2 서버 목록 관리

| 동작 | 설명 |
|---|---|
| `↺` 새로고침 버튼 | 서버 목록 및 상태를 최신 정보로 갱신 |
| 서버 클릭 | 해당 서버의 카메라 목록 및 상세 정보로 이동 |
| 연결 오류 시 | 사이드바에 연결 실패 상태 표시 |

---

## 5. 카메라 관리

블랙박스 서버가 정상 등록되면 카메라 페이지(`#/cameras`)에서 연결된 카메라 목록과 상태를 확인할 수 있습니다.

- 카메라별 스트림 상태 (활성/비활성) 모니터링
- MediaMTX를 통한 실시간 RTSP/HLS 스트리밍 지원
- FFmpeg을 이용한 영상 메타데이터 자동 추출
- Machbase Neo에 시계열 데이터로 저장 및 조회

> 📌 카메라 목록은 블랙박스 서버가 하나 이상 등록되어 있어야 조회됩니다.

---

## 6. 운영 가이드

### 6.1 초기 설정 순서

1. `Settings > General`에서 서버 경로 및 연동 정보 확인·수정
2. FFmpeg / FFprobe / MediaMTX 바이너리 경로가 실제 파일 위치와 일치하는지 확인
3. Machbase Neo 연결 정보 (HOST, PORT) 입력 후 저장
4. 사이드바 `+` 버튼으로 블랙박스 서버 등록 및 연결 테스트
5. `Settings > Log Configuration`에서 로그 레벨 및 보존 정책 설정

### 6.2 설정 저장

각 Settings 탭 우측 상단의 **`Save`** 버튼을 클릭하면 변경 사항이 즉시 저장됩니다.  
경로 변경은 서버 재시작이 필요할 수 있습니다.

### 6.3 로그 확인

- `LOG DIRECTORY`에 지정된 경로에서 `blackbox.log` 파일 확인
- `OUTPUT DESTINATION`을 `Both`로 설정하면 콘솔과 파일 모두에 기록
- 운영 환경에서는 `LOG LEVEL`을 `info` 또는 `warn`으로 설정 권장
- `MAX AGE (DAYS)` 설정으로 오래된 로그 자동 삭제

---

## 7. 문제 해결

| 증상 | 조치 방법 |
|---|---|
| **서버 연결 실패** | IP/PORT 확인, 방화벽 설정 점검, 블랙박스 프로세스 실행 여부 확인 |
| **카메라 목록 비어있음** | 블랙박스 서버 등록 여부 확인, `CAMERA DIRECTORY` 경로 점검 |
| **FFmpeg 오류** | `FFmpeg`/`FFprobe` BINARY 경로 확인, 파일 실행 권한 점검 |
| **Machbase 연동 오류** | HOST/PORT 확인, `Use Token` 설정 및 인증 토큰 유효성 점검 |
| **로그 파일 미생성** | `LOG DIRECTORY` 경로 존재 여부 및 쓰기 권한 확인 |
| **MediaMTX 스트리밍 오류** | MediaMTX HOST/PORT 확인, BINARY 경로 및 실행 권한 점검 |

---

*Machbase Neo Blackbox Server Admin — 사용자 매뉴얼*
