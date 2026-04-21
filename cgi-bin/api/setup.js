'use strict';

const path = require('path');
const process = require('process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const tar = require('archive/tar');

const ROOT = path.resolve(path.dirname(process.argv[1]));
const CGI_BIN = path.resolve(ROOT, '..');
const BBOX_DIR = path.join(CGI_BIN, 'bbox');
const REPO = 'machbase/neo-pkg-bbox';

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

function download(url, destPath, callback) {
  const MAX_REDIRECTS = 10;
  const headers = { 'User-Agent': 'neo-pkg-blackbox' };

  function fetch(fetchUrl, remaining) {
    http.get(fetchUrl, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        const location = res.headers && res.headers.location;
        if (!location) {
          callback(new Error('redirect ' + res.statusCode + ' without location'));
          return;
        }
        if (remaining <= 0) {
          callback(new Error('too many redirects'));
          return;
        }
        fetch(location, remaining - 1);
        return;
      }
      if (!res.ok) {
        callback(new Error('HTTP ' + res.statusCode));
        return;
      }
      const buffer = res.readBodyBuffer();
      if (!buffer || buffer.byteLength === 0) {
        callback(new Error('empty download'));
        return;
      }
      fs.writeFileSync(destPath, buffer);
      callback(null);
    });
  }

  fetch(url, MAX_REDIRECTS);
}

function extractTarGz(tarPath, destDir) {
  const zlib = require('zlib');
  const compressed = fs.readFileSync(tarPath, { encoding: 'buffer' });
  const decompressed = zlib.gunzipSync(compressed);
  const entries = tar.untarSync(decompressed);

  fs.mkdirSync(destDir, { recursive: true });

  for (const entry of entries) {
    const parts = entry.name.split('/');
    if (parts.length > 1) {
      parts.shift();
    }
    const relativePath = parts.join('/');
    if (!relativePath) continue;

    const fullPath = path.join(destDir, relativePath);
    if (entry.isDir) {
      fs.mkdirSync(fullPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, entry.data);
      if (entry.mode) {
        fs.chmod(fullPath, entry.mode & 0o777);
      }
    }
  }
}

// ── main ──

const platform = detectPlatform();
const assetName = `neo-blackbox-${platform}.tar.gz`;
// GitHub /releases/latest/download/ 는 최신 릴리스 asset으로 자동 리다이렉트 (API rate limit 없음)
const url = `https://github.com/${REPO}/releases/latest/download/${assetName}`;

log('platform:', platform);
log('downloading:', url);

const tmpFile = path.join(CGI_BIN, '.bbox-download.tar.gz');
download(url, tmpFile, (err) => {
  if (err) {
    reply({ ok: false, reason: err.message || String(err), log: logs });
    return;
  }

  log('extracting to:', BBOX_DIR);
  try {
    extractTarGz(tmpFile, BBOX_DIR);
    fs.unlinkSync(tmpFile);
  } catch (exErr) {
    reply({ ok: false, reason: exErr.message || String(exErr), log: logs });
    return;
  }

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
