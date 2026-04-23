'use strict';

// 패키지가 관리하는 모든 서비스를 중지한다. (현재: neo-pkg-blackbox 1개)

var process = require('process');
var service = require('service');

var SERVICE_NAME = 'neo-pkg-blackbox';

// 1. bbox + 자식 프로세스 트리 강제 정리 (경로 패턴 기반)
killBboxTree('initial');

// 2. 서비스 컨트롤러 측 정리 (launcher cmd.Wait 풀려서 즉시 callback)
console.println('stopping service:', SERVICE_NAME);
service.stop(SERVICE_NAME, function(err) {
  if (err) {
    console.println('WARN stop:', err.message);
  } else {
    console.println('service stopped.');
  }
  // 주의: 이 시점에 enable=true 면 controller 가 자동 재기동할 수 있음.
  // stop 만 원하면 별도로 servicectl 에서 disable 하거나 uninstall 사용 권장.
});

function killBboxTree(label) {
  var os = require('os');
  var IS_WIN = os.platform() === 'windows';
  var pattern = '/cgi-bin/bbox/';

  var rc;
  if (IS_WIN) {
    var ps1 = "Get-Process | Where-Object { $_.Path -like '*\\cgi-bin\\bbox\\*' } | Stop-Process -Force -ErrorAction SilentlyContinue";
    rc = process.exec('@powershell.exe', '-NoProfile', '-Command', ps1);
    console.println('killBboxTree[' + label + ']: powershell rc=' + rc);
  } else {
    rc = process.exec('@pkill', '-9', '-f', pattern);
    console.println('killBboxTree[' + label + ']: pkill rc=' + rc + (rc === 1 ? ' (none matched)' : ''));
  }
}
