'use strict';

const process = require('process');
const service = require('service');

const SERVICE_NAME = 'neo-pkg-blackbox';

function reply(data) {
  const body = JSON.stringify(data);
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

const method = (process.env.get('REQUEST_METHOD') || 'GET').toUpperCase();
if (method !== 'POST') {
  reply({ ok: false, reason: 'method not allowed' });
} else {
  // 1. bbox 프로세스 트리 강제 정리 (mediamtx/ai-manager/ffmpeg 자식까지)
  killBboxTree();

  // 2. 서비스 컨트롤러 측 정리 (launcher 프로세스 + 상태 전이)
  service.stop(SERVICE_NAME, (err) => {
    if (err) {
      // launcher 가 이미 죽었을 수 있음 — 그래도 클라이언트에는 성공 응답
      reply({ ok: true, data: { name: SERVICE_NAME, stop_warn: err.message || String(err) } });
    } else {
      reply({ ok: true, data: { name: SERVICE_NAME } });
    }
  });
}

function killBboxTree() {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const IS_WIN = os.platform() === 'windows';

  const procRoot = '/proc/process';
  if (!fs.existsSync(procRoot)) return;

  let found = null;
  const entries = fs.readdirSync(procRoot);
  for (const name of entries) {
    const metaPath = path.join(procRoot, name, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const exe = meta.exec_path || meta.command || '';
      if (/[\/\\]neo-blackbox(\.exe)?$/.test(exe)) {
        found = { pid: meta.pid, pgid: meta.pgid > 0 ? meta.pgid : meta.pid };
        break;
      }
    } catch (e) { /* skip */ }
  }

  if (!found) return;

  if (IS_WIN) {
    process.exec('@taskkill', '/T', '/PID', String(found.pid));
    process.exec('@taskkill', '/F', '/T', '/PID', String(found.pid));
  } else {
    process.exec('@kill', '-TERM', '-' + found.pgid);
    process.exec('@kill', '-KILL', '-' + found.pgid);
  }
}
