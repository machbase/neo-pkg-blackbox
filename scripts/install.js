'use strict';

var path = require('path');
var process = require('process');
var fs = require('fs');
var os = require('os');

var ROOT = path.resolve(path.dirname(process.argv[1]));   // /work/.../scripts
var PKG_DIR = path.dirname(ROOT);                          // /work/.../neo-pkg-blackbox
var CGI_BIN = path.join(PKG_DIR, 'cgi-bin');
var BBOX_DIR = path.join(CGI_BIN, 'bbox');
var LAUNCHER = path.join(CGI_BIN, 'blackbox-launcher.js');
var SERVICE_NAME = 'neo-pkg-blackbox';
var REPO = 'machbase/neo-pkg-bbox';
// Keep this package on the native release compatible with Machbase Neo 8.5.x.
var BBOX_VERSION = 'v0.2.5';
var IS_WIN = os.platform() === 'windows';
var HOST_PATH = IS_WIN ? path.win32 : path;
var BIN_NAME = IS_WIN ? 'neo-blackbox.exe' : 'neo-blackbox';
var ARCHIVE_EXT = IS_WIN ? '.zip' : '.tar.gz';

function detectPlatform() {
  var platform = os.platform();
  var arch = os.arch();

  var osPart;
  if (platform === 'darwin') osPart = 'darwin';
  else if (platform === 'windows') osPart = 'windows';
  else osPart = 'linux';

  var archPart;
  if (arch === 'aarch64' || arch === 'arm64') archPart = 'arm64';
  else archPart = 'amd64';

  return osPart + '-' + archPart;
}

// 설치 직전 좀비 bbox 프로세스 정리. JSH 재시작으로 tracker 초기화된
// orphan 은 OS 레벨 kill 로 fallback, 그 외엔 /proc/process 로 PID 추적.
function preemptiveKill() {
  try {
    if (IS_WIN) {
      // /T 로 자식 트리 (mediamtx/ffmpeg 등) 까지 함께 정리 — 부모만 죽이면 자손이 좀비.
      process.exec('@taskkill', '/F', '/T', '/IM', BIN_NAME);
    } else {
      process.exec('@pkill', '-9', '-x', 'neo-blackbox');
    }
  } catch (e) {}

  var procRoot = '/proc/process';
  if (!fs.existsSync(procRoot)) return;

  var re = /[\/\\]neo-blackbox(\.exe)?(\s|$|"|')/;
  var found = null;
  var entries = fs.readdirSync(procRoot);
  for (var i = 0; i < entries.length; i++) {
    var metaPath = path.join(procRoot, entries[i], 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      var meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      var exe = meta.exec_path || meta.command || '';
      var args = meta.args || [];
      var match = re.test(exe);
      for (var j = 0; !match && j < args.length; j++) {
        match = re.test(String(args[j]));
      }
      if (match) {
        found = { pid: meta.pid, pgid: meta.pgid > 0 ? meta.pgid : meta.pid };
        break;
      }
    } catch (e) {}
  }

  if (!found) return;
  console.println('preemptive kill: pid=' + found.pid + ' pgid=' + found.pgid);

  if (IS_WIN) {
    try { process.exec('@taskkill', '/T', '/PID', String(found.pid)); } catch (e) {}
    try { process.exec('@taskkill', '/F', '/T', '/PID', String(found.pid)); } catch (e) {}
  } else {
    try { process.exec('@kill', '-TERM', '-' + found.pgid); } catch (e) {}
    try { process.exec('@kill', '-KILL', '-' + found.pgid); } catch (e) {}
  }
}

function hostPath(virtualPath) {
  if (virtualPath !== '/work' && virtualPath.indexOf('/work/') !== 0) {
    throw new Error('installer path must be under /work: ' + virtualPath);
  }
  var relative = virtualPath.substring('/work'.length).replace(/^\/+/, '');
  var hostWorkDir = HOST_PATH.dirname(process.execPath);
  if (!relative) return hostWorkDir;
  return HOST_PATH.join.apply(HOST_PATH, [hostWorkDir].concat(relative.split('/')));
}

function runExternal(command, args, label) {
  var code = process.exec.apply(process, ['@' + command].concat(args));
  if (code !== 0) {
    throw new Error(label + ' failed (exit code ' + code + ')');
  }
}

function powerShellQuote(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

// Keep the large native archive outside the JSH heap, as in the newer installer.
function download(url, destPath, callback) {
  try {
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    var hostDestPath = hostPath(destPath);
    if (IS_WIN) {
      runExternal('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
        "$ErrorActionPreference = 'Stop'; Invoke-WebRequest -UseBasicParsing -Uri " +
          powerShellQuote(url) + ' -OutFile ' + powerShellQuote(hostDestPath),
      ], 'download');
    } else {
      runExternal('curl', [
        '--fail', '--location', '--silent', '--show-error',
        '--retry', '3', '--connect-timeout', '30',
        '--output', hostDestPath, url,
      ], 'download');
    }
    if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
      throw new Error('empty download');
    }
    callback(null);
  } catch (err) {
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    callback(err);
  }
}

function extract(archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (IS_WIN) {
    // Expand into a temporary directory so an existing installation can be overlaid.
    var stageDir = destDir + '.extracting';
    var ps = [
      "$ErrorActionPreference = 'Stop'",
      'try {',
      'Expand-Archive -LiteralPath ' + powerShellQuote(hostPath(archivePath)) +
        ' -DestinationPath ' + powerShellQuote(hostPath(stageDir)) + ' -Force',
      '$roots = @(Get-ChildItem -LiteralPath ' + powerShellQuote(hostPath(stageDir)) + ')',
      'if ($roots.Count -ne 1 -or -not $roots[0].PSIsContainer) { throw "invalid package root" }',
      'Get-ChildItem -LiteralPath $roots[0].FullName | Copy-Item -Destination ' +
        powerShellQuote(hostPath(destDir)) + ' -Recurse -Force',
      '} finally {',
      'if (Test-Path -LiteralPath ' + powerShellQuote(hostPath(stageDir)) +
        ') { Remove-Item -LiteralPath ' + powerShellQuote(hostPath(stageDir)) + ' -Recurse -Force }',
      '}',
    ].join('; ');
    runExternal('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps,
    ], 'extract');
  } else {
    runExternal('tar', [
      '-xzf', hostPath(archivePath), '-C', hostPath(destDir),
      '--strip-components=1', '--no-same-owner',
    ], 'extract');
  }
}

// ── main ──

var platform = detectPlatform();
var assetName = 'neo-blackbox-' + platform + ARCHIVE_EXT;
var url = 'https://github.com/' + REPO + '/releases/download/' + BBOX_VERSION + '/' + assetName;

console.println('platform:', platform);
console.println('downloading:', url);

preemptiveKill();

var tmpFile = path.join(CGI_BIN, '.bbox-download' + ARCHIVE_EXT);
download(url, tmpFile, function(err) {
  if (err) {
    console.println('ERROR:', err.message);
    process.exit(1);
  }

  console.println('extracting to:', BBOX_DIR);
  try {
    extract(tmpFile, BBOX_DIR);
    fs.unlinkSync(tmpFile);
  } catch (exErr) {
    console.println('ERROR:', exErr.message);
    process.exit(1);
  }

  // 바이너리 존재 확인 (설치 실패 조기 감지)
  var binPath = path.join(BBOX_DIR, 'bin', BIN_NAME);
  if (!fs.existsSync(binPath)) {
    console.println('ERROR: binary missing:', binPath);
    process.exit(1);
  }
  console.println('verified binary:', binPath);

  // macOS quarantine 속성 제거 (인터넷에서 받은 파일 실행 차단 방지)
  if (os.platform() === 'darwin') {
    // JSH 가상경로 → 호스트 OS 경로 변환
    var hostWorkDir = path.dirname(process.execPath);
    var relBboxDir = BBOX_DIR.replace(/^\/work\//, '');
    var hostBboxDir = path.join(hostWorkDir, relBboxDir);
    console.println('removing quarantine attributes...', hostBboxDir);
    process.exec('@/usr/bin/xattr', '-cr', hostBboxDir);
  }

  // launcher.js 실행 권한 부여 (pkg copy 시 권한이 유지되지 않음)
  if (fs.existsSync(LAUNCHER)) {
    fs.chmod(LAUNCHER, 0o755);
    console.println('chmod +x', LAUNCHER);
  }

  console.println('done. bbox installed at', BBOX_DIR);
  // config 는 tarball 의 bbox/config/config.yaml 그대로 사용.
  // 조회/수정은 bbox 네이티브 API (/api/config) 가 담당.

  // 서비스 등록 → 시작 (CLI 풀 셋업)
  installService(function(insErr) {
    if (insErr) {
      console.println('ERROR install:', insErr.message);
      process.exit(1);
    }
    startService(function(startErr) {
      if (startErr) {
        console.println('ERROR start:', startErr.message);
        process.exit(1);
      }
      console.println('all done. service', SERVICE_NAME, 'is running.');
    });
  });
});

function installService(callback) {
  var service = require('service');
  console.println('installing service:', SERVICE_NAME);
  service.install({
    name: SERVICE_NAME,
    working_dir: BBOX_DIR,
    executable: LAUNCHER,
  }, function(err) {
    if (err) callback(err);
    else {
      console.println('service installed.');
      callback(null);
    }
  });
}

function startService(callback) {
  var service = require('service');
  console.println('starting service:', SERVICE_NAME);
  service.start(SERVICE_NAME, function(err) {
    if (err) callback(err);
    else {
      console.println('service started.');
      callback(null);
    }
  });
}
