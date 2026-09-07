'use strict';

const path = require('path');
const process = require('process');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(path.dirname(process.argv[1]));
const CGI_BIN = path.resolve(ROOT, '..');
const BBOX_DIR = path.join(CGI_BIN, 'bbox');
const REPO = 'machbase/neo-pkg-bbox';
const IS_WIN = os.platform() === 'windows';
const HOST_PATH = IS_WIN ? path.win32 : path;
const BIN_NAME = IS_WIN ? 'neo-blackbox.exe' : 'neo-blackbox';
const ARCHIVE_EXT = IS_WIN ? '.zip' : '.tar.gz';

const logs = [];
function log() {
  const parts = [];
  for (let i = 0; i < arguments.length; i++) {
    const a = arguments[i];
    parts.push(typeof a === 'string' ? a : JSON.stringify(a));
  }
  logs.push(parts.join(' '));
}

function reply(data) {
  const body = JSON.stringify(data);
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

function detectPlatform() {
  const platform = os.platform();
  const arch = os.arch();

  let osPart;
  if (platform === 'darwin') osPart = 'darwin';
  else if (platform === 'windows') osPart = 'windows';
  else osPart = 'linux';

  let archPart;
  if (arch === 'aarch64' || arch === 'arm64') archPart = 'arm64';
  else archPart = 'amd64';

  return `${osPart}-${archPart}`;
}

function hostPath(virtualPath) {
  if (virtualPath !== '/work' && !virtualPath.startsWith('/work/')) {
    throw new Error('installer path must be under /work: ' + virtualPath);
  }

  const hostWorkDir = HOST_PATH.dirname(process.execPath);
  const relative = virtualPath.substring('/work'.length).replace(/^\/+/, '');
  if (!relative) return hostWorkDir;
  return HOST_PATH.join.apply(HOST_PATH, [hostWorkDir].concat(relative.split('/')));
}

function removePath(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function runExternal(command, args, label) {
  const code = process.exec.apply(process, ['@' + command].concat(args));
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
    const hostDestPath = hostPath(destPath);

    if (IS_WIN) {
      const ps = [
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
  return fs.readdirSync(dirPath).filter((name) => name !== '.' && name !== '..');
}

function normalizePackageRoot(stageDir) {
  const directBinary = path.join(stageDir, 'bin', BIN_NAME);
  if (fs.existsSync(directBinary)) return;

  const entries = directoryEntries(stageDir);
  if (entries.length !== 1) {
    throw new Error('archive must contain one package root directory');
  }

  const packageRoot = path.join(stageDir, entries[0]);
  if (!fs.statSync(packageRoot).isDirectory() ||
      !fs.existsSync(path.join(packageRoot, 'bin', BIN_NAME))) {
    throw new Error('archive does not contain bin/' + BIN_NAME);
  }

  for (const child of directoryEntries(packageRoot)) {
    fs.renameSync(path.join(packageRoot, child), path.join(stageDir, child));
  }
  fs.rmdirSync(packageRoot);
}

function extract(archivePath, stageDir) {
  removePath(stageDir);
  fs.mkdirSync(stageDir, { recursive: true });

  try {
    const hostArchivePath = hostPath(archivePath);
    const hostStageDir = hostPath(stageDir);

    if (IS_WIN) {
      const ps = [
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
  const backupDir = destDir + '.previous';

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

const platform = detectPlatform();
const assetName = `neo-blackbox-${platform}${ARCHIVE_EXT}`;
// GitHub /releases/latest/download/ 는 최신 릴리스 asset으로 자동 리다이렉트 (API rate limit 없음)
const url = `https://github.com/${REPO}/releases/latest/download/${assetName}`;

log('platform:', platform);
log('downloading:', url);

const tmpFile = path.join(CGI_BIN, '.bbox-download' + ARCHIVE_EXT);
const stageDir = path.join(CGI_BIN, '.bbox-installing');

function cleanupTemporaryArtifacts() {
  removePath(tmpFile);
  removePath(stageDir);
}

// 이전 설치가 강제 중단됐더라도 새 설치를 깨끗한 상태에서 시작한다.
cleanupTemporaryArtifacts();
// 정상 종료 시에도 순수 임시 artifact를 남기지 않는다.
process.addShutdownHook(cleanupTemporaryArtifacts);

download(url, tmpFile, (err) => {
  if (err) {
    removePath(stageDir);
    reply({ ok: false, reason: err.message || String(err), log: logs });
    return;
  }

  log('extracting to:', BBOX_DIR);
  try {
    extract(tmpFile, stageDir);
    const stagedBinPath = path.join(stageDir, 'bin', BIN_NAME);
    if (!fs.existsSync(stagedBinPath)) {
      throw new Error('binary missing: ' + stagedBinPath);
    }
    replaceInstallation(stageDir, BBOX_DIR);
  } catch (exErr) {
    removePath(stageDir);
    removePath(tmpFile);
    reply({ ok: false, reason: exErr.message || String(exErr), log: logs });
    return;
  }
  removePath(tmpFile);

  // 바이너리 존재 확인 (설치 실패 조기 감지)
  const binPath = path.join(BBOX_DIR, 'bin', BIN_NAME);
  if (!fs.existsSync(binPath)) {
    reply({ ok: false, reason: 'binary missing: ' + binPath, log: logs });
    return;
  }
  log('verified binary:', binPath);

  // macOS quarantine 속성 제거 (인터넷에서 받은 파일 실행 차단 방지)
  if (os.platform() === 'darwin') {
    const hostWorkDir = path.dirname(process.execPath);
    const relBboxDir = BBOX_DIR.replace(/^\/work\//, '');
    const hostBboxDir = path.join(hostWorkDir, relBboxDir);
    log('removing quarantine attributes...', hostBboxDir);
    process.exec('@/usr/bin/xattr', '-cr', hostBboxDir);
  }

  // launcher.js 실행 권한 부여 (pkg copy 시 권한이 유지되지 않음)
  const launcherPath = path.join(CGI_BIN, 'blackbox-launcher.js');
  if (fs.existsSync(launcherPath)) {
    fs.chmod(launcherPath, 0o755);
    log('chmod +x', launcherPath);
  }

  log('done. bbox installed at', BBOX_DIR);
  reply({ ok: true, data: { path: BBOX_DIR, log: logs } });
});
