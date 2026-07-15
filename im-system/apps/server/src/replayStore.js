const { createClient } = require('redis');
const config = require('./config');

const local = new Map();
let client = null;

async function connectReplayStore() {
  if (!config.redisUrl || client) return;
  client = createClient({ url: config.redisUrl });
  client.on('error', error => console.error('IM Redis error:', error.message));
  await client.connect();
}

async function consumeOnce(jti, expiresAtMs) {
  const ttl = Math.max(1000, expiresAtMs - Date.now());
  if (client?.isReady) return (await client.set(`im:sso:jti:${jti}`, '1', { NX: true, PX: ttl })) === 'OK';
  const now = Date.now();
  for (const [key, expiresAt] of local) if (expiresAt <= now) local.delete(key);
  if (local.has(jti)) return false;
  local.set(jti, expiresAtMs);
  return true;
}

module.exports = { connectReplayStore, consumeOnce };
