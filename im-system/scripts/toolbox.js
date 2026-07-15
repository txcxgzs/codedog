const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const root = path.resolve(__dirname, '..');

function run(command, args = []) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error(`${command} 执行失败 (${result.status})`);
}
function compose(args) { run('docker', ['compose', ...args]); }
function hasDocker() { return spawnSync('docker', ['--version'], { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' }).status === 0; }
function status() {
  console.log('\nCodeDog IM 状态');
  console.log(`目录: ${root}`);
  console.log(`环境文件: ${fs.existsSync(path.join(root, '.env')) ? '已配置' : '缺少 .env'}`);
  console.log(`SSO 公钥: ${fs.existsSync(path.join(root, 'secrets/im_sso_public.pem')) ? '已配置' : '未生成'}`);
  if (!hasDocker()) console.log('Docker: 未安装（本地内存模式仍可运行）');
  else try { compose(['ps']); } catch { console.log('Docker Compose 服务未启动'); }
}
function backupDatabase() {
  const dir = path.join(root, 'backups'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `codedog-im-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'mysql', 'sh', '-c', 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers codedog_im'], { cwd: root, encoding: null, shell: false });
  if (result.status !== 0) throw new Error(`数据库备份失败：${String(result.stderr || '')}`);
  fs.writeFileSync(file, result.stdout); console.log(`数据库备份已保存：${file}`); return file;
}
const actions = {
  '1': () => compose(['up', '-d', '--build']),
  '2': () => compose(['stop']),
  '3': () => compose(['restart']),
  '4': () => run(process.execPath, ['scripts/update.js']),
  '5': () => compose(['logs', '--tail=200', '-f']),
  '6': status,
  '7': () => run('npm', ['run', 'check']),
  '8': () => run(process.execPath, ['scripts/keygen.js']),
  '9': () => run('npm', ['install']),
  '10': backupDatabase
};
async function main() {
  if (process.argv[2]) { const action = actions[process.argv[2]]; if (!action) throw new Error('未知操作'); return action(); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n======================================\n  CodeDog IM 管理工具箱 v0.1.0\n======================================');
  console.log('1. 构建并启动\n2. 停止\n3. 重启\n4. 智能更新\n5. 查看日志\n6. 状态\n7. 检查与构建\n8. 生成 SSO 密钥\n9. 安装依赖\n10. 备份 MySQL\n0. 退出');
  rl.question('\n请选择操作 [0-10]: ', answer => { rl.close(); if (answer === '0') return; Promise.resolve(actions[answer]?.()).catch(error => { console.error(error.message); process.exitCode = 1; }); });
}
main().catch(error => { console.error(error.message); process.exit(1); });
