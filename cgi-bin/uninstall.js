'use strict';

var path = require('path');
var process = require('process');
var fs = require('fs');
var os = require('os');
var service = require('service');

var ROOT = path.resolve(path.dirname(process.argv[1]));    // /work/.../cgi-bin
var PKG_DIR = path.dirname(ROOT);                          // /work/.../neo-pkg-blackbox
var SERVICE_NAME = 'neo-blackbox';
var IS_WIN = os.platform() === 'windows';
var BINARY_NAME = IS_WIN ? 'neo-blackbox.exe' : 'neo-blackbox';

// 안전장치: 패키지 디렉토리 형태(.../cgi-bin 의 부모)인지만 지운다
if (path.basename(ROOT) !== 'cgi-bin' || PKG_DIR === '/' || PKG_DIR === '') {
  console.println('ERROR: refusing to remove unsafe path:', PKG_DIR);
  process.exit(1);
}

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
    // 등록 안 돼있어도 다음 단계 진행
    console.println('WARN uninstall:', err.message);
  } else {
    console.println('service uninstalled.');
  }

  // 3. 패키지 디렉토리 전체 제거 (자기 자신 포함)
  //    JSH 가상경로(/work/...) → 호스트 OS 경로 변환 후 rm -rf
  if (!fs.existsSync(PKG_DIR)) {
    console.println('package dir not found:', PKG_DIR);
    console.println('all done.');
    return;
  }

  var hostWorkDir = path.dirname(process.execPath);
  var relPkgDir = PKG_DIR.replace(/^\/work\//, '');
  var hostPkgDir = path.join(hostWorkDir, relPkgDir);
  console.println('removing package:', hostPkgDir);
  if (IS_WIN) {
    process.exec('@cmd.exe', '/C', 'rmdir', '/S', '/Q', hostPkgDir);
  } else {
    process.exec('@/bin/rm', '-rf', hostPkgDir);
  }
  console.println('all done. package removed.');
});
