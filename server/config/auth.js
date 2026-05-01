/**
 * 认证配置
 * JWT密钥从环境变量读取，生产环境必须设置
 */

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 检查JWT密钥是否设置
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('❌ 错误: JWT_SECRET 未设置或长度不足32位');
    console.error('请在 .env 文件中设置 JWT_SECRET 环境变量');
    console.error('部署脚本会自动生成，请确保使用 deploy.sh 部署');
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}

module.exports = {
    JWT_SECRET: JWT_SECRET || 'development-secret-key-do-not-use-in-production',
    JWT_EXPIRES_IN
};
