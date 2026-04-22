'use strict';

// 패키지가 관리하는 모든 서비스를 중지한다. (현재: neo-blackbox 1개)

var process = require('process');
var os = require('os');

var SERVICE_NAME = 'neo-blackbox';
var IS_WIN = os.platform() === 'windows';
var BINARY_NAME = IS_WIN ? 'neo-blackbox.exe' : 'neo-blackbox';

console.println('stopping binary:', BINARY_NAME);
if (IS_WIN) {
  process.exec('@taskkill', '/F', '/IM', BINARY_NAME);
} else {
  process.exec('@pkill', '-f', BINARY_NAME);
}
console.println('done.');
