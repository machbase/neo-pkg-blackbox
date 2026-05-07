---
title: 문제 해결
weight: 60
---

# 문제 해결

## 서버를 등록했는데 연결되지 않음

다음을 확인합니다.

- Alias가 아니라 실제 `IP / Port`가 맞는지
- 서버 프로세스가 실행 중인지
- 방화벽이나 네트워크 제한이 없는지

가능하면 등록 화면의 **Test Connection**을 먼저 수행합니다.

## Camera 목록이 비어 있음

- Blackbox Server가 실제로 하나 이상 등록되어 있는지 확인합니다.
- Settings의 `Camera Directory` 경로가 올바른지 확인합니다.
- 서버를 새로 등록하거나 경로를 바꾼 뒤에는 **Refresh**로 목록을 다시 불러옵니다.

## Camera는 등록되는데 영상이 오지 않음

다음을 순서대로 확인합니다.

1. RTSP URL이 정확한지
2. **Ping**이 성공하는지
3. FFmpeg 경로가 올바른지
4. Camera가 `Enabled` 상태인지

Ping이 성공해도 RTSP 경로나 인증 정보가 잘못되면 영상은 정상 동작하지 않을 수 있습니다.

## Detection 결과가 나오지 않음

- `Detect Objects`가 비어 있지 않은지 확인합니다.
- 해당 Camera에서 Detection 기능이 활성화되어 있는지 확인합니다.
- Event Rule보다 먼저 Detection 자체가 정상인지 확인합니다.

## Machbase 연동 오류

- Settings의 Machbase `Host / Port / Timeout Seconds`가 올바른지 확인합니다.
- `Use Token`을 사용하는 경우 토큰 설정이 실제 운영 환경과 맞는지 확인합니다.
- Machbase Neo 자체가 정상 실행 중인지 확인합니다.

## Event가 보이지 않음

- 시간 범위가 너무 좁지 않은지 확인합니다.
- `Type` 필터가 `ALL`이 아닌 경우 조건에 맞는 이벤트만 보인다는 점을 확인합니다.
- Camera를 잘못 선택하지 않았는지 확인합니다.

## 로그 파일이 생성되지 않음

- Settings의 `Log Directory` 경로가 실제로 존재하는지 확인합니다.
- 해당 디렉터리에 쓰기 권한이 있는지 확인합니다.
- `Output Destination`이 파일 기록을 포함하는 설정인지 확인합니다.

## MediaMTX 스트리밍 오류

- Settings의 MediaMTX `Host / Port`가 올바른지 확인합니다.
- `MediaMTX Binary` 경로와 실행 권한을 확인합니다.
- MediaMTX 프로세스가 실제로 실행 중인지 확인합니다.

## 로그가 너무 많음

Settings의 **Log Configuration**에서 다음을 조정합니다.

- `Log Level`
- `Max File Size`
- `Max Backups`
- `Max Age`

운영 중에는 `info` 또는 `warn`이 일반적입니다.

## Retention이 실행되지 않는 것 같음

- Settings의 **Retention** 탭에서 `Enable Retention`이 켜져 있는지 확인합니다.
- `Start At`과 `Interval Hours` 설정을 확인합니다. 스케줄 값은 내부적으로 UTC 기준으로 저장됩니다.
- Retention 탭의 다음 실행 시간(`Next Run`)이 예상과 맞는지 확인합니다.
- 즉시 확인이 필요하면 **Manual Run**을 실행하고 결과를 확인합니다.
- 파일 삭제가 되지 않으면 `Data Directory`와 카메라별 저장 경로의 쓰기/삭제 권한을 확인합니다.

## 운영 권장 사항

- 처음에는 서버 1개, Camera 1개로 시작합니다.
- Detection과 Event Rule은 단계적으로 추가합니다.
- 경로나 바이너리 설정을 바꾼 뒤에는 실제 동작을 다시 확인합니다.

## 문서 이동

- [이전: 이벤트 조회](./event-monitoring.kr.md)
- [목차로 돌아가기](./index.kr.md)
