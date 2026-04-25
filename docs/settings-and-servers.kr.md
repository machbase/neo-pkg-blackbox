---
title: Settings와 서버 등록
weight: 20
---

# Settings와 서버 등록

Blackbox 패키지는 먼저 **공통 설정(Settings)** 을 확인한 뒤, 실제로 연결할 **Blackbox Server**를 등록하는 순서로 사용하는 것이 좋습니다.

## Settings 화면

상단의 Settings 화면은 세 개의 탭으로 구성됩니다.

- `General`
- `FFmpeg Default`
- `Log Configuration`

오른쪽 상단의 **Save** 버튼을 눌러 변경 내용을 저장합니다.

> 스크린샷 위치: `blackbox-settings-general.png`
>
> 권장 장면: General 탭이 열려 있고 Save 버튼이 같이 보이는 화면

## General 탭

General 탭에서는 패키지 전체가 공통으로 사용하는 연결 정보와 경로를 설정합니다.

주요 항목:

- `Server Address`
  - Blackbox 서버가 수신 대기할 주소와 포트입니다.
- `Camera Directory`
  - 카메라 설정 파일이 저장되는 경로입니다.
- `Data Directory`
  - 영상 또는 관련 데이터가 저장되는 경로입니다.
- `Machbase`
  - Machbase Neo와 통신할 주소, 포트, 타임아웃을 설정합니다.
- `MediaMTX`
  - MediaMTX 주소와 포트를 설정합니다.
- `FFmpeg / FFprobe Binary`
  - FFmpeg 실행 파일 경로를 지정합니다.

일반 사용자는 보통 설치 후 기본값을 유지하고, 실제 운영 환경에 맞춰 주소와 경로만 점검하면 충분합니다.

## FFmpeg Default 탭

이 탭은 FFmpeg 또는 ffprobe의 기본 인수를 관리하는 화면입니다.

- 기본 probe 옵션을 추가할 수 있습니다.
- 기존 항목을 수정하거나 삭제할 수 있습니다.
- 영상 분석이나 메타데이터 조회 규칙을 공통으로 맞추고 싶을 때 사용합니다.

운영 중 특별한 요구가 없다면 기본값을 먼저 사용하고, 문제 분석이 필요할 때만 조정하는 편이 안전합니다.

## Log Configuration 탭

이 탭에서는 패키지 전체의 로그 정책을 정합니다.

주요 항목:

- `Log Directory`
- `Log Level`
- `Log Format`
- `Output Destination`
- `File Rotation / Backup / Max Age`

권장 사항:

- 일반 운영: `info` 또는 `warn`
- 장애 분석: 일시적으로 `debug`

`debug` 수준은 로그가 빠르게 늘 수 있으므로 장기간 유지하지 않는 편이 좋습니다.

## Blackbox Server 등록

좌측 사이드바의 **BLACKBOX SERVER** 영역에서 `+` 버튼을 누르면 새 서버를 등록할 수 있습니다.

입력 항목:

- `Alias`
  - 화면에서 구분할 서버 이름
- `IP Address`
  - 실제 Blackbox Server 주소
- `Port`
  - 해당 서버 포트

등록 순서:

1. `+` 버튼 클릭
2. Alias, IP, Port 입력
3. 가능하면 **Test Connection**으로 먼저 연결 확인
4. **Save**로 저장

> 스크린샷 위치: `blackbox-server-form.png`
>
> 권장 장면: Alias, IP Address, Port 입력창과 Test Connection 버튼이 보이는 서버 등록 화면

## 등록된 서버 관리

사이드바에서 서버별로 다음 동작을 수행할 수 있습니다.

- `Refresh`
  - 서버 목록과 카메라 상태를 다시 불러옵니다.
- `Settings`
  - 서버 정보를 수정합니다.
- `Delete`
  - 서버를 삭제합니다.

서버를 삭제하면 그 서버에 속한 카메라 화면 접근도 불가능해질 수 있으므로, 운영 중에는 신중하게 사용해야 합니다.

## 사용자 주의사항

- Settings의 공통 경로와 서버별 IP/Port는 서로 다른 목적입니다.
- MediaMTX, FFmpeg, Machbase 주소가 잘못되면 Camera가 정상 등록되어도 실제 동작이 실패할 수 있습니다.
- 처음에는 서버 1개와 카메라 1개만 등록해 정상 동작을 확인한 뒤 확장하는 것이 좋습니다.

## 문서 이동

- [목차로 돌아가기](./index.kr.md)
- [다음: 카메라 관리](./camera-management.kr.md)
