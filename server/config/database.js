/**
 * 数据库配置文件
 * 支持 SQLite 和 MySQL 两种数据库
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbType = process.env.DB_TYPE || 'sqlite';
let sequelize = null;

if (dbType === 'mysql') {
    console.log('🗄️ 使用MySQL数据库');
    const connectWithRetry = () => {
        try {
            sequelize = new Sequelize(
                process.env.DB_NAME,
                process.env.DB_USER,
                process.env.DB_PASSWORD,
                {
                    host: process.env.DB_HOST,
                    port: process.env.DB_PORT,
                    dialect: 'mysql',
                    logging: false,
                    timezone: '+08:00',
                    define: {
                        timestamps: true,
                        underscored: true,
                        charset: 'utf8mb4',
                        collate: 'utf8mb4_unicode_ci'
                    },
                    pool: {
                        max: 10,
                        min: 0,
                        acquire: 30000,
                        idle: 10000
                    },
                    retry: {
                        match: [
                            /SequelizeConnectionError/,
                            /SequelizeConnectionRefusedError/,
                            /SequelizeHostNotFoundError/,
                            /SequelizeHostNotReachableError/,
                            /SequelizeInvalidConnectionError/,
                            /SequelizeConnectionTimedOutError/
                        ],
                        max: 5
                    }
                }
            );
        } catch (err) {
            console.error('MySQL 配置错误:', err);
            process.exit(1);
        }
    };
    connectWithRetry();
} else {
    console.log('📦 使用SQLite数据库');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: process.env.DB_PATH || './data/database.sqlite',
        logging: false,
        define: {
            timestamps: true,
            underscored: true,
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        }
    });
}

/**
 * 测试数据库连接
 */
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功');
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
    }
}

module.exports = { sequelize, testConnection };
