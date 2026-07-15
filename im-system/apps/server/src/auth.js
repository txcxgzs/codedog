const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const config = require('./config');
const { consumeOnce } = require('./replayStore');

function readPublicKey() {
  try { return fs.readFileSync(config.publicKeyFile, 'utf8'); }
  catch { return null; }
}

async function exchangeTicket(ticket) {
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
  if (!await consumeOnce(payload.jti, payload.exp * 1000)) {
    const error = new Error('IM ticket has already been used');
    error.statusCode = 409;
    throw error;
  }
  const user = {
    id: Number(payload.sub), username: payload.username, nickname: payload.nickname,
    avatar: payload.avatar, role: payload.role, token_version: payload.token_version || 0
  };
  const session = jwt.sign({ ...user, type: 'im_session' }, config.sessionSecret, {
    algorithm: 'HS256', issuer: 'codedog-im', audience: 'codedog-im-client', expiresIn: '12h'
  });
  return { session, user };
}

function parseSession(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.im_session;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.sessionSecret, {
      algorithms: ['HS256'], issuer: 'codedog-im', audience: 'codedog-im-client'
    });
    return payload.type === 'im_session' ? payload : null;
  } catch { return null; }
}

function requireSession(req, res, next) {
  const user = parseSession(req);
  if (!user) return res.status(401).json({ code: 401, msg: '请从编程狗登录后进入即时通讯', data: null });
  req.user = user;
  next();
}

module.exports = { exchangeTicket, parseSession, requireSession };
