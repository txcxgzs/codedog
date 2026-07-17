const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const root = path.resolve(__dirname, '..');

const supportsColor = process.stdout.isTTY === true && !process.env.NO_COLOR;
const ansi = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m'
};
const color = (name, value) => supportsColor ? `${ansi[name] || ''}${value}${ansi.reset}` : String(value);
const clearScreen = () => {
  if (process.stdout.isTTY === true) process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
};

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
function installGlobalCommand() {
  if (process.platform === 'win32') throw new Error('全局 codedogim 命令仅用于 Linux 生产服务器');
  const entry = path.join(root, 'im.sh');
  fs.chmodSync(entry, 0o755);
  const target = '/usr/local/bin/codedogim';
  try { fs.unlinkSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  fs.symlinkSync(entry, target);
  console.log(color('green', `✓ 全局命令已安装：${target} -> ${entry}`));
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
  '10': backupDatabase,
  '11': installGlobalCommand
};
const menuItems = [
  ['1', '构建并启动'], ['2', '停止'], ['3', '重启'], ['4', '智能更新'],
  ['5', '查看日志'], ['6', '状态'], ['7', '检查与构建'], ['8', '生成 SSO 密钥'],
  ['9', '安装依赖'], ['10', '备份 MySQL'], ['11', '安装/修复全局 codedogim 命令'], ['0', '退出']
];

function renderMenu() {
  clearScreen();
  console.log(color('cyan', color('bold', '======================================')));
  console.log(color('yellow', color('bold', '  CodeDog IM 管理工具箱 v0.1.0')));
  console.log(color('cyan', color('bold', '======================================')));
  console.log(menuItems.map(([number, label]) => `${color('yellow', number.padStart(2))}. ${label}`).join('\n'));
}

function ask(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, answer => resolve(String(answer || '').trim())));
}

async function main() {
  if (process.argv[2]) {
    const action = actions[process.argv[2]];
    if (!action) throw new Error('未知操作');
    if (process.argv[2] === '2' && !process.argv.includes('--yes')) throw new Error('停止服务是危险操作，请交互运行 codedogim，或明确使用 codedogim 2 --yes');
    return action();
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      renderMenu();
      const answer = await ask(rl, color('cyan', '\n请选择操作 [0-11]: '));
      if (answer === '0') break;
      if (answer === '2') {
        console.log(color('red', '\n警告：停止会让 IM 网页、消息服务、容器内 MySQL 和 Redis 一并停止。'));
        const confirmation = await ask(rl, color('yellow', '确认停止请输入 STOP，其他输入均取消: '));
        if (confirmation !== 'STOP') {
          console.log(color('cyan', '\n已取消停止操作。'));
          await ask(rl, color('dim', '按 Enter 返回主菜单...'));
          continue;
        }
      }
      const action = actions[answer];
      if (!action) {
        console.error(color('red', '\n✗ 无效操作，请输入 0-11'));
        await ask(rl, color('dim', '按 Enter 返回主菜单...'));
        continue;
      }
      try {
        await Promise.resolve().then(action);
        console.log(color('green', '\n✓ 操作执行完成'));
      } catch (error) {
        console.error(color('red', `\n✗ ${error.message}`));
      }
      await ask(rl, color('dim', '\n按 Enter 返回主菜单（输入 0 只在主菜单退出）...'));
    }
  } finally {
    rl.close();
    clearScreen();
    console.log(color('green', '已退出 CodeDog IM 管理工具箱。'));
  }
}
main().catch(error => { console.error(color('red', `✗ ${error.message}`)); process.exit(1); });
