'use strict';

var path = require('path');
var process = require('process');
var fs = require('fs');

var ROOT = path.resolve(path.dirname(process.argv[1]));
var BBOX_CONFIG = path.join(ROOT, '..', 'bbox', 'config', 'config.json');

var DEFAULTS = {
  server: {
    addr: '0.0.0.0:8000',
    camera_dir: '../bin/cameras',
    mvs_dir: '../ai/mvs',
    data_dir: '../bin/data'
  },
  machbase: {
    scheme: 'http',
    host: '127.0.0.1',
    port: 5654,
    timeout_seconds: 30,
    api_token: '',
    user: 'sys',
    password: 'manager'
  },
  mediamtx: {
    binary: '../tools/mediamtx',
    config_file: '../tools/mediamtx.yml',
    host: '127.0.0.1',
    port: 9997
  },
  ffmpeg: {
    binary: '../tools/ffmpeg',
    defaults: {
      probe_binary: '../tools/ffprobe',
      probe_args: [
        { flag: 'v', value: 'error' },
        { flag: 'select_streams', value: 'v:0' },
        { flag: 'show_entries', value: 'packet=pts_time,duration_time' },
        { flag: 'of', value: 'csv=p=0' }
      ]
    }
  },
  ai: {
    binary: '../ai/blackbox-ai-manager',
    config_file: '../ai/config.json'
  },
  log: {
    dir: '../logs',
    level: 'info',
    format: 'json',
    output: 'both',
    file: {
      filename: 'blackbox.log',
      max_size: 100,
      max_backups: 10,
      max_age: 30,
      compress: true
    }
  }
};

var _tick = Date.now();

function reply(status, data, reason) {
  var elapse = (Date.now() - _tick) + 'ms';
  var success = status >= 200 && status < 300;
  var body = JSON.stringify({
    success: success,
    reason: reason || (success ? 'success' : 'error'),
    elapse: elapse,
    data: data !== undefined ? data : null
  });
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('Status: ' + status + '\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

function parseBody() {
  var lines = [];
  var line;
  while ((line = process.stdin.readLine()) !== null && line !== '') {
    lines.push(line);
  }
  var raw = lines.join('');
  if (!raw) return null;
  return JSON.parse(raw);
}

function merge(base, override) {
  if (!override) return base;
  for (var key in override) {
    if (override[key] !== undefined && override[key] !== null) {
      if (typeof override[key] === 'object' && !Array.isArray(override[key]) && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        base[key] = merge(base[key], override[key]);
      } else {
        base[key] = override[key];
      }
    }
  }
  return base;
}

function fixNumbers(cfg) {
  if (cfg.machbase) {
    if (cfg.machbase.port) cfg.machbase.port = Number(cfg.machbase.port);
    if (cfg.machbase.timeout_seconds) cfg.machbase.timeout_seconds = Number(cfg.machbase.timeout_seconds);
  }
  if (cfg.mediamtx && cfg.mediamtx.port) cfg.mediamtx.port = Number(cfg.mediamtx.port);
  if (cfg.log && cfg.log.file) {
    if (cfg.log.file.max_size) cfg.log.file.max_size = Number(cfg.log.file.max_size);
    if (cfg.log.file.max_backups) cfg.log.file.max_backups = Number(cfg.log.file.max_backups);
    if (cfg.log.file.max_age) cfg.log.file.max_age = Number(cfg.log.file.max_age);
  }
}

function loadCurrentConfig() {
  if (fs.existsSync(BBOX_CONFIG)) {
    return JSON.parse(fs.readFileSync(BBOX_CONFIG, 'utf8'));
  }
  return null;
}

function saveConfig(cfg) {
  var configDir = path.dirname(BBOX_CONFIG);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(BBOX_CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
}

var method = (process.env.get('REQUEST_METHOD') || 'GET').toUpperCase();

if (method === 'GET') {
  var cfg = loadCurrentConfig();
  if (!cfg) {
    reply(404, null, 'config not found, POST to create');
  } else {
    var res = JSON.parse(JSON.stringify(cfg));
    delete res.machbase.password;
    reply(200, res);
  }

} else if (method === 'POST') {
  var existing = loadCurrentConfig();
  if (existing) {
    reply(409, null, 'config already exists, use PUT to update');
  } else {
    var body = parseBody();
    if (!body) {
      reply(400, null, 'request body is required');
    } else {
      var cfg = JSON.parse(JSON.stringify(DEFAULTS));
      merge(cfg, body);
      fixNumbers(cfg);
      saveConfig(cfg);
      reply(201, null);
    }
  }

} else if (method === 'PUT') {
  var existing = loadCurrentConfig();
  if (!existing) {
    reply(404, null, 'config not found, POST to create first');
  } else {
    var body = parseBody();
    if (!body) {
      reply(400, null, 'request body is required');
    } else {
      merge(existing, body);
      fixNumbers(existing);
      saveConfig(existing);
      reply(200, null);
    }
  }

} else {
  reply(405, null, 'method not allowed');
}
