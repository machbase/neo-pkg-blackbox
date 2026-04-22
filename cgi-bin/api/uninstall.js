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
  // 1. 먼저 서비스 중지 (레지스트리 상태 running 이면 uninstall 이 거부됨)
  service.stop(SERVICE_NAME, (stopErr) => {
    // 이미 중지돼있거나 미등록이어도 다음 단계 진행 — stopErr 는 경고로만 취급

    // 2. 서비스 등록 해제
    service.uninstall(SERVICE_NAME, (err) => {
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
