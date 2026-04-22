'use strict';

// 패키지 삭제 직전 호출됨. 서비스 중지 + 서비스 등록 해제.
// 패키지 디렉토리 자체 제거는 패키지 매니저가 수행한다 (이 스크립트의 책임 아님).

var process = require('process');
var os = require('os');
var service = require('service');

var SERVICE_NAME = 'neo-blackbox';
var IS_WIN = os.platform() === 'windows';
var BINARY_NAME = IS_WIN ? 'neo-blackbox.exe' : 'neo-blackbox';

// 1. 바이너리 강제 종료
console.println('stopping binary:', BINARY_NAME);
if (IS_WIN) {
  process.exec('@taskkill', '/F', '/IM', BINARY_NAME);
} else {
  process.exec('@pkill', '-f', BINARY_NAME);
}

// 2. 서비스 등록 해제
console.println('uninstalling service:', SERVICE_NAME);
service.uninstall(SERVICE_NAME, function(err) {
  if (err) {
    // 등록 안 돼있어도 패키지 매니저는 정상 진행해야 함
    console.println('WARN uninstall:', err.message);
  } else {
    console.println('service uninstalled.');
  }
  console.println('all done.');
});
