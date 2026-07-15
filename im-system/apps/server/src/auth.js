const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const config = require('./config');
const { consumeOnce } = require('./replayStore');
const crypto = require('crypto');
const { verifyCommunityStatus } = require('./communityStatus');

function requestContext(req) {
  const header = name => String(req.headers?.[name] || '').trim().toLowerCase();
  const normalizeIp = value => String(value || '').trim().toLowerCase().replace(/^::ffff:/, '');
  // Host Nginx, Cloudflare and the inner IM Nginx do not always expose the
  // same header as the first choice. Keep all independently supplied
  // candidates and require at least one to match the signed CodeDog hash.
  const ips = [...new Set([
    header('cf-connecting-ip'),
    header('x-real-ip'),
    req.socket?.remoteAddress
  ].map(normalizeIp).filter(Boolean))];
  // Available on navigation, fetch and WebSocket. Only its salted hash is kept.
  const browser = header('user-agent');
  return { ips, browser };
}

function boundHash(nonce, value) { return crypto.createHash('sha256').update(`${nonce}\n${value}`).digest('base64url'); }
function safeEqual(a, b) {
  const left = Buffer.from(String(a || '')), right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function contextMatches(req, payload) {
  if (!payload.binding_nonce || !payload.client_ip_hash || !payload.browser_hash) return false;
  const context = requestContext(req);
  const ipMatches = context.ips.some(ip => safeEqual(payload.client_ip_hash, boundHash(payload.binding_nonce, ip)));
  return ipMatches && safeEqual(payload.browser_hash, boundHash(payload.binding_nonce, context.browser));
}

function readPublicKey() {
  try { return fs.readFileSync(config.publicKeyFile, 'utf8'); }
  catch { return null; }
}

async function exchangeTicket(ticket, req) {
  const publicKey = readPublicKey();
  if (!publicKey) {
    const error = new Error('IM SSO public key is not configured');
    error.statusCode = 503;
    throw error;
  }
  const payload = jwt.verify(ticket, publicKey, {
    algorithms: ['RS256'], issuer: 'codedog-community', audience: 'codedog-im'
  });
  if (payload.purpose !== 'im_sso' || !payload.jti || !payload.sub) throw new Error('Invalid IM ticket');
  if (!contextMatches(req, payload)) {
    const error = new Error('登录环境与编程狗签发票据时不一致，请从编程狗重新进入');
    error.statusCode = 403;
    throw error;
  }
  if (!await consumeOnce(payload.jti, payload.exp * 1000)) {
    const error = new Error('IM ticket has already been used');
    error.statusCode = 409;
    throw error;
  }
  const user = {
    id: Number(payload.sub), username: payload.username, nickname: payload.nickname,
    avatar: payload.avatar, codemao_user_id: payload.codemao_user_id || null,
    role: payload.role, token_version: payload.token_version || 0,
    community_url: payload.community_url || '', community_status_url: payload.community_status_url || '',
    status_token: payload.status_token || '', binding_nonce: payload.binding_nonce,
    client_ip_hash: payload.client_ip_hash, browser_hash: payload.browser_hash
  };
  const current = await verifyCommunityStatus(user, true);
  user.role = current.role || user.role;
  const session = jwt.sign({ ...user, type: 'im_session' }, config.sessionSecret, {
    algorithm: 'HS256', issuer: 'codedog-im', audience: 'codedog-im-client', expiresIn: '30m'
  });
  return { session, user, peer: payload.peer || null };
}

function parseSession(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.im_session;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.sessionSecret, {
      algorithms: ['HS256'], issuer: 'codedog-im', audience: 'codedog-im-client'
    });
    return payload.type === 'im_session' && contextMatches(req, payload) ? payload : null;
  } catch { return null; }
}

async function requireSession(req, res, next) {
  const user = parseSession(req);
  if (!user) return res.status(401).json({ code: 401, msg: '会话已过期或登录环境已变化，请重新从编程狗进入', data: null });
  try { const current = await verifyCommunityStatus(user); req.user = { ...user, role: current.role || user.role }; next(); }
  catch (error) { return res.status(error.statusCode || 401).json({ code: error.statusCode || 401, msg: error.message, data: null }); }
}

module.exports = { exchangeTicket, parseSession, requireSession };
