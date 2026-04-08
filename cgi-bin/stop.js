'use strict';

const process = require('process');
const service = require('service');

const SERVICE_NAME = 'neo-blackbox';
const BINARY_NAME = 'neo-blackbox';

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
  process.exec('@pkill', '-f', BINARY_NAME);
  reply({ ok: true, data: { name: SERVICE_NAME } });
}
