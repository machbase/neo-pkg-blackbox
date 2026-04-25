---
title: 이벤트 조회
weight: 40
---

# 이벤트 조회

Blackbox 패키지의 Event 화면에서는 감지 결과와 규칙 평가 결과를 시간 조건으로 조회할 수 있습니다.

## Event 화면 열기

사이드바에서 서버 아래의 **Events** 항목을 선택하면 Event 화면으로 이동합니다.

## 검색 조건

Event 화면에서는 다음 조건으로 조회 범위를 줄일 수 있습니다.

- `From`
- `To`
- `Camera`
- `Type`
- `Event Name`

`Type`에는 보통 다음 값이 표시됩니다.

- `ALL`
- `MATCH`
- `TRIGGER`
- `RESOLVE`
- `ERROR`

## 조회 순서

1. 시간 범위를 입력합니다.
2. 필요하면 Camera나 Type을 선택합니다.
3. **Search**를 눌러 결과를 조회합니다.
4. 필요하면 **Reset**으로 조건을 초기화합니다.

![이벤트 조회 화면](./images/blackbox-events-page.png)

## 결과 테이블에서 보는 항목

주요 컬럼:

- `Time`
- `Camera`
- `Rule`
- `Expression`
- `Type`
- `Content`

`Content`에는 객체별 감지 개수 같은 요약 정보가 badge 형태로 표시될 수 있습니다.

## Event 상세 보기

테이블의 행을 클릭하면 Event 상세 내용을 볼 수 있습니다.

이 화면에서는 다음 정보를 다시 확인할 수 있습니다.

- 이벤트 발생 시각
- Camera ID
- Rule 이름
- 사용된 표현식
- 감지 결과 세부 내용

## 운영 중 확인 포인트

- 예상한 규칙이 전혀 발생하지 않으면 Detection 설정부터 다시 확인합니다.
- `ERROR` 타입이 반복되면 Camera 연결 또는 서버 상태를 먼저 점검합니다.
- 시간 범위가 너무 좁으면 이벤트가 없는 것처럼 보일 수 있으므로, 처음에는 넉넉하게 조회하는 편이 좋습니다.

## 문서 이동

- [이전: 카메라 관리](./camera-management.kr.md)
- [목차로 돌아가기](./index.kr.md)
- [다음: 문제 해결](./troubleshooting.kr.md)
