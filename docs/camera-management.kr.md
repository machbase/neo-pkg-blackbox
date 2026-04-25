---
title: 카메라 관리
weight: 30
---

# 카메라 관리

Blackbox Server를 등록한 뒤에는 각 서버 아래에 Camera를 추가하고 운영합니다.

## 새 Camera 추가

사이드바에서 원하는 서버를 펼친 뒤 **Add Camera**를 선택하면 새 Camera 화면으로 이동합니다.

새 Camera 화면에서 주로 입력하는 항목은 다음과 같습니다.

- `Table`
  - 카메라 관련 데이터가 저장될 테이블
- `Camera Name`
  - 카메라 이름
- `Description`
  - 설명
- `RTSP URL`
  - 실제 카메라 스트림 주소

`Table` 목록이 비어 있으면 **New Table** 버튼으로 새 테이블을 만들 수 있습니다.

![새 Camera 등록 화면](./images/blackbox-camera-new.png)

## RTSP 연결 확인

RTSP URL을 입력한 뒤 **Ping** 버튼으로 대상 장비가 reachable한지 확인할 수 있습니다.

- 성공 시: reachable 메시지 표시
- 실패 시: unreachable 또는 ping 실패 메시지 표시

Ping이 성공해도 인증 정보나 스트림 경로가 잘못되면 실제 녹화는 실패할 수 있으므로, 저장 후 동작 상태를 함께 확인해야 합니다.

## Detection 설정

Detection 영역에서는 감지할 객체 종류를 선택할 수 있습니다.

- `Detect Objects`
  - 감지 대상 객체 목록
- `Save detection results`
  - 감지 결과 저장 여부

Event Rule에서 사용할 객체 이름은 이 `Detect Objects` 목록을 기준으로 합니다.

객체 감지를 쓰지 않는 경우에는 비워 둘 수 있습니다.

## FFmpeg 설정

Camera별로 FFmpeg 설정을 따로 조정할 수 있습니다.

- 기본값을 그대로 사용할 수 있습니다.
- 특정 카메라만 별도 옵션이 필요하면 여기서 조정합니다.
- 출력 경로나 보관 경로도 Camera별로 다르게 지정할 수 있습니다.

## Event Rules

기존 Camera 편집 화면에서는 Event Rule 영역을 설정할 수 있습니다.

이 영역은 감지 결과를 바탕으로 특정 조건이 만족될 때 Event를 만들기 위한 규칙입니다.

규칙 식에는 현재 Camera의 `Detect Objects`에 등록된 객체 이름만 사용하는 것이 좋습니다.  
Event Rule 편집 화면에서는 이 목록이 `Idents`로 표시되며, 항목을 클릭해 식에 바로 넣을 수 있습니다.

예:

- `person > 0`
  - 사람이 1명 이상 감지되면 Event 발생
- `car >= 2`
  - 차량이 2대 이상 감지되면 Event 발생
- `person > 0 AND car > 0`
  - 사람과 차량이 함께 감지될 때 Event 발생

`person`, `car` 같은 이름은 Detection에 등록된 객체여야 합니다.  
먼저 `Detect Objects`를 설정한 뒤 Event Rule을 추가하는 순서로 작업하는 것이 안전합니다.

운영 초기에 바로 복잡한 규칙을 넣기보다는, 먼저 Detection만 정상 동작하는지 확인한 뒤 Rule을 추가하는 편이 안정적입니다.

## Camera 상세 화면

기존 Camera를 열면 다음 정보를 볼 수 있습니다.

- Camera 이름
- 활성 상태 스위치
- Table
- Description
- RTSP URL
- Detection 설정
- FFmpeg 설정
- Live Preview

실행 중 Camera는 상태 스위치가 `Enabled`로 보입니다.

![Camera 상세 화면](./images/blackbox-camera-detail.png)

## Camera 시작과 중지

상세 화면 상단의 상태 스위치로 Camera를 활성화하거나 비활성화할 수 있습니다.

- `Enabled`
  - 카메라가 동작 중인 상태
- `Disabled`
  - 카메라가 중지된 상태

설정을 바꾼 뒤에는 비활성화 후 다시 활성화해서 반영 상태를 확인하는 것이 좋습니다.

## Camera 수정과 삭제

- `Edit`
  - Description, RTSP URL, Detection, FFmpeg 등의 설정을 수정합니다.
- `Delete`
  - Camera를 삭제합니다.

Camera 삭제는 되돌릴 수 없으므로, 운영 중인 카메라는 삭제보다 먼저 비활성화 후 영향 범위를 확인하는 것이 좋습니다.

## 문서 이동

- [이전: Settings와 서버 등록](./settings-and-servers.kr.md)
- [목차로 돌아가기](./index.kr.md)
- [다음: 대시보드 Video 패널 사용](./dashboard-video-panel.kr.md)
