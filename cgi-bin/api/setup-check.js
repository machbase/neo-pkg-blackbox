'use strict';

const path = require('path');
const process = require('process');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(path.dirname(process.argv[1]));
const CGI_BIN = path.resolve(ROOT, '..');
const BBOX_DIR = path.join(CGI_BIN, 'bbox');
const IS_WIN = os.platform() === 'windows';
const BIN_NAME = IS_WIN ? 'neo-blackbox.exe' : 'neo-blackbox';
const BIN_PATH = path.join(BBOX_DIR, 'bin', BIN_NAME);

function reply(data) {
  const body = JSON.stringify(data);
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

try {
  const installed = fs.existsSync(BIN_PATH);
  reply({
    ok: true,
    data: {
      installed,
      binary: BIN_PATH,
      bbox_dir: BBOX_DIR,
    },
  });
} catch (err) {
  reply({ ok: false, reason: err.message || String(err) });
}
