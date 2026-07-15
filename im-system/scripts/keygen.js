const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'secrets');
fs.mkdirSync(dir, { recursive: true });
const privateFile = path.join(dir, 'im_sso_private.pem');
const publicFile = path.join(dir, 'im_sso_public.pem');
if ((fs.existsSync(privateFile) || fs.existsSync(publicFile)) && !process.argv.includes('--force')) {
  console.error('SSO 密钥已存在；如确需轮换，请先备份并使用 --force。轮换会让未兑换 Ticket 失效。');
  process.exit(1);
}
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
fs.writeFileSync(privateFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
fs.writeFileSync(publicFile, publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644 });
console.log(`已生成：\n${privateFile}\n${publicFile}`);
