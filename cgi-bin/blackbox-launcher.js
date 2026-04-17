'use strict';

var process = require('process');
var path = require('path');

var SCRIPT_DIR = path.resolve(path.dirname(process.argv[1]));
var BBOX_DIR = path.join(SCRIPT_DIR, 'bbox');

var executable = path.join(BBOX_DIR, 'bin', 'neo-blackbox');
var configFile = path.join(BBOX_DIR, 'config', 'config.json');

console.println('launching:', executable);
console.println('config:', configFile);

var exitCode = process.exec('@' + executable, '-config', configFile, '-web');
process.exit(exitCode);
