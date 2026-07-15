const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const communityDir = path.resolve(valueOf('--community-dir', '/root/codedog'));
let publicUrl = valueOf('--public-url', '');
if (!publicUrl) throw new Error('请使用 --public-url 指定 IM 公开地址');
publicUrl = publicUrl.replace(/\/$/, '');
if (!publicUrl.endsWith('/im')) publicUrl += '/im';
if (!/^https?:\/\//i.test(publicUrl)) throw new Error('IM 公开地址必须以 http:// 或 https:// 开头');

const envFile = path.join(communityDir, '.env');
const privateKeyFile = path.join(root, 'secrets', 'im_sso_private.pem');
if (!fs.existsSync(envFile)) throw new Error(`找不到编程狗配置：${envFile}`);
if (!fs.existsSync(privateKeyFile)) throw new Error(`找不到 IM SSO 私钥：${privateKeyFile}`);

const backup = `${envFile}.before-im-bind-${new Date().toISOString().replace(/[:.]/g, '-')}`;
fs.copyFileSync(envFile, backup);
let content = fs.readFileSync(envFile, 'utf8');
const setEnv = (key, value) => {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  content = pattern.test(content) ? content.replace(pattern, line) : `${content.replace(/\s*$/, '')}\n${line}\n`;
};
setEnv('IM_PUBLIC_URL', publicUrl);
setEnv('IM_SSO_PRIVATE_KEY_BASE64', fs.readFileSync(privateKeyFile).toString('base64'));
fs.writeFileSync(envFile, content, { mode: 0o600 });

console.log(`已备份编程狗配置：${backup}`);
console.log(`已绑定 IM 地址：${publicUrl}`);
const result = spawnSync('docker', ['compose', 'up', '-d', '--build', 'codedog'], { cwd: communityDir, stdio: 'inherit' });
if (result.status !== 0) throw new Error(`编程狗服务重建失败（退出码 ${result.status}），配置备份未删除`);
console.log('编程狗与 IM 绑定完成。');
