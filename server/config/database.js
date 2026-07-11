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
        // Report4 #25 原: SQLite 写入本就串行化,大连接池不会提升吞吐。
        // 但 pool.max=2 会把并发读也压到最多 2 连接,事务内若有遗漏 transaction: t 的
        // 查询,小连接池更易触发"事务占着连接又等新连接"的死锁/30s 超时。
        // 修复: 恢复 pool.max=5,写靠 SQLite 自身串行化即可,读并发不应被过度限制。
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        retry: {
            max: 3,
            // 修复: 添加 match 模式,只重试连接类错误,避免对所有错误(如约束冲突)重试
            match: [
                /SQLITE_BUSY/,
                /SQLITE_LOCKED/,
                /SequelizeConnectionTimedOutError/,
                /SequelizeConnectionError/
            ]
        },
        // 修复 H2(连接级, Report 2 #23): SQLite 的 foreign_keys 是「连接级」设置,
        // 不是数据库级持久化设置。本配置启用了连接池(pool.max=2),仅在启动主连接执行
        // 一次 PRAGMA 不够 —— 池中新创建的连接不会继承 foreign_keys=ON,外键约束会被静默关闭。
        // 通过 afterConnect 钩子在「每个新连接」上执行 PRAGMA foreign_keys=ON。
        // 注意:sqlite3 底层连接对象没有 query 方法(只有 run/exec/all),需用 run 执行 PRAGMA;
        //      sqlite3 会按连接串行化执行,PRAGMA 会在该连接上的后续查询之前执行。
        //      PRAGMA foreign_keys 本身开销极低(无 I/O),争用主要来自连接频繁创建,
        //      已通过把 pool.max 降到 2 缓解(Report4 #25)。
        // 仅注册在 sqlite 实例上(mysql 分支不受影响);返回的 Promise 不 reject,
        // 即使 PRAGMA 失败也不阻塞连接获取(降级为外键关闭,与未修复前等价,避免启动卡死)。
        hooks: {
            afterConnect(connection) {
                return new Promise((resolve) => {
                    const done = (err) => {
                        if (err) {
                            console.error('⚠️ 连接级 PRAGMA foreign_keys=ON 设置失败:', err.message);
                        }
                        resolve(); // 不 reject:即使失败也返回连接,避免连接获取整体失败
                    };
                    if (typeof connection.run === 'function') {
                        connection.run('PRAGMA foreign_keys = ON', done);
                    } else if (typeof connection.exec === 'function') {
                        connection.exec('PRAGMA foreign_keys = ON', done);
                    } else {
                        console.warn('⚠️ 无法识别的 SQLite 连接对象,跳过 PRAGMA foreign_keys=ON');
                        resolve();
                    }
                });
            }
        }
    });

    // 修复 H2: 开启 SQLite WAL 模式提升并发读写性能(WAL 是数据库级持久化设置,执行一次即可)。
    // foreign_keys=ON 已由上方 afterConnect 钩子在「每个连接」上开启;
    // 这里仅在启动主连接上额外执行一次 WAL 切换 + foreign_keys 验证日志,便于运维确认生效。
    // (旧实现错误声称「连接池默认单连接,启动设置一次足够」—— 实际 pool.max=2,
    //  新连接不继承 foreign_keys,故改为 afterConnect 钩子保证每个连接都开启。)
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
