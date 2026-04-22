'use strict';

// bbox 바이너리 포트 반환. 프론트엔드가 API_BASE 구성 시 사용.
// bbox config 의 server.addr 은 read-only 로 포트 고정(8000).
// 설정 조회/수정은 bbox 네이티브 API /api/config 를 사용.

const process = require('process');

function reply(data) {
  const body = JSON.stringify(data);
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

reply({ ok: true, data: { port: '8000' } });
