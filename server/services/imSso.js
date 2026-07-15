const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function privateKeyPath() {
  const configured = process.env.IM_SSO_PRIVATE_KEY_FILE;
  if (configured) return path.resolve(configured);
  return path.resolve(__dirname, '../../im-system/secrets/im_sso_private.pem');
}

function signingKey() {
  const file = privateKeyPath();
  const encodedKey = String(process.env.IM_SSO_PRIVATE_KEY_BASE64 || '').trim();
  if (!encodedKey && !fs.existsSync(file)) {
    const error = new Error('IM SSO 尚未初始化，请运行 im-system 工具箱生成 SSO 密钥');
    error.statusCode = 503;
    throw error;
  }
  return encodedKey ? Buffer.from(encodedKey, 'base64').toString('utf8') : fs.readFileSync(file, 'utf8');
}

function clientContext(req) {
  const header = name => String(req.get(name) || '').trim().toLowerCase();
  const ip = (header('cf-connecting-ip') || header('x-real-ip') || String(req.ip || req.socket?.remoteAddress || '').trim()).replace(/^::ffff:/, '');
  // User-Agent is also sent by WebSocket handshakes. Avoid optional Client Hint
  // headers because browsers may send them on navigation but omit them on WS.
  const browser = header('user-agent');
  return { ip, browser };
}

function boundHash(nonce, value) {
  return crypto.createHash('sha256').update(`${nonce}\n${value}`).digest('base64url');
}

function communityPublicUrl(req) {
  const forwardedHost = String(req?.get?.('x-forwarded-host') || '').split(',')[0].trim();
  const requestHost = forwardedHost || String(req?.get?.('host') || '').trim();
  // Only accept a plain DNS name/IP with an optional port. This value is
  // rendered into links in IM, so never trust arbitrary forwarded text.
  const safeHost = /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(requestHost) ? requestHost : '';
  const forwardedProto = String(req?.get?.('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
  const protocol = ['http', 'https'].includes(forwardedProto) ? forwardedProto : (req?.secure ? 'https' : 'http');
  if (safeHost && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(safeHost)) return `${protocol}://${safeHost}`;
  return String(process.env.PUBLIC_URL || process.env.CORS_ORIGIN || '').split(',')[0].replace(/\/$/, '');
}

function createStatusToken(user, key) {
  return jwt.sign({ purpose: 'im_status', token_version: user.token_version || 0 }, key, {
    algorithm: 'RS256', issuer: 'codedog-community', audience: 'codedog-im-status',
    subject: String(user.id), jwtid: crypto.randomUUID(), expiresIn: '35m'
  });
}

function createImTicket(user, context = {}) {
  const key = signingKey();
  const nonce = crypto.randomBytes(18).toString('base64url');
  const requestContext = clientContext(context.req);
  // Use the public origin the browser actually used, not the container's
  // localhost address. IM uses this for profile and return-to-community links.
  const communityUrl = communityPublicUrl(context.req);
  return jwt.sign({
    purpose: 'im_sso',
    username: user.username,
    nickname: user.nickname || user.username,
    avatar: user.avatar || '',
    codemao_user_id: user.codemao_user_id || '',
    role: user.role,
    status: user.status || 'active',
    token_version: user.token_version || 0,
    community_url: communityUrl,
    community_status_url: `${communityUrl}/api/users/im-status`,
    status_token: createStatusToken(user, key),
    binding_nonce: nonce,
    client_ip_hash: boundHash(nonce, requestContext.ip),
    browser_hash: boundHash(nonce, requestContext.browser),
    peer: context.peer ? {
      id: Number(context.peer.id), username: context.peer.username,
      nickname: context.peer.nickname || context.peer.username,
      avatar: context.peer.avatar || '', codemao_user_id: context.peer.codemao_user_id || '',
      role: context.peer.role || 'user'
    } : undefined
  }, key, {
    algorithm: 'RS256', issuer: 'codedog-community', audience: 'codedog-im',
    subject: String(user.id), jwtid: crypto.randomUUID(), expiresIn: '60s'
  });
}

function verifyImStatusToken(token) {
  const payload = jwt.verify(token, crypto.createPublicKey(signingKey()), { algorithms: ['RS256'], issuer: 'codedog-community', audience: 'codedog-im-status' });
  if (payload.purpose !== 'im_status' || !payload.sub) throw new Error('Invalid IM status token');
  return payload;
}

function createImStatusEvent(user) {
  const userId = user.id || user.user_id;
  return jwt.sign({
    purpose: 'im_status_push',
    status: user.status,
    role: user.role,
    token_version: user.token_version || 0
  }, signingKey(), {
    algorithm: 'RS256', issuer: 'codedog-community', audience: 'codedog-im-status-push',
    subject: String(userId), jwtid: crypto.randomUUID(), expiresIn: '5m'
  });
}

function getImPublicUrl() {
  const value = String(process.env.IM_PUBLIC_URL || '').trim().replace(/\/$/, '');
  return value || null;
}

module.exports = { createImTicket, createImStatusEvent, getImPublicUrl, verifyImStatusToken };
