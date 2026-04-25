---
title: 문제 해결
weight: 50
---

# 문제 해결

## 서버를 등록했는데 연결되지 않음

다음을 확인합니다.

- Alias가 아니라 실제 `IP / Port`가 맞는지
- 서버 프로세스가 실행 중인지
- 방화벽이나 네트워크 제한이 없는지

가능하면 등록 화면의 **Test Connection**을 먼저 수행합니다.

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

## Event가 보이지 않음

- 시간 범위가 너무 좁지 않은지 확인합니다.
- `Type` 필터가 `ALL`이 아닌 경우 조건에 맞는 이벤트만 보인다는 점을 확인합니다.
- Camera를 잘못 선택하지 않았는지 확인합니다.

## 로그가 너무 많음

Settings의 **Log Configuration**에서 다음을 조정합니다.

- `Log Level`
- `Max Backups`
- `Max Age`

운영 중에는 `info` 또는 `warn`이 일반적입니다.

## 운영 권장 사항

- 처음에는 서버 1개, Camera 1개로 시작합니다.
- Detection과 Event Rule은 단계적으로 추가합니다.
- 경로나 바이너리 설정을 바꾼 뒤에는 실제 동작을 다시 확인합니다.

## 문서 이동

- [이전: 이벤트 조회](./event-monitoring.kr.md)
- [목차로 돌아가기](./index.kr.md)
