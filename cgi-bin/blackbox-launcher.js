'use strict';

var process = require('process');
var path = require('path');

// JSH 가상경로 → 호스트 OS 경로 변환
var hostWorkDir = path.dirname(process.execPath);
var SCRIPT_DIR = path.resolve(path.dirname(process.argv[1]));
var BBOX_DIR = path.join(SCRIPT_DIR, 'bbox');
var relBboxDir = BBOX_DIR.replace(/^\/work\//, '');
var hostBboxDir = path.join(hostWorkDir, relBboxDir);

var executable = path.join(hostBboxDir, 'bin', 'neo-blackbox');
var configFile = path.join(hostBboxDir, 'config', 'config.json');

console.println('launching:', executable);
console.println('config:', configFile);

var exitCode = process.exec('@' + executable, '-config', configFile, '-web');
process.exit(exitCode);
