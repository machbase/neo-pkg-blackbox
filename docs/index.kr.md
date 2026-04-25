---
title: Blackbox 사용자 매뉴얼
weight: 10
---

# Blackbox 사용자 매뉴얼

이 문서는 **Machbase Neo Blackbox 패키지**의 설치, 서버 등록, 카메라 관리, 이벤트 조회 방법을 설명합니다.

## 설치

Machbase Neo 좌측 사이드 패널에는 사용 가능한 패키지 목록이 표시됩니다.  
여기서 Blackbox 패키지를 선택하고 `Install` 버튼을 누르면 설치할 수 있습니다.

설치에는 약간의 시간이 걸릴 수 있으므로, 완료될 때까지 잠시 기다립니다.

![패키지 설치 화면](./images/package-install.png)

## 이 문서에서 다루는 내용

- 패키지 설치
- Settings 화면에서 공통 설정 저장
- Blackbox Server 등록과 연결 확인
- Camera 추가와 수정
- Event 화면에서 검색과 확인
- 운영 중 자주 보는 항목과 점검 방법

## 기본 작업 순서

1. Neo에서 Blackbox 패키지를 설치합니다.
2. Settings에서 공통 경로와 연동 정보를 확인합니다.
3. 최초 설치 시 자동 등록된 localhost 서버가 있으면 `127.0.0.1` 대신 외부 접속 가능한 IP로 바꿉니다.
4. 필요하면 좌측 사이드바에서 **Blackbox Server**를 추가로 등록합니다.
5. 서버 아래에 Camera를 추가합니다.
6. 필요하면 Detection, FFmpeg, Event Rule을 조정합니다.
7. Event 화면에서 발생 이력을 조회합니다.

## 화면 구성

- 좌측 사이드바: Blackbox Server 목록, Camera 목록, Events 이동, 서버 추가/새로고침
- 상단 Settings 탭: General, FFmpeg Default, Log Configuration
- Camera 화면: 기본 정보, RTSP 연결, Detection, FFmpeg, Event Rules, Live Preview
- Event 화면: 기간/카메라/타입 조건 검색과 상세 보기

![Blackbox 메인 화면](./images/blackbox-sidebar.png)

## 문서 목록

- [Settings와 서버 등록](./settings-and-servers.kr.md)
- [카메라 관리](./camera-management.kr.md)
- [이벤트 조회](./event-monitoring.kr.md)
- [문제 해결](./troubleshooting.kr.md)

## 문서 이동

- [다음: Settings와 서버 등록](./settings-and-servers.kr.md)
