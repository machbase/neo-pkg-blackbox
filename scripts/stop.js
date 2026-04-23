'use strict';

// 패키지가 관리하는 모든 서비스를 중지한다. (현재: neo-pkg-blackbox 1개)

var process = require('process');
var service = require('service');

var SERVICE_NAME = 'neo-pkg-blackbox';

// 1. bbox 프로세스 트리 강제 정리 (mediamtx/ai-manager/ffmpeg 자식까지)
killBboxTree();

// 2. 서비스 컨트롤러 측 정리 (launcher 프로세스 + 상태 전이)
console.println('stopping service:', SERVICE_NAME);
service.stop(SERVICE_NAME, function(err) {
  if (err) {
    console.println('WARN stop:', err.message);
    // launcher 가 이미 죽었을 수 있으므로 exit code 강요하지 않음
  } else {
    console.println('service stopped.');
  }
});

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
    } catch (e) { /* skip */ }
  }

  if (!found) {
    console.println('killBboxTree: bbox process not found, skip');
    return;
  }
  console.println('killBboxTree: pid=' + found.pid + ' pgid=' + found.pgid);

  if (IS_WIN) {
    process.exec('@taskkill', '/T', '/PID', String(found.pid));
    process.exec('@taskkill', '/F', '/T', '/PID', String(found.pid));
  } else {
    process.exec('@kill', '-TERM', '-' + found.pgid);
    process.exec('@kill', '-KILL', '-' + found.pgid);
  }
}
