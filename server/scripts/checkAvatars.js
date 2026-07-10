/**
 * 查询 SQLite/MySQL 中所有用户的 avatar 字段实际存储值
 * 用于诊断"登录后头像崩掉"问题：检查 avatar URL 格式是否正确
 *
 * 诊断项目:
 *   1. avatar 是否为空
 *   2. avatar 是否被反引号(`)包裹
 *   3. avatar 是否为相对路径(以 / 开头但非 /uploads/)
 *   4. avatar 是否为协议相对路径(以 // 开头)
 *   5. avatar 是否为非 http(s) 协议
 *
 * 用法(Docker 部署,容器WORKDIR=/app/server):
 *   docker compose exec codedog node scripts/checkAvatars.js
 *
 * 用法(本地/宝塔):
 *   cd server && node scripts/checkAvatars.js
 */
const path = require('path');
const { sequelize, User } = require(path.join(__dirname, '..', 'models'));

async function main() {
    console.log('=== 查询用户 avatar 字段实际存储值 ===\n');

    // 查询所有用户的头像相关字段
    const users = await User.findAll({
        attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'role', 'avatar', 'created_at'],
        order: [['id', 'ASC']]
    });

    console.log(`共 ${users.length} 个用户\n`);

    if (users.length === 0) {
        console.log('数据库中无用户记录');
        return;
    }

    // 逐个用户输出 avatar 字段诊断
    let problemCount = 0;
    for (const u of users) {
        const avatar = u.avatar;
        const problems = [];

        if (!avatar) {
            problems.push('avatar 为空(NULL)');
        } else {
            // 检查反引号包裹
            if (avatar.startsWith('`') || avatar.endsWith('`')) {
                problems.push('被反引号(`)包裹');
            }
            // 检查协议相对路径
            if (avatar.startsWith('//')) {
                problems.push('协议相对路径(以 // 开头)，需补全 https:');
            }
            // 检查相对路径(以 / 开头但非 /uploads/)
            else if (avatar.startsWith('/') && !avatar.startsWith('/uploads/')) {
                problems.push('相对路径(以 / 开头)，需拼接 CDN 域名');
            }
            // 检查非 http(s) 协议
            else if (!/^https?:\/\//i.test(avatar) && !avatar.startsWith('/uploads/')) {
                problems.push(`非 http(s) 协议且非本地路径: ${avatar.substring(0, 50)}`);
            }
            // 检查是否包含换行或空格
            if (avatar !== avatar.trim()) {
                problems.push('首尾含空格/换行');
            }
            if (avatar.includes('\n') || avatar.includes('\r')) {
                problems.push('包含换行符');
            }
        }

        const status = problems.length > 0 ? '⚠ 有问题' : '✓ 正常';
        console.log(`[用户 #${u.id}] ${u.username} (编程猫ID: ${u.codemao_user_id}, 角色: ${u.role})`);
        console.log(`  昵称: ${u.nickname || '(空)'}`);
        console.log(`  avatar: ${avatar ? JSON.stringify(avatar) : '(空)'}`);
        console.log(`  状态: ${status}`);
        if (problems.length > 0) {
            for (const p of problems) {
                console.log(`  - ${p}`);
            }
            problemCount++;
        }
        console.log('');
    }

    console.log('=== 诊断汇总 ===');
    console.log(`总用户数: ${users.length}`);
    console.log(`有问题: ${problemCount}`);
    console.log(`正常: ${users.length - problemCount}`);

    if (problemCount > 0) {
        console.log('\n建议: 执行图片 URL 修复脚本修复反引号/相对路径问题');
        console.log('  docker compose exec codedog node server/scripts/repairImageUrls.js');
    }

    // 额外输出: 管理员提升相关信息
    console.log('\n=== 管理员提升相关 ===');
    const superadmins = users.filter(u => u.role === 'superadmin');
    const admins = users.filter(u => u.role === 'admin');
    console.log(`超级管理员(superadmin)数量: ${superadmins.length}`);
    console.log(`管理员(admin)数量: ${admins.length}`);
    if (superadmins.length === 0 && admins.length === 0) {
        console.log('⚠ 当前没有任何管理员!');
        console.log('  生产环境下第一个登录用户不会自动成为管理员(安全设计)。');
        console.log('  提升管理员方法:');
        console.log('    1) 在 .env 中设置 INITIAL_ADMIN_CODEMAO_ID=<你的编程猫ID>');
        console.log('       然后重启服务并重新登录');
        console.log('    2) 或在 .env 中设置 INITIAL_ADMIN_BOOTSTRAP_TOKEN=<随机字符串>');
        console.log('       然后登录时在请求头带 x-bootstrap-token: <该随机字符串>');
        console.log('  你的编程猫ID见上方 "编程猫ID" 字段');
    }
}

main().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('查询失败:', err);
    process.exit(1);
});
