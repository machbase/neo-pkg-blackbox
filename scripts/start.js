'use strict';

// 패키지가 관리하는 모든 서비스를 시작한다. (현재: neo-pkg-blackbox 1개)

var process = require('process');
var service = require('service');

var SERVICE_NAME = 'neo-pkg-blackbox';

console.println('starting service:', SERVICE_NAME);
service.start(SERVICE_NAME, function(err) {
  if (err) {
    console.println('ERROR:', err.message);
    process.exit(1);
  }
  console.println('service started.');
});
