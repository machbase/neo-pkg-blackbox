#!/bin/bash

# Blackbox Backend API 전체 테스트 스크립트
# Usage: ./test_blackbox_api.sh [BASE_URL]

BASE="${1:-http://127.0.0.1:8000}"
# BASE="${1:-http://192.168.0.87:8001}"
TIMESTAMP=$(date +%s)

echo "=========================================="
echo "Blackbox Backend API 전체 테스트"
echo "Base URL: $BASE"
echo "Timestamp: $TIMESTAMP"
echo "=========================================="
echo ""

# 테스트 카운터
SUCCESS=0
FAIL=0

# 결과 저장 배열
declare -a SUCCESS_TESTS
declare -a FAILED_TESTS

# 테스트용 변수
TEST_CAMERA_ID="test_camera_$(date +%s)"
TEST_RULE_ID="test_rule_$(date +%s)"

# 테스트 함수
test_api() {
    local num=$1
    local title=$2
    local method=$3
    local endpoint=$4
    local data=$5
    local expected_status=${6:-200}

    echo "[$num] $title"
    echo "--------------------------------------"

    local response=""
    local http_status=""

    if [ "$method" = "GET" ]; then
        echo "Request: GET $endpoint"
        response=$(curl -s -w "\n%{http_code}" "$BASE$endpoint")
        http_status=$(echo "$response" | tail -n1)
        response=$(echo "$response" | sed '$d')
    elif [ "$method" = "POST" ]; then
        echo "Request: POST $endpoint"
        if [ -n "$data" ]; then
            echo "Body: $data"
        fi
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE$endpoint" \
            -H "Content-Type: application/json" \
            ${data:+-d "$data"})
        http_status=$(echo "$response" | tail -n1)
        response=$(echo "$response" | sed '$d')
    elif [ "$method" = "PUT" ]; then
        echo "Request: PUT $endpoint"
        if [ -n "$data" ]; then
            echo "Body: $data"
        fi
        response=$(curl -s -w "\n%{http_code}" -X PUT "$BASE$endpoint" \
            -H "Content-Type: application/json" \
            ${data:+-d "$data"})
        http_status=$(echo "$response" | tail -n1)
        response=$(echo "$response" | sed '$d')
    elif [ "$method" = "DELETE" ]; then
        echo "Request: DELETE $endpoint"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE$endpoint")
        http_status=$(echo "$response" | tail -n1)
        response=$(echo "$response" | sed '$d')
    fi

    echo "Response (HTTP $http_status):"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"

    # 성공 여부 확인
    success=$(echo "$response" | jq -r '.success' 2>/dev/null)
    if [ "$http_status" = "$expected_status" ] && ([ "$success" = "true" ] || [ "$expected_status" != "200" ]); then
        echo "✓ SUCCESS"
        ((SUCCESS++))
        SUCCESS_TESTS+=("[$num] $title")
    else
        echo "✗ FAILED (expected HTTP $expected_status, got $http_status)"
        ((FAIL++))
        local reason=$(echo "$response" | jq -r '.reason' 2>/dev/null)
        FAILED_TESTS+=("[$num] $title - HTTP $http_status: $reason")
    fi

    echo ""
}

echo "=========================================="
echo "1. Blackbox APIs (기본 조회)"
echo "=========================================="
echo ""

# [1] 카메라 목록 조회
test_api "1" "카메라 목록 조회" "GET" "/api/cameras"

# [2] Time Range 조회
test_api "2" "Time Range 조회" "GET" "/api/get_time_range?tagname=camera-0"

# [3] Chunk Info 조회
test_api "3" "Chunk Info 조회" "GET" "/api/get_chunk_info?tagname=camera-0&time=2025-10-21T19:29:01.628667"

# [4] Video Chunk 조회
test_api "4" "Video Chunk 조회" "GET" "/api/v_get_chunk?tagname=camera-0&time=2025-10-21T19:29:01.628667"

# [5] Camera Rollup Info 조회
test_api "5" "Camera Rollup Info 조회" "GET" "/api/get_camera_rollup_info?tagname=camera-0&minutes=1&start_time=1761094496000000000&end_time=1761097487652444000"

echo "=========================================="
echo "2. Sensor APIs"
echo "=========================================="
echo ""

# [6] 센서 목록 조회
test_api "6" "센서 목록 조회" "GET" "/api/sensors?tagname=camera-0"

# [7] 센서 데이터 조회
test_api "7" "센서 데이터 조회" "GET" "/api/sensor_data?tagname=camera-0&sensors=sensor-1&start=2025-10-21T19:28:07.1234&end=2025-10-21T19:28:09.1234"

echo "=========================================="
echo "3. Camera Management (CRUD)"
echo "=========================================="
echo ""

# [8] 카메라 생성
test_api "8" "카메라 생성" "POST" "/api/camera" \
'{
  "table": "'$TEST_CAMERA_ID'",
  "name": "'$TEST_CAMERA_ID'",
  "desc": "Test Camera",
  "rtsp_url": "rtsp://example.com/stream",
  "model_id": 0,
  "detect_objects": ["person", "car"],
  "save_objects": true,
  "ffmpeg_options": [
    {"k": "rtsp_transport", "v": "tcp"},
    {"k": "c:v", "v": "copy"},
    {"k": "f", "v": "dash"}
  ],
  "output_name": "manifest.mpd"
}'

# [9] 카메라 조회
test_api "9" "카메라 조회" "GET" "/api/camera/$TEST_CAMERA_ID"

# [10] 카메라 수정
test_api "10" "카메라 수정" "POST" "/api/camera/$TEST_CAMERA_ID" \
'{
  "table": "'$TEST_CAMERA_ID'",
  "name": "'$TEST_CAMERA_ID'",
  "desc": "Updated Test Camera",
  "rtsp_url": "rtsp://example.com/stream2",
  "save_objects": true
}'

# [11] 카메라 상태 조회
test_api "11" "카메라 상태 조회" "GET" "/api/camera/$TEST_CAMERA_ID/status"

echo "=========================================="
echo "4. Camera Control"
echo "=========================================="
echo ""

# [12] 카메라 활성화
test_api "12" "카메라 활성화" "POST" "/api/camera/$TEST_CAMERA_ID/enable"

# [13] 카메라 비활성화
test_api "13" "카메라 비활성화" "POST" "/api/camera/$TEST_CAMERA_ID/disable"

# [14] 전체 카메라 상태 조회
test_api "14" "전체 카메라 상태 조회" "GET" "/api/cameras/health"

echo "=========================================="
echo "5. Event Rule Management"
echo "=========================================="
echo ""

# [15] Event Rule 조회
test_api "15" "Event Rule 조회" "GET" "/api/event_rule?camera_id=$TEST_CAMERA_ID"

# [16] Event Rule 추가
test_api "16" "Event Rule 추가" "POST" "/api/event_rule" \
'{
  "camera_id": "'$TEST_CAMERA_ID'",
  "rule": {
    "rule_id": "'$TEST_RULE_ID'",
    "name": "Test Rule",
    "expression_text": "person > 5",
    "record_mode": "ALL_MATCHES",
    "enabled": true
  }
}'

# [17] Event Rule 수정
test_api "17" "Event Rule 수정" "PUT" "/api/event_rule" \
'{
  "camera_id": "'$TEST_CAMERA_ID'",
  "rule_id": "'$TEST_RULE_ID'",
  "rule": {
    "rule_id": "'$TEST_RULE_ID'",
    "name": "Updated Test Rule",
    "expression_text": "person > 10",
    "record_mode": "EDGE_ONLY",
    "enabled": false
  }
}'

# [18] Event Rule 삭제
test_api "18" "Event Rule 삭제" "DELETE" "/api/event_rule?camera_id=$TEST_CAMERA_ID&rule_id=$TEST_RULE_ID"

echo "=========================================="
echo "6. AI Result Upload"
echo "=========================================="
echo ""

TS=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')

# [19] AI 결과 업로드
test_api "19" "AI 결과 업로드" "POST" "/api/ai/result" \
'{
  "camera_id": "'$TEST_CAMERA_ID'",
  "model_id": 0,
  "timestamp": 17205250002,
  "detections": {
    "person": 7,
    "car": 3
  },
  "total_objects": 10
}'

# [20] AI 결과 업로드 (잘못된 타임스탬프 - 0)
test_api "20" "AI 결과 업로드 (잘못된 타임스탬프 - 0)" "POST" "/api/ai/result" \
'{
  "table": "'$TEST_CAMERA_ID'_log",
  "camera_id": "'$TEST_CAMERA_ID'",
  "model_id": 0,
  "timestamp": 0,
  "detections": {
    "person": 5
  }
}' 400

# [21] AI 결과 업로드 (존재하지 않는 카메라)
test_api "21" "AI 결과 업로드 (존재하지 않는 카메라)" "POST" "/api/ai/result" \
'{
  "table": "nonexistent_log",
  "camera_id": "nonexistent_camera",
  "model_id": 0,
  "timestamp": '$(($(date +%s) * 1000))',
  "detections": {
    "person": 5
  }
}' 404

echo "=========================================="
echo "7. Cleanup (테스트 데이터 삭제)"
echo "=========================================="
echo ""

# [22] 카메라 삭제
test_api "22" "카메라 삭제" "DELETE" "/api/camera/$TEST_CAMERA_ID"

# 결과 요약
echo "=========================================="
echo "테스트 결과 요약"
echo "=========================================="
echo "총: $((SUCCESS + FAIL))"
echo "성공: $SUCCESS"
echo "실패: $FAIL"
echo ""

# 성공한 테스트 목록
if [ ${#SUCCESS_TESTS[@]} -gt 0 ]; then
    echo "=========================================="
    echo "성공한 테스트 ($SUCCESS)"
    echo "=========================================="
    for test in "${SUCCESS_TESTS[@]}"; do
        echo "✓ $test"
    done
    echo ""
fi

# 실패한 테스트 목록
if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo "=========================================="
    echo "실패한 테스트 ($FAIL)"
    echo "=========================================="
    for test in "${FAILED_TESTS[@]}"; do
        echo "✗ $test"
    done
    echo ""
fi

echo "=========================================="

# 종료 코드
if [ $FAIL -eq 0 ]; then
    echo "모든 테스트 통과! 🎉"
    exit 0
else
    echo "일부 테스트 실패 ⚠️"
    exit 1
fi
