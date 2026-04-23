'use strict';

// 패키지 삭제 직전 호출됨. 서비스 중지 + 서비스 등록 해제.
// 패키지 디렉토리 자체 제거는 패키지 매니저가 수행한다 (이 스크립트의 책임 아님).

var process = require('process');
var service = require('service');

var SERVICE_NAME = 'neo-pkg-blackbox';

// 1. bbox 프로세스 트리 강제 정리 (mediamtx/ai-manager/ffmpeg 자식까지)
//    service.stop 은 launcher 프로세스만 SIGKILL 하므로 자식들이 orphan 됨.
killBboxTree();

// 2. 서비스 컨트롤러 측 정리 (launcher 프로세스 + 상태 전이)
console.println('stopping service:', SERVICE_NAME);
service.stop(SERVICE_NAME, function(stopErr) {
  if (stopErr) {
    console.println('WARN stop:', stopErr.message);
  } else {
    console.println('service stopped.');
  }

  // 3. 서비스 등록 해제
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

// JSH /proc/process/ 에서 neo-blackbox 엔트리 찾아 PGID(unix) 또는 PID(windows)로 트리 kill.
// 이름 매칭 대신 정확한 PID 사용하므로 시스템 ffmpeg/mediamtx 오인 사살 없음.
function killBboxTree() {
  var fs = require('fs');
  var path = require('path');
  var os = require('os');
  var IS_WIN = os.platform() === 'windows';

  var procRoot = '/proc/process';
  if (!fs.existsSync(procRoot)) {
    console.println('killBboxTree: /proc/process not available, skip');
    return;
  }

  var found = null;
  var entries = fs.readdirSync(procRoot);
  for (var i = 0; i < entries.length; i++) {
    var metaPath = path.join(procRoot, entries[i], 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      var meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      var exe = meta.exec_path || meta.command || '';
      if (/[\/\\]neo-blackbox(\.exe)?$/.test(exe)) {
        found = { pid: meta.pid, pgid: meta.pgid > 0 ? meta.pgid : meta.pid };
        break;
      }
    } catch (e) { /* skip malformed */ }
  }

  if (!found) {
    console.println('killBboxTree: bbox process not found, skip');
    return;
  }
  console.println('killBboxTree: pid=' + found.pid + ' pgid=' + found.pgid);

  if (IS_WIN) {
    // graceful 트리 kill 시도 → 강제 트리 kill
    process.exec('@taskkill', '/T', '/PID', String(found.pid));
    process.exec('@taskkill', '/F', '/T', '/PID', String(found.pid));
  } else {
    // 음수 PID 는 process group 전체 — bbox + mediamtx + ai-manager + ffmpeg 모두 같은 PGID
    process.exec('@kill', '-TERM', '-' + found.pgid);
    process.exec('@kill', '-KILL', '-' + found.pgid);
  }
}
