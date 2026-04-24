'use strict';

// bbox 바이너리 포트 반환. 프론트엔드가 API_BASE 구성 시 사용.
// 포트는 bbox config.yaml 의 server.addr 에서 파싱 (없으면 8000 fallback).
// 설정 조회/수정은 bbox 네이티브 API /api/config 를 사용.

const process = require('process');
const path = require('path');
const fs = require('fs');

const CGI_BIN = path.dirname(path.dirname(process.argv[1]));           // cgi-bin/
const CONFIG_FILE = path.join(CGI_BIN, 'bbox', 'config', 'config.yaml');

function readBboxPort() {
  try {
    const txt = fs.readFileSync(CONFIG_FILE, 'utf8');
    const m = txt.match(/addr\s*:\s*['"]?.*?:(\d+)/);
    if (m) return m[1];
  } catch (e) { /* fall through */ }
  return '8000';
}

function reply(data) {
  const body = JSON.stringify(data);
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

reply({ ok: true, data: { port: readBboxPort() } });
