/**
 * 数据库迁移路由
 * 只有手动触发才会执行，系统不会自动迁移
 * 支持 SQLite 和 MySQL 之间的数据迁移
 */

const express = require('express');
const router = express.Router();
const dbMigration = require('../services/dbMigration');
const { successResponse, errorResponse } = require('../middleware/response');
const { logOperation } = require('../middleware/operationLog');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/permission');

// 添加身份验证和权限检查
router.use(authMiddleware);
router.use(adminMiddleware);
router.use(requireRole('superadmin'));

/**
 * 获取数据库统计信息
 * GET /api/admin/db-migration/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const { dbType, ...config } = req.query;

        if (!dbType) {
            return errorResponse(res, '请指定数据库类型', 400);
        }

        let dbConfig = {};

        if (dbType === 'mysql') {
            dbConfig.host = config.host || process.env.DB_HOST;
            dbConfig.port = config.port || process.env.DB_PORT;
            dbConfig.database = config.database || process.env.DB_NAME;
            dbConfig.user = config.user || process.env.DB_USER;
            dbConfig.password = config.password || process.env.DB_PASSWORD;
        } else if (dbType === 'sqlite') {
            dbConfig.path = config.path || './database.sqlite';
        } else {
            return errorResponse(res, '不支持的数据库类型，仅支持 sqlite 和 mysql', 400);
        }

        const result = await dbMigration.getStats(dbType, dbConfig);

        if (result.success) {
            return successResponse(res, result.stats);
        } else {
            return errorResponse(res, result.message, 500);
        }
    } catch (error) {
        console.error('获取数据库统计失败:', error);
        return errorResponse(res, '获取数据库统计失败', 500);
    }
});

/**
 * 执行数据库迁移
 * POST /api/admin/db-migration/migrate
 * 
 * 请求体:
 * {
 *   sourceType: 'sqlite' | 'mysql',
 *   sourceConfig: { ... },
 *   targetType: 'sqlite' | 'mysql',
 *   targetConfig: { ... },
 *   clearExisting: boolean
 * }
 */
router.post('/migrate', async (req, res) => {
    try {
        const { sourceType, sourceConfig, targetType, targetConfig, clearExisting } = req.body;

        if (!sourceType || !targetType) {
            return errorResponse(res, '请指定源数据库和目标数据库类型', 400);
        }

        const validTypes = ['sqlite', 'mysql'];
        if (!validTypes.includes(sourceType) || !validTypes.includes(targetType)) {
            return errorResponse(res, '不支持的数据库类型，仅支持 sqlite 和 mysql', 400);
        }

        if (sourceType === targetType && 
            JSON.stringify(sourceConfig) === JSON.stringify(targetConfig)) {
            return errorResponse(res, '源数据库和目标数据库不能相同', 400);
        }

        let srcConfig = {};
        if (sourceType === 'mysql') {
            srcConfig.host = sourceConfig?.host || process.env.DB_HOST;
            srcConfig.port = sourceConfig?.port || process.env.DB_PORT;
            srcConfig.database = sourceConfig?.database || process.env.DB_NAME;
            srcConfig.user = sourceConfig?.user || process.env.DB_USER;
            srcConfig.password = sourceConfig?.password || process.env.DB_PASSWORD;
        } else if (sourceType === 'sqlite') {
            srcConfig.path = sourceConfig?.path || './database.sqlite';
        }

        let tgtConfig = {};
        if (targetType === 'mysql') {
            tgtConfig.host = targetConfig?.host || process.env.DB_HOST;
            tgtConfig.port = targetConfig?.port || process.env.DB_PORT;
            tgtConfig.database = targetConfig?.database || process.env.DB_NAME;
            tgtConfig.user = targetConfig?.user || process.env.DB_USER;
            tgtConfig.password = targetConfig?.password || process.env.DB_PASSWORD;
        } else if (targetType === 'sqlite') {
            tgtConfig.path = targetConfig?.path || './database.sqlite';
        }

        console.log(`\n🔄 收到数据库迁移请求: ${sourceType} -> ${targetType}`);
        console.log('操作者:', req.user?.username || '未知');
        console.log('清空目标:', clearExisting ? '是' : '否');

        logOperation(req, 'db_migration_start', 'database', null, {
            sourceType,
            targetType,
            clearExisting
        });

        const result = await dbMigration.migrate(
            sourceType,
            srcConfig,
            targetType,
            tgtConfig,
            clearExisting
        );

        if (result.success) {
            logOperation(req, 'db_migration_success', 'database', null, {
                sourceType,
                targetType,
                stats: result.stats
            });

            return successResponse(res, result.stats, '数据库迁移成功');
        } else {
            logOperation(req, 'db_migration_failed', 'database', null, {
                sourceType,
                targetType,
                error: result.error
            });

            return errorResponse(res, result.message, 500);
        }
    } catch (error) {
        console.error('数据库迁移错误:', error);
        logOperation(req, 'db_migration_error', 'database', null, {
            error: error.message
        });
        return errorResponse(res, `数据库迁移失败: ${error.message}`, 500);
    }
});

/**
 * 测试数据库连接
 * POST /api/admin/db-migration/test-connection
 */
router.post('/test-connection', async (req, res) => {
    try {
        const { dbType, config } = req.body;

        if (!dbType) {
            return errorResponse(res, '请指定数据库类型', 400);
        }

        let testConfig = {};

        if (dbType === 'mysql') {
            const { Sequelize } = require('sequelize');
            testConfig.host = config?.host || process.env.DB_HOST;
            testConfig.port = config?.port || process.env.DB_PORT;
            testConfig.database = config?.database || process.env.DB_NAME;
            testConfig.user = config?.user || process.env.DB_USER;
            testConfig.password = config?.password || process.env.DB_PASSWORD;

            const sequelize = new Sequelize(
                testConfig.database,
                testConfig.user,
                testConfig.password,
                {
                    host: testConfig.host,
                    port: testConfig.port,
                    dialect: 'mysql',
                    logging: false
                }
            );
            await sequelize.authenticate();
            await sequelize.close();
        } else if (dbType === 'sqlite') {
            const { Sequelize } = require('sequelize');
            testConfig.path = config?.path || './database.sqlite';
            const sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: testConfig.path,
                logging: false
            });
            await sequelize.authenticate();
            await sequelize.close();
        } else {
            return errorResponse(res, '不支持的数据库类型，仅支持 sqlite 和 mysql', 400);
        }

        return successResponse(res, null, '数据库连接成功');
    } catch (error) {
        console.error('数据库连接测试失败:', error);
        return errorResponse(res, `数据库连接失败: ${error.message}`, 500);
    }
});

module.exports = router;
