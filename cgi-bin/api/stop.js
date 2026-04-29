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
    // taskkill /T 로 neo-blackbox + 자식 트리 (mediamtx/ffmpeg/ai-manager/watcher) 한 번에 정리.
    // 자손이 stdout/stderr 파이프 핸들을 상속받기 때문에 손자까지 안 죽이면
    // JSH controller 의 cmd.Wait() 가 EOF 못 받아 service.stop 이 먹통.
    process.exec('@taskkill', '/F', '/T', '/IM', 'neo-blackbox.exe');
  } else {
    process.exec('@pkill', '-9', '-f', pattern);
  }
}
