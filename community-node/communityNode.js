/**
 * Genesis Community Node V1
 * Read/cache/monitor gateway only. This module intentionally has no access to
 * mining, reward, balance, wallet, ledger, database, KYC, or admin mutations.
 */
const crypto = require('node:crypto');
const http = require('node:http');

const TOKEN_TTL_MS = 15 * 60 * 1000;
const ALLOWED_WORK_TYPES = new Set([
  'public-ranking-cache',
  'public-missions-cache',
  'i18n-cache',
  'static-asset-cache',
  'status-monitor',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function scryptHash(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(secret, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function matchesScrypt(secret, stored) {
  const [salt, savedHash] = String(stored).split(':');
  if (!salt || !savedHash) return false;
  const candidate = crypto.scryptSync(secret, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(savedHash, 'hex'));
}

function sign(payload, key) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verify(token, key) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function createCommunityNodeGateway(options = {}) {
  const signingKey = options.signingKey || crypto.randomBytes(32).toString('hex');
  const adminKey = options.adminKey || crypto.randomBytes(24).toString('hex');
  const nodes = new Map();
  const workQueue = Array.from(ALLOWED_WORK_TYPES).map((type, index) => ({
    id: `public-${index + 1}`,
    type,
    // These are logical public cache keys, never external URLs and never user data.
    resource: type === 'static-asset-cache' ? '/public/app-shell.json' : `/public/${type}.json`,
    body: JSON.stringify({ type, public: true, revision: 1 }),
  }));

  function registerNode(label = 'community-node') {
    const nodeId = `gcn_${crypto.randomBytes(8).toString('hex')}`;
    const nodeSecret = crypto.randomBytes(32).toString('base64url');
    nodes.set(nodeId, {
      nodeId, label: String(label).slice(0, 80), secretHash: scryptHash(nodeSecret),
      createdAt: new Date().toISOString(), revoked: false, lastHeartbeat: null,
      telemetry: null, completedWork: 0,
    });
    return { nodeId, nodeSecret };
  }

  function issueToken(nodeId, nodeSecret) {
    const node = nodes.get(nodeId);
    if (!node || node.revoked || !matchesScrypt(nodeSecret, node.secretHash)) return null;
    const exp = Date.now() + TOKEN_TTL_MS;
    return sign({ sub: nodeId, exp, scope: ['read', 'cache', 'monitor'] }, signingKey);
  }

  function authenticate(token) {
    const claims = verify(token, signingKey);
    if (!claims || !Array.isArray(claims.scope) || !claims.scope.every((scope) => ['read', 'cache', 'monitor'].includes(scope))) return null;
    const node = nodes.get(claims.sub);
    return node && !node.revoked ? { node, claims } : null;
  }

  function selectWork(nodeId) {
    const node = nodes.get(nodeId);
    if (!node || node.revoked) return null;
    const task = workQueue[node.completedWork % workQueue.length];
    return { ...task, expectedSha256: sha256(task.body) };
  }

  function recordHeartbeat(nodeId, telemetry) {
    const node = nodes.get(nodeId);
    if (!node || node.revoked) return false;
    const safe = {
      cpuPercent: Number(telemetry.cpuPercent) || 0,
      memoryPercent: Number(telemetry.memoryPercent) || 0,
      diskPercent: Number(telemetry.diskPercent) || 0,
      uptimeSeconds: Number(telemetry.uptimeSeconds) || 0,
      apiLatencyMs: Number(telemetry.apiLatencyMs) || 0,
      serviceStatus: String(telemetry.serviceStatus || 'unknown').slice(0, 24),
    };
    node.telemetry = safe;
    node.lastHeartbeat = new Date().toISOString();
    return true;
  }

  function submitResult(nodeId, result) {
    const node = nodes.get(nodeId);
    if (!node || node.revoked || !ALLOWED_WORK_TYPES.has(result.type)) return { ok: false, reason: 'invalid-work-type' };
    const matching = workQueue.find((task) => task.id === result.taskId && task.type === result.type);
    if (!matching || result.sha256 !== sha256(matching.body)) return { ok: false, reason: 'sha256-verification-failed' };
    node.completedWork += 1;
    return { ok: true, workType: matching.type };
  }

  function listNodes() {
    return [...nodes.values()].map(({ secretHash, ...safe }) => safe);
  }

  function revokeNode(nodeId) {
    const node = nodes.get(nodeId);
    if (!node) return false;
    node.revoked = true;
    return true;
  }

  return { registerNode, issueToken, authenticate, selectWork, recordHeartbeat, submitResult, listNodes, revokeNode, adminKey };
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function startServer({ port = Number(process.env.PORT || 10100), signingKey = process.env.COMMUNITY_NODE_SIGNING_KEY, adminKey = process.env.COMMUNITY_NODE_ADMIN_KEY } = {}) {
  const gateway = createCommunityNodeGateway({ signingKey, adminKey });
  const server = http.createServer(async (req, res) => {
    let body = {};
    try {
      const raw = await new Promise((resolve) => { let data = ''; req.on('data', (chunk) => data += chunk); req.on('end', () => resolve(data)); });
      body = raw ? JSON.parse(raw) : {};
    } catch { return json(res, 400, { error: 'invalid-json' }); }
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const session = gateway.authenticate(token);
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, service: 'Genesis Community Node V1' });
    if (req.method === 'POST' && req.url === '/v1/nodes/register') return json(res, 201, gateway.registerNode(body.label));
    if (req.method === 'POST' && req.url === '/v1/nodes/token') {
      const accessToken = gateway.issueToken(body.nodeId, body.nodeSecret);
      return accessToken ? json(res, 200, { accessToken, expiresInSeconds: 900 }) : json(res, 401, { error: 'node-authentication-failed' });
    }
    if (req.headers['x-community-node-admin-key'] === gateway.adminKey) {
      if (req.method === 'GET' && req.url === '/v1/admin/nodes') return json(res, 200, { nodes: gateway.listNodes() });
      if (req.method === 'POST' && req.url === '/v1/admin/nodes/revoke') {
        const revoked = gateway.revokeNode(body.nodeId);
        return json(res, revoked ? 200 : 404, { revoked });
      }
    }
    if (!session) return json(res, 401, { error: 'read-cache-monitor-token-required' });
    if (req.method === 'GET' && req.url === '/v1/nodes/work') return json(res, 200, { task: gateway.selectWork(session.node.nodeId) });
    if (req.method === 'POST' && req.url === '/v1/nodes/heartbeat') return json(res, gateway.recordHeartbeat(session.node.nodeId, body) ? 200 : 400, { ok: true });
    if (req.method === 'POST' && req.url === '/v1/nodes/results') return json(res, 200, gateway.submitResult(session.node.nodeId, body));
    return json(res, 404, { error: 'not-found' });
  });
  return { gateway, server: server.listen(port, () => console.log(`Genesis Community Node gateway listening on ${port}`)) };
}

if (require.main === module) startServer();
module.exports = { createCommunityNodeGateway, startServer, sha256, TOKEN_TTL_MS, ALLOWED_WORK_TYPES };
