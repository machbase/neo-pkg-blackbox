'use strict';

// 패키지 삭제 직전 호출됨. 서비스 중지 + 서비스 등록 해제.
// 패키지 디렉토리 자체 제거는 패키지 매니저가 수행한다 (이 스크립트의 책임 아님).

var process = require('process');
var service = require('service');

var SERVICE_NAME = 'neo-pkg-blackbox';

// 1. bbox + 자식 프로세스 트리 강제 정리 (1차)
//    경로 패턴 매칭으로 한 방에 — bbox / mediamtx / ai-manager / ffmpeg 모두
killBboxTree('initial');

// 2. 서비스 컨트롤러 측 정리 (launcher 프로세스 + 상태 전이)
console.println('stopping service:', SERVICE_NAME);
service.stop(SERVICE_NAME, function(stopErr) {
  if (stopErr) {
    console.println('WARN stop:', stopErr.message);
  } else {
    console.println('service stopped.');
  }

  // 3. 서비스 등록 해제 — .json 제거되어 enable=true 자동 재기동 영구 차단
  console.println('uninstalling service:', SERVICE_NAME);
  service.uninstall(SERVICE_NAME, function(err) {
    if (err) {
      console.println('WARN uninstall:', err.message);
    } else {
      console.println('service uninstalled.');
    }

    // 4. 사이에 controller 가 재기동했을 가능성 차단 — 한 번 더 정리
    killBboxTree('cleanup');

    console.println('all done.');
  });
});

// bbox 디렉토리 경로 패턴 매칭으로 트리 kill.
// PGID 기반보다 robust:
//   - JSH /proc/process 가 없거나 stale 이어도 동작
//   - bbox 가 자식 spawn 시 pgid 변경해도 영향 없음
//   - 시스템 ffmpeg/mediamtx (다른 경로) 안 잡힘
function killBboxTree(label) {
  var os = require('os');
  var IS_WIN = os.platform() === 'windows';
  var pattern = '/cgi-bin/bbox/';   // POSIX 경로 — Windows 도 ps 명령은 forward slash 가능

  var rc;
  if (IS_WIN) {
    // PowerShell 로 우리 패키지 경로 필터링 후 강제 종료
    var ps1 = "Get-Process | Where-Object { $_.Path -like '*\\cgi-bin\\bbox\\*' } | Stop-Process -Force -ErrorAction SilentlyContinue";
    rc = process.exec('@powershell.exe', '-NoProfile', '-Command', ps1);
    console.println('killBboxTree[' + label + ']: powershell rc=' + rc);
  } else {
    // pkill -9 -f 로 cmdline 부분 매칭 — bbox + mediamtx + ai-manager + ffmpeg 모두
    rc = process.exec('@pkill', '-9', '-f', pattern);
    // pkill exit codes: 0=일치, 1=불일치(이미 죽음), 2=문법오류, 3=내부에러
    console.println('killBboxTree[' + label + ']: pkill rc=' + rc + (rc === 1 ? ' (none matched)' : ''));
  }
}
