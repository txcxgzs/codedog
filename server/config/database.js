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
    const initSequelize = () => {
        try {
            sequelize = new Sequelize(
                process.env.DB_NAME,
                process.env.DB_USER,
                process.env.DB_PASSWORD,
                {
                    host: process.env.DB_HOST,
                    // 修复 M23: DB_PORT 来自环境变量是字符串,需转为 int,失败回退 3306
                    port: parseInt(process.env.DB_PORT, 10) || 3306,
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
    initSequelize();
} else {
    console.log('📦 使用SQLite数据库');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: process.env.DB_PATH || './data/database.sqlite',
        logging: false,
        // 修复 L1: SQLite 不需要 charset/collate(那是 MySQL 概念,SQLite 忽略)
        define: {
            timestamps: true,
            underscored: true
        },
        // 修复 L2: SQLite 也配置 pool 与 retry,提升并发与健壮性
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        retry: {
            max: 3
        }
    });

    // 修复 H2: 开启 SQLite 外键约束,并使用 WAL 模式提升并发读写性能
    // afterConnect 钩子会在每次获取底层连接时触发
    sequelize.addHook('afterConnect', async (connection) => {
        try {
            await connection.query('PRAGMA foreign_keys = ON');
            await connection.query('PRAGMA journal_mode = WAL');
        } catch (e) {
            console.error('SQLite PRAGMA 设置失败:', e.message);
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
        throw error;
    }
}

module.exports = { sequelize, testConnection };
