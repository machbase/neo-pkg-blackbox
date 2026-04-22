'use strict';

// bbox 바이너리 포트 반환. 프론트가 API_BASE 구성 시 사용.
// config.json 의 server.addr 에서 추출, 없으면 기본 8000.

const path = require('path');
const process = require('process');
const fs = require('fs');

const ARGV1 = process.argv[1];
const APP_DIR = ARGV1.slice(0, ARGV1.lastIndexOf('/cgi-bin/') + '/cgi-bin'.length);
const CONFIG_FILE = path.join(APP_DIR, 'bbox', 'config', 'config.json');

function reply(data) {
  const body = JSON.stringify(data);
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

let port = '8000';
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (cfg.server && cfg.server.addr) {
      const m = String(cfg.server.addr).match(/:(\d+)$/);
      if (m) port = m[1];
    }
  }
} catch (e) {
  // ignore — fall back to default
}

reply({ ok: true, data: { port } });
