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
  // 1. bbox + 자식 프로세스 트리 강제 정리 (경로 패턴)
  killBboxTree('initial');

  // 2. 서비스 컨트롤러 측 정리 (launcher cmd.Wait 풀려서 즉시 callback)
  service.stop(SERVICE_NAME, (err) => {
    if (err) {
      reply({ ok: true, data: { name: SERVICE_NAME, stop_warn: err.message || String(err) } });
    } else {
      reply({ ok: true, data: { name: SERVICE_NAME } });
    }
  });
}

function killBboxTree(label) {
  const os = require('os');
  const IS_WIN = os.platform() === 'windows';
  const pattern = '/cgi-bin/bbox/';

  if (IS_WIN) {
    const ps1 = "Get-Process | Where-Object { $_.Path -like '*\\cgi-bin\\bbox\\*' } | Stop-Process -Force -ErrorAction SilentlyContinue";
    process.exec('@powershell.exe', '-NoProfile', '-Command', ps1);
  } else {
    process.exec('@pkill', '-9', '-f', pattern);
  }
}
