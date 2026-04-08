'use strict';

const path = require('path');
const process = require('process');
const fs = require('fs');
const service = require('service');

const ROOT = path.resolve(path.dirname(process.argv[1]));
const BBOX_DIR = path.join(ROOT, 'bbox');
const SERVICE_NAME = 'neo-blackbox';
const LAUNCHER = path.join(ROOT, 'blackbox-launcher.js');

function reply(data) {
  const body = JSON.stringify(data);
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

const method = (process.env.get('REQUEST_METHOD') || 'GET').toUpperCase();
if (method !== 'POST') {
  reply({ ok: false, reason: 'method not allowed' });
} else if (!fs.existsSync(LAUNCHER)) {
  reply({ ok: false, reason: 'launcher not found: ' + LAUNCHER });
} else {
  service.install({
    name: SERVICE_NAME,
    enable: false,
    working_dir: BBOX_DIR,
    executable: LAUNCHER,
  }, (err) => {
    if (err) {
      reply({ ok: false, reason: err.message || String(err) });
    } else {
      reply({ ok: true, data: { name: SERVICE_NAME } });
    }
  });
}
