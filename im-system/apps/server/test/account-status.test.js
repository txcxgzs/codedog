const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { acceptStatusPush, assertAccountActive } = require('../src/accountStatus');

test('signed CodeDog status push disables and re-enables an IM account', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codedog-im-status-'));
  const publicFile = path.join(dir, 'public.pem');
  fs.writeFileSync(publicFile, publicKey.export({ type: 'spki', format: 'pem' }));
  const previous = config.publicKeyFile;
  config.publicKeyFile = publicFile;
  const user = { id: 42, role: 'user', token_version: 3 };
  const sign = status => jwt.sign({ purpose: 'im_status_push', status, role: 'user', token_version: 3 }, privateKey, {
    algorithm: 'RS256', issuer: 'codedog-community', audience: 'codedog-im-status-push', subject: '42', jwtid: crypto.randomUUID(), expiresIn: '5m'
  });
  try {
    await acceptStatusPush(sign('disabled'));
    await assert.rejects(() => assertAccountActive(user), /账号已停用/);
    await acceptStatusPush(sign('active'));
    assert.equal((await assertAccountActive(user)).role, 'user');
  } finally {
    config.publicKeyFile = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
