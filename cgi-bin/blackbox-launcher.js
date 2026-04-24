'use strict';

// JSH 런타임에서 실행됨. bbox/bin/neo-blackbox 을 config 와 함께 기동.
// Linux / macOS / Windows 공통 지원.

var process = require('process');
var pathLib = require('path');
var os = require('os');
var fs = require('fs');

var IS_WIN = os.platform() === 'windows';
var posix = pathLib;
var hostPath = IS_WIN ? pathLib.win32 : pathLib;
var BIN_NAME = IS_WIN ? 'neo-blackbox.exe' : 'neo-blackbox';

// ── JSH 가상경로 (POSIX 고정) ──
var SCRIPT_DIR = posix.resolve(posix.dirname(process.argv[1]));   // /work/.../cgi-bin
var BBOX_DIR = posix.join(SCRIPT_DIR, 'bbox');                    // /work/.../cgi-bin/bbox

// ── 호스트 경로 변환 ──
var hostWorkDir = hostPath.dirname(process.execPath);
var relFromWork = BBOX_DIR.replace(/^\/work\//, '');
var hostBboxDir = hostPath.join(hostWorkDir, relFromWork);
var executable = hostPath.join(hostBboxDir, 'bin', BIN_NAME);
var configFile = hostPath.join(hostBboxDir, 'config', 'config.yaml');

console.println('launching:', executable);
console.println('config:', configFile);
console.println('cwd:', hostBboxDir);

var exitCode;
if (IS_WIN) {
  // cmd.exe /C "명령" 전달 시 Go 의 Windows escape(` -> \")가 cmd 파서와 불일치 → 따옴표 깨짐.
  // 회피: .bat 파일로 저장 후 실행 (cmd 가 파일 읽을 때는 따옴표 정상 해석)
  var batVirtual = posix.join(BBOX_DIR, '_launch.bat');
  var batHost = hostPath.join(hostBboxDir, '_launch.bat');
  var batContent = [
    '@echo off',
    'cd /d "' + hostBboxDir + '"',
    '"' + executable + '" -config "' + configFile + '" -web',
  ].join('\r\n') + '\r\n';
  fs.writeFileSync(batVirtual, batContent);
  exitCode = process.exec('@cmd.exe', '/C', batHost);
} else {
  var script = 'cd "' + hostBboxDir + '" && exec "' + executable + '" -config "' + configFile + '" -web';
  exitCode = process.exec('@/bin/sh', '-c', script);
}
process.exit(exitCode);
