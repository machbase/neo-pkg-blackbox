'use strict';

const path = require('path');
const process = require('process');
const fs = require('fs');
const service = require('service');

const ROOT = path.resolve(path.dirname(process.argv[1]));
const BBOX_DIR = path.join(ROOT, 'bbox');
const SERVICE_NAME = 'neo-blackbox';
const EXECUTABLE = path.join(BBOX_DIR, 'bin', 'neo-blackbox');
const CONFIG_FILE = path.join(BBOX_DIR, 'config', 'config.yaml');

function reply(data) {
  const body = JSON.stringify(data);
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

const method = (process.env.get('REQUEST_METHOD') || 'GET').toUpperCase();
if (method !== 'POST') {
  reply({ ok: false, reason: 'method not allowed' });
} else if (!fs.existsSync(EXECUTABLE)) {
  reply({ ok: false, reason: 'bbox binary not found: ' + EXECUTABLE });
} else {
  service.install({
    name: SERVICE_NAME,
    enable: false,
    working_dir: BBOX_DIR,
    executable: EXECUTABLE,
    args: ['-config', CONFIG_FILE],
  }, (err) => {
    if (err) {
      reply({ ok: false, reason: err.message || String(err) });
    } else {
      reply({ ok: true, data: { name: SERVICE_NAME } });
    }
  });
}
