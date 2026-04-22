'use strict';

// 패키지 삭제 직전 호출됨. 서비스 중지 + 서비스 등록 해제.
// 패키지 디렉토리 자체 제거는 패키지 매니저가 수행한다 (이 스크립트의 책임 아님).

var process = require('process');
var service = require('service');

var SERVICE_NAME = 'neo-pkg-blackbox';

// 1. 서비스 중지 (레지스트리 상태까지 stopped 로 전이)
console.println('stopping service:', SERVICE_NAME);
service.stop(SERVICE_NAME, function(stopErr) {
  if (stopErr) {
    // 이미 중지돼있거나 미등록이어도 다음 단계 진행
    console.println('WARN stop:', stopErr.message);
  } else {
    console.println('service stopped.');
  }

  // 2. 서비스 등록 해제
  console.println('uninstalling service:', SERVICE_NAME);
  service.uninstall(SERVICE_NAME, function(err) {
    if (err) {
      console.println('WARN uninstall:', err.message);
    } else {
      console.println('service uninstalled.');
    }
    console.println('all done.');
  });
});
