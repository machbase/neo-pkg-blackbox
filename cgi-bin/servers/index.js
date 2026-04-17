'use strict';

const path = require('path');
const process = require('process');
const fs = require('fs');

const ROOT = path.resolve(path.dirname(process.argv[1]));
const DATA_FILE = path.join(ROOT, 'servers.json');

function reply(status, data) {
  const body = JSON.stringify(data);
  process.stdout.write('Content-Type: application/json\r\n');
  process.stdout.write('Status: ' + status + '\r\n');
  process.stdout.write('\r\n');
  process.stdout.write(body);
}

function loadServers() {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveServers(servers) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(servers, null, 2), 'utf8');
}

function parseBody() {
  const raw = process.stdin.readLine();
  if (!raw) return null;
  return JSON.parse(raw);
}

const method = (process.env.get('REQUEST_METHOD') || 'GET').toUpperCase();
const query = process.env.get('QUERY_STRING') || '';
const params = {};
query.split('&').forEach(function(pair) {
  const kv = pair.split('=');
  if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
});

if (method === 'GET') {
  // GET: ?alias=xxx 이면 단건 조회, 없으면 전체 목록
  var servers = loadServers();
  var alias = params.alias;
  if (alias) {
    var found = null;
    for (var i = 0; i < servers.length; i++) {
      if (servers[i].alias === alias) { found = servers[i]; break; }
    }
    if (!found) {
      reply(404, { ok: false, reason: 'server not found: ' + alias });
    } else {
      reply(200, { ok: true, data: found });
    }
  } else {
    reply(200, { ok: true, data: servers });
  }

} else if (method === 'POST') {
  // POST: 새 서버 추가 { alias, ip, port }
  var body = parseBody();
  if (!body || !body.alias || !body.ip || !body.port) {
    reply(400, { ok: false, reason: 'alias, ip, port are required' });
  } else {
    var servers = loadServers();
    var exists = servers.some(function(s) { return s.alias === body.alias; });
    if (exists) {
      reply(409, { ok: false, reason: 'alias already exists: ' + body.alias });
    } else {
      servers.push({ alias: body.alias, ip: body.ip, port: Number(body.port) });
      saveServers(servers);
      reply(201, { ok: true, data: { alias: body.alias, ip: body.ip, port: Number(body.port) } });
    }
  }

} else if (method === 'PUT') {
  // PUT: 서버 수정 ?alias=xxx { ip, port } 또는 { alias, ip, port }
  var alias = params.alias;
  var body = parseBody();
  if (!alias) {
    reply(400, { ok: false, reason: 'query parameter alias is required' });
  } else if (!body) {
    reply(400, { ok: false, reason: 'request body is required' });
  } else {
    var servers = loadServers();
    var idx = -1;
    for (var i = 0; i < servers.length; i++) {
      if (servers[i].alias === alias) { idx = i; break; }
    }
    if (idx === -1) {
      reply(404, { ok: false, reason: 'server not found: ' + alias });
    } else {
      if (body.alias !== undefined) servers[idx].alias = body.alias;
      if (body.ip !== undefined) servers[idx].ip = body.ip;
      if (body.port !== undefined) servers[idx].port = Number(body.port);
      saveServers(servers);
      reply(200, { ok: true, data: servers[idx] });
    }
  }

} else if (method === 'DELETE') {
  // DELETE: 서버 삭제 ?alias=xxx
  var alias = params.alias;
  if (!alias) {
    reply(400, { ok: false, reason: 'query parameter alias is required' });
  } else {
    var servers = loadServers();
    var filtered = servers.filter(function(s) { return s.alias !== alias; });
    if (filtered.length === servers.length) {
      reply(404, { ok: false, reason: 'server not found: ' + alias });
    } else {
      saveServers(filtered);
      reply(200, { ok: true, data: { deleted: alias } });
    }
  }

} else {
  reply(405, { ok: false, reason: 'method not allowed' });
}
