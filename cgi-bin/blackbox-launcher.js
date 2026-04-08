'use strict';

const process = require('process');
const path = require('path');

// argv[1]은 JSH 가상 경로: /work/public/blackbox/cgi-bin/bbox/blackbox-launcher.js
// argv[0]은 호스트 경로: /home/aloha/tmp/machbase-neo
// JSH의 /work 마운트 포인트에서 호스트 경로를 역산할 수 없으므로
// process.execPath (호스트 실행파일 경로)의 디렉토리를 기준으로
// /work 마운트 포인트를 추정

// JSH 가상 경로 기준
const SCRIPT_DIR = path.resolve(path.dirname(process.argv[1]));
const BBOX_DIR = path.join(SCRIPT_DIR, 'bbox');
const BIN_NAME = 'neo-blackbox';
const CONFIG_NAME = path.join('config', 'config.yaml');

// 호스트 경로: execPath의 디렉토리가 /work 마운트 포인트
const hostWorkDir = path.dirname(process.execPath);
// /work/public/blackbox/cgi-bin/bbox → public/blackbox/cgi-bin/bbox
const relPath = BBOX_DIR.replace(/^\/work\//, '');
const hostBboxDir = path.join(hostWorkDir, relPath);

const executable = path.join(hostBboxDir, 'bin', BIN_NAME);
const configFile = path.join(hostBboxDir, CONFIG_NAME);

console.println('launching:', executable);
console.println('config:', configFile);

const exitCode = process.exec('@' + executable, '-config', configFile);
process.exit(exitCode);
