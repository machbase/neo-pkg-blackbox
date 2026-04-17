'use strict';

var path = require('path');
var process = require('process');
var fs = require('fs');

var ROOT = path.resolve(path.dirname(process.argv[1]));
var DATA_FILE = path.join(ROOT, 'servers.json');
var _tick = Date.now();

function reply(status, data, reason) {
  var elapse = (Date.now() - _tick) + 'ms';
  var success = status >= 200 && status < 300;
  var body = JSON.stringify({
    success: success,
    reason: reason || (success ? 'success' : 'error'),
    elapse: elapse,
    data: data !== undefined ? data : null
  });
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
  var raw = process.stdin.readLine();
  if (!raw) return null;
  return JSON.parse(raw);
}

var method = (process.env.get('REQUEST_METHOD') || 'GET').toUpperCase();
var query = process.env.get('QUERY_STRING') || '';
var params = {};
query.split('&').forEach(function(pair) {
  var kv = pair.split('=');
  if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
});

if (method === 'GET') {
  var servers = loadServers();
  var alias = params.alias;
  if (alias) {
    var found = null;
    for (var i = 0; i < servers.length; i++) {
      if (servers[i].alias === alias) { found = servers[i]; break; }
    }
    if (!found) {
      reply(404, null, 'server not found: ' + alias);
    } else {
      reply(200, found);
    }
  } else {
    reply(200, servers);
  }

} else if (method === 'POST') {
  var body = parseBody();
  if (!body || !body.alias || !body.ip || !body.port) {
    reply(400, null, 'alias, ip, port are required');
  } else {
    var servers = loadServers();
    var exists = servers.some(function(s) { return s.alias === body.alias; });
    if (exists) {
      reply(409, null, 'alias already exists: ' + body.alias);
    } else {
      var entry = { alias: body.alias, ip: body.ip, port: Number(body.port) };
      servers.push(entry);
      saveServers(servers);
      reply(201, entry);
    }
  }

} else if (method === 'PUT') {
  var alias = params.alias;
  var body = parseBody();
  if (!alias) {
    reply(400, null, 'query parameter alias is required');
  } else if (!body) {
    reply(400, null, 'request body is required');
  } else {
    var servers = loadServers();
    var idx = -1;
    for (var i = 0; i < servers.length; i++) {
      if (servers[i].alias === alias) { idx = i; break; }
    }
    if (idx === -1) {
      reply(404, null, 'server not found: ' + alias);
    } else {
      if (body.alias !== undefined) servers[idx].alias = body.alias;
      if (body.ip !== undefined) servers[idx].ip = body.ip;
      if (body.port !== undefined) servers[idx].port = Number(body.port);
      saveServers(servers);
      reply(200, servers[idx]);
    }
  }

} else if (method === 'DELETE') {
  var alias = params.alias;
  if (!alias) {
    reply(400, null, 'query parameter alias is required');
  } else {
    var servers = loadServers();
    var filtered = servers.filter(function(s) { return s.alias !== alias; });
    if (filtered.length === servers.length) {
      reply(404, null, 'server not found: ' + alias);
    } else {
      saveServers(filtered);
      reply(200, { deleted: alias });
    }
  }

} else {
  reply(405, null, 'method not allowed');
}
