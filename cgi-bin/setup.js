'use strict';

var path = require('path');
var process = require('process');
var http = require('http');
var fs = require('fs');
var os = require('os');
var tar = require('archive/tar');

var ROOT = path.resolve(path.dirname(process.argv[1]));
var BBOX_DIR = path.join(ROOT, 'bbox');
var REPO = 'machbase/neo-pkg-bbox';

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

function download(url, destPath, callback) {
  var MAX_REDIRECTS = 10;
  var headers = { 'User-Agent': 'neo-pkg-blackbox' };

  function fetch(fetchUrl, remaining) {
    http.get(fetchUrl, { headers: headers }, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        var location = res.headers && res.headers.location;
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
      var buffer = res.readBodyBuffer();
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
  var zlib = require('zlib');
  var compressed = fs.readFileSync(tarPath, { encoding: 'buffer' });
  var decompressed = zlib.gunzipSync(compressed);
  var entries = tar.untarSync(decompressed);

  fs.mkdirSync(destDir, { recursive: true });

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var parts = entry.name.split('/');
    if (parts.length > 1) {
      parts.shift();
    }
    var relativePath = parts.join('/');
    if (!relativePath) continue;

    var fullPath = path.join(destDir, relativePath);
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

var platform = detectPlatform();
var assetName = 'neo-blackbox-' + platform + '.tar.gz';
// GitHub /releases/latest/download/ 는 최신 릴리스 asset으로 자동 리다이렉트 (API rate limit 없음)
var url = 'https://github.com/' + REPO + '/releases/latest/download/' + assetName;

console.println('platform:', platform);
console.println('downloading:', url);

var tmpFile = path.join(ROOT, '.bbox-download.tar.gz');
download(url, tmpFile, function(err) {
  if (err) {
    console.println('ERROR:', err.message);
    process.exit(1);
  }

  console.println('extracting to:', BBOX_DIR);
  try {
    extractTarGz(tmpFile, BBOX_DIR);
    fs.unlinkSync(tmpFile);
  } catch (exErr) {
    console.println('ERROR:', exErr.message);
    process.exit(1);
  }

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
  var launcherPath = path.join(ROOT, 'blackbox-launcher.js');
  if (fs.existsSync(launcherPath)) {
    fs.chmod(launcherPath, 0o755);
    console.println('chmod +x', launcherPath);
  }

  console.println('done. bbox installed at', BBOX_DIR);
});
