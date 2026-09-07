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

  var hostWorkDir = HOST_PATH.dirname(process.execPath);
  var relative = virtualPath.substring('/work'.length).replace(/^\/+/, '');
  if (!relative) return hostWorkDir;
  return HOST_PATH.join.apply(HOST_PATH, [hostWorkDir].concat(relative.split('/')));
}

function removePath(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
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

function download(url, destPath, callback) {
  try {
    removePath(destPath);
    var hostDestPath = hostPath(destPath);

    if (IS_WIN) {
      var ps = [
        "$ErrorActionPreference = 'Stop'",
        'Invoke-WebRequest -UseBasicParsing -Uri ' + powerShellQuote(url) +
          ' -OutFile ' + powerShellQuote(hostDestPath),
      ].join('; ');
      runExternal(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
        'download'
      );
    } else {
      runExternal(
        'curl',
        [
          '--fail', '--location', '--silent', '--show-error',
          '--retry', '3', '--connect-timeout', '30',
          '--output', hostDestPath, url,
        ],
        'download'
      );
    }

    if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
      throw new Error('empty download');
    }
    callback(null);
  } catch (err) {
    removePath(destPath);
    callback(err);
  }
}

function directoryEntries(dirPath) {
  var names = fs.readdirSync(dirPath);
  var result = [];
  for (var i = 0; i < names.length; i++) {
    if (names[i] !== '.' && names[i] !== '..') result.push(names[i]);
  }
  return result;
}

function normalizePackageRoot(stageDir) {
  var directBinary = path.join(stageDir, 'bin', BIN_NAME);
  if (fs.existsSync(directBinary)) return;

  var entries = directoryEntries(stageDir);
  if (entries.length !== 1) {
    throw new Error('archive must contain one package root directory');
  }

  var packageRoot = path.join(stageDir, entries[0]);
  if (!fs.statSync(packageRoot).isDirectory() ||
      !fs.existsSync(path.join(packageRoot, 'bin', BIN_NAME))) {
    throw new Error('archive does not contain bin/' + BIN_NAME);
  }

  var children = directoryEntries(packageRoot);
  for (var i = 0; i < children.length; i++) {
    fs.renameSync(path.join(packageRoot, children[i]), path.join(stageDir, children[i]));
  }
  fs.rmdirSync(packageRoot);
}

function extract(archivePath, stageDir) {
  removePath(stageDir);
  fs.mkdirSync(stageDir, { recursive: true });

  try {
    var hostArchivePath = hostPath(archivePath);
    var hostStageDir = hostPath(stageDir);

    if (IS_WIN) {
      var ps = [
        "$ErrorActionPreference = 'Stop'",
        'Expand-Archive -LiteralPath ' + powerShellQuote(hostArchivePath) +
          ' -DestinationPath ' + powerShellQuote(hostStageDir) + ' -Force',
      ].join('; ');
      runExternal(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
        'extract'
      );
    } else {
      runExternal(
        'tar',
        ['-xzf', hostArchivePath, '-C', hostStageDir, '--no-same-owner'],
        'extract'
      );
    }

    normalizePackageRoot(stageDir);
  } catch (err) {
    removePath(stageDir);
    throw err;
  }
}

function replaceInstallation(stageDir, destDir) {
  var backupDir = destDir + '.previous';

  if (fs.existsSync(backupDir) && !fs.existsSync(destDir)) {
    fs.renameSync(backupDir, destDir);
  }
  removePath(backupDir);

  if (fs.existsSync(destDir)) fs.renameSync(destDir, backupDir);
  try {
    fs.renameSync(stageDir, destDir);
    removePath(backupDir);
  } catch (err) {
    if (!fs.existsSync(destDir) && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, destDir);
    }
    throw err;
  }
}

// ── main ──

var platform = detectPlatform();
var assetName = 'neo-blackbox-' + platform + ARCHIVE_EXT;
// GitHub /releases/latest/download/ 는 최신 릴리스 asset으로 자동 리다이렉트 (API rate limit 없음)
var url = 'https://github.com/' + REPO + '/releases/latest/download/' + assetName;

console.println('platform:', platform);
console.println('downloading:', url);

preemptiveKill();

var tmpFile = path.join(CGI_BIN, '.bbox-download' + ARCHIVE_EXT);
var stageDir = path.join(CGI_BIN, '.bbox-installing');

function cleanupTemporaryArtifacts() {
  removePath(tmpFile);
  removePath(stageDir);
}

// 이전 설치가 강제 중단됐더라도 새 설치를 깨끗한 상태에서 시작한다.
cleanupTemporaryArtifacts();
// 정상 종료와 process.exit() 경로에서도 순수 임시 artifact를 남기지 않는다.
process.addShutdownHook(cleanupTemporaryArtifacts);

download(url, tmpFile, function(err) {
  if (err) {
    removePath(stageDir);
    console.println('ERROR:', err.message);
    process.exit(1);
  }

  console.println('extracting to:', BBOX_DIR);
  try {
    extract(tmpFile, stageDir);
    var stagedBinPath = path.join(stageDir, 'bin', BIN_NAME);
    if (!fs.existsSync(stagedBinPath)) {
      throw new Error('binary missing: ' + stagedBinPath);
    }
    replaceInstallation(stageDir, BBOX_DIR);
  } catch (exErr) {
    console.println('ERROR:', exErr.message);
    removePath(stageDir);
    removePath(tmpFile);
    process.exit(1);
  }
  removePath(tmpFile);

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
