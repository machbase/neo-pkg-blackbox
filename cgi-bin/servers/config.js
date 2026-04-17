'use strict';

const path = require('path');
const process = require('process');
const fs = require('fs');

const ROOT = path.resolve(path.dirname(process.argv[1]));
const BBOX_CONFIG = path.join(ROOT, '..', 'bbox', 'config', 'config.yaml');

// 기본 config 템플릿 (경로는 고정, 사용자 설정만 변경 가능)
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

// 간단한 YAML 생성 (의존성 없이)
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
          // array of objects: - flag: v\n  value: error
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

// 현재 config.yaml을 파싱 (간단한 YAML 파서 대신 기본값 + 저장된 JSON 사용)
function loadCurrentConfig() {
  var jsonPath = BBOX_CONFIG + '.json';
  if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function saveConfig(cfg) {
  var configDir = path.dirname(BBOX_CONFIG);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  // YAML로 저장
  var yaml = toYaml(cfg);
  fs.writeFileSync(BBOX_CONFIG, yaml, 'utf8');
  // JSON 백업 (다음 읽기용)
  fs.writeFileSync(BBOX_CONFIG + '.json', JSON.stringify(cfg, null, 2), 'utf8');
}

var method = (process.env.get('REQUEST_METHOD') || 'GET').toUpperCase();

if (method === 'GET') {
  // GET: 현재 config 반환
  var cfg = loadCurrentConfig();
  reply(200, {
    ok: true,
    data: {
      server: { addr: cfg.server.addr },
      machbase: {
        scheme: cfg.machbase.scheme,
        host: cfg.machbase.host,
        port: cfg.machbase.port,
        timeout_seconds: cfg.machbase.timeout_seconds,
        user: cfg.machbase.user
      },
      log: {
        level: cfg.log.level,
        format: cfg.log.format,
        output: cfg.log.output
      }
    }
  });

} else if (method === 'POST') {
  // POST: config 업데이트 (사용자 변경 가능 필드만)
  // {
  //   "server": { "addr": "0.0.0.0:8000" },
  //   "machbase": { "scheme": "http", "host": "192.168.0.87", "port": 5654, "user": "sys", "password": "manager" },
  //   "log": { "level": "info", "format": "json", "output": "both" }
  // }
  var body = parseBody();
  if (!body) {
    reply(400, { ok: false, reason: 'request body is required' });
  } else {
    var cfg = JSON.parse(JSON.stringify(DEFAULTS));

    // server
    if (body.server) {
      if (body.server.addr) cfg.server.addr = body.server.addr;
    }

    // machbase
    if (body.machbase) {
      if (body.machbase.scheme !== undefined) cfg.machbase.scheme = body.machbase.scheme;
      if (body.machbase.host !== undefined) cfg.machbase.host = body.machbase.host;
      if (body.machbase.port !== undefined) cfg.machbase.port = Number(body.machbase.port);
      if (body.machbase.timeout_seconds !== undefined) cfg.machbase.timeout_seconds = Number(body.machbase.timeout_seconds);
      if (body.machbase.user !== undefined) cfg.machbase.user = body.machbase.user;
      if (body.machbase.password !== undefined) cfg.machbase.password = body.machbase.password;
    }

    // log
    if (body.log) {
      if (body.log.level !== undefined) cfg.log.level = body.log.level;
      if (body.log.format !== undefined) cfg.log.format = body.log.format;
      if (body.log.output !== undefined) cfg.log.output = body.log.output;
    }

    saveConfig(cfg);
    reply(200, { ok: true, data: { saved: BBOX_CONFIG } });
  }

} else {
  reply(405, { ok: false, reason: 'method not allowed' });
}
