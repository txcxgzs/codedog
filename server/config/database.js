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
    // 修复前: 使用 afterConnect 钩子调用 connection.query('PRAGMA ...'),
    // 但 sqlite3 底层连接对象没有 query 方法(它只有 run/exec/all 等),PRAGMA 实际未生效。
    // 改为在 testConnection() 中通过 sequelize.query 执行,并在启动时打日志确认生效。
    // 注意: journal_mode = WAL 是数据库级持久化设置,执行一次即可;
    // foreign_keys = ON 是连接级设置,SQLite 连接池默认单连接,启动时设置一次足够覆盖主流程。
}

/**
 * 应用 SQLite PRAGMA 设置（外键约束 + WAL 日志模式）
 * 在 testConnection 认证成功后调用，通过 sequelize.query 执行并验证生效情况。
 */
async function applySqlitePragmas() {
    try {
        // 开启外键约束
        await sequelize.query('PRAGMA foreign_keys = ON');
        // 切换为 WAL 日志模式（提升并发读写性能，数据库级持久化设置）
        await sequelize.query('PRAGMA journal_mode = WAL');

        // 验证 PRAGMA 是否真正生效（读取当前值并打印日志确认）
        const [fkRows] = await sequelize.query('PRAGMA foreign_keys');
        const [jmRows] = await sequelize.query('PRAGMA journal_mode');
        const fkValue = fkRows && fkRows[0] ? fkRows[0].foreign_keys : 'unknown';
        const jmValue = jmRows && jmRows[0] ? jmRows[0].journal_mode : 'unknown';
        console.log(`✅ SQLite PRAGMA 已设置: foreign_keys = ${fkValue}, journal_mode = ${jmValue}`);
    } catch (e) {
        console.error('❌ SQLite PRAGMA 设置失败:', e.message);
    }
}

/**
 * 测试数据库连接
 */
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功');
        // SQLite 连接成功后立即应用 PRAGMA 设置（authenticate 之后、sync 之前）
        if (dbType !== 'mysql') {
            await applySqlitePragmas();
        }
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        throw error;
    }
}

module.exports = { sequelize, testConnection };
