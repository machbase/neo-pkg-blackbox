'use strict';

var path = require('path');
var process = require('process');
var fs = require('fs');

var ROOT = path.resolve(path.dirname(process.argv[1]));
var BBOX_CONFIG = path.join(ROOT, '..', 'bbox', 'config', 'config.yaml');

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

function reply(status, data) {
  var body = JSON.stringify(data);
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('Status: ' + status + '\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

function parseBody() {
  var raw = process.stdin.readLine();
  if (!raw) return null;
  return JSON.parse(raw);
}

function toYaml(obj, indent) {
  indent = indent || 0;
  var lines = [];
  var prefix = '';
  for (var i = 0; i < indent; i++) prefix += '  ';

  for (var key in obj) {
    var val = obj[key];
    if (val === null || val === undefined) continue;

    if (Array.isArray(val)) {
      lines.push(prefix + key + ':');
      for (var j = 0; j < val.length; j++) {
        var item = val[j];
        if (typeof item === 'object') {
          var keys = Object.keys(item);
          lines.push(prefix + '  - ' + keys[0] + ': ' + JSON.stringify(String(item[keys[0]])));
          for (var k = 1; k < keys.length; k++) {
            lines.push(prefix + '    ' + keys[k] + ': ' + JSON.stringify(String(item[keys[k]])));
          }
        } else {
          lines.push(prefix + '  - ' + JSON.stringify(String(item)));
        }
      }
    } else if (typeof val === 'object') {
      lines.push(prefix + key + ':');
      lines.push(toYaml(val, indent + 1));
    } else if (typeof val === 'string') {
      lines.push(prefix + key + ': ' + JSON.stringify(val));
    } else {
      lines.push(prefix + key + ': ' + String(val));
    }
  }
  return lines.join('\n');
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
  var jsonPath = BBOX_CONFIG + '.json';
  if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }
  return null;
}

function saveConfig(cfg) {
  var configDir = path.dirname(BBOX_CONFIG);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  var yaml = toYaml(cfg);
  fs.writeFileSync(BBOX_CONFIG, yaml, 'utf8');
  fs.writeFileSync(BBOX_CONFIG + '.json', JSON.stringify(cfg, null, 2), 'utf8');
}

var method = (process.env.get('REQUEST_METHOD') || 'GET').toUpperCase();

if (method === 'GET') {
  // GET: 현재 config 반환 (password 제외)
  var cfg = loadCurrentConfig();
  if (!cfg) {
    reply(404, { ok: false, reason: 'config not found, POST to create' });
  } else {
    var res = JSON.parse(JSON.stringify(cfg));
    delete res.machbase.password;
    reply(200, { ok: true, data: res });
  }

} else if (method === 'POST') {
  // POST: 새 config 생성 (기본값 + 받은 값)
  var existing = loadCurrentConfig();
  if (existing) {
    reply(409, { ok: false, reason: 'config already exists, use PUT to update' });
  } else {
    var body = parseBody();
    if (!body) {
      reply(400, { ok: false, reason: 'request body is required' });
    } else {
      var cfg = JSON.parse(JSON.stringify(DEFAULTS));
      merge(cfg, body);
      fixNumbers(cfg);
      saveConfig(cfg);
      reply(201, { ok: true, data: { saved: BBOX_CONFIG } });
    }
  }

} else if (method === 'PUT') {
  // PUT: 기존 config에서 받은 필드만 덮어쓰기
  var existing = loadCurrentConfig();
  if (!existing) {
    reply(404, { ok: false, reason: 'config not found, POST to create first' });
  } else {
    var body = parseBody();
    if (!body) {
      reply(400, { ok: false, reason: 'request body is required' });
    } else {
      merge(existing, body);
      fixNumbers(existing);
      saveConfig(existing);
      reply(200, { ok: true, data: { saved: BBOX_CONFIG } });
    }
  }

} else {
  reply(405, { ok: false, reason: 'method not allowed' });
}
