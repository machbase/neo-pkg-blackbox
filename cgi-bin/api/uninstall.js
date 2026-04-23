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
  // 1. bbox 프로세스 트리 강제 정리 (1차)
  killBboxTree('initial');

  // 2. 서비스 컨트롤러 측 정리
  service.stop(SERVICE_NAME, (stopErr) => {
    // 3. 서비스 등록 해제 — 자동 재기동 영구 차단
    service.uninstall(SERVICE_NAME, (err) => {
      // 4. cleanup — controller 가 사이에 재기동했으면 정리
      killBboxTree('cleanup');

      if (err) {
        reply({
          ok: false,
          reason: err.message || String(err),
          stop_warn: stopErr ? (stopErr.message || String(stopErr)) : undefined,
        });
      } else {
        reply({ ok: true, data: { name: SERVICE_NAME } });
      }
    });
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
