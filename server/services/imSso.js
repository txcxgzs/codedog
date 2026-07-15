const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function privateKeyPath() {
  const configured = process.env.IM_SSO_PRIVATE_KEY_FILE;
  if (configured) return path.resolve(configured);
  return path.resolve(__dirname, '../../im-system/secrets/im_sso_private.pem');
}

function createImTicket(user) {
  const file = privateKeyPath();
  const encodedKey = String(process.env.IM_SSO_PRIVATE_KEY_BASE64 || '').trim();
  if (!encodedKey && !fs.existsSync(file)) {
    const error = new Error('IM SSO 尚未初始化，请运行 im-system 工具箱的“生成 SSO 密钥”');
    error.statusCode = 503;
    throw error;
  }
  const key = encodedKey ? Buffer.from(encodedKey, 'base64').toString('utf8') : fs.readFileSync(file, 'utf8');
  return jwt.sign({
    purpose: 'im_sso',
    username: user.username,
    nickname: user.nickname || user.username,
    avatar: user.avatar || '',
    role: user.role,
    token_version: user.token_version || 0
  }, key, {
    algorithm: 'RS256', issuer: 'codedog-community', audience: 'codedog-im',
    subject: String(user.id), jwtid: crypto.randomUUID(), expiresIn: '60s'
  });
}

function getImPublicUrl() {
  const value = String(process.env.IM_PUBLIC_URL || '').trim().replace(/\/$/, '');
  return value || null;
}

module.exports = { createImTicket, getImPublicUrl };
