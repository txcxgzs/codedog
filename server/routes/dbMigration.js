const express = require('express');
const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const dbMigration = require('../services/dbMigration');
const { successResponse, errorResponse } = require('../middleware/response');
const { logOperation } = require('../middleware/operationLog');
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/permission');

const router = express.Router();

router.use(authMiddleware, requireRole('superadmin'));

function routeError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function handleRouteError(res, error, fallbackMessage) {
    const statusCode = error.statusCode || 500;
    const message = statusCode < 500 ? error.message : fallbackMessage;
    return errorResponse(res, message, statusCode);
}

function assertAllowedMysqlHost(host) {
    if (!host || process.env.DB_MIGRATION_ALLOW_CUSTOM_HOSTS === 'true') {
        return;
    }

    const allowedHosts = [process.env.DB_HOST, 'localhost', '127.0.0.1']
        .filter(Boolean)
        .map(String);

    if (!allowedHosts.includes(String(host))) {
        throw routeError('Database migration only allows preconfigured database hosts.');
    }
}

function resolveSqlitePath(inputPath) {
    const dataDir = path.resolve(__dirname, '../data');
    fs.mkdirSync(dataDir, { recursive: true });

    const requested = inputPath || process.env.DB_PATH || './data/database.sqlite';
    const resolved = path.isAbsolute(requested)
        ? path.resolve(requested)
        : path.resolve(__dirname, '..', requested);

    if (!resolved.startsWith(dataDir + path.sep) && resolved !== dataDir) {
        throw routeError('SQLite path must stay inside server/data.');
    }

    return resolved;
}

function buildDbConfig(dbType, config = {}) {
    if (dbType === 'mysql') {
        const host = config.host || process.env.DB_HOST;
        assertAllowedMysqlHost(host);
        return {
            host,
            port: config.port || process.env.DB_PORT,
            database: config.database || process.env.DB_NAME,
            user: config.user || process.env.DB_USER,
            password: config.password || process.env.DB_PASSWORD
        };
    }

    if (dbType === 'sqlite') {
        return {
            path: resolveSqlitePath(config.path)
        };
    }

    throw routeError('Unsupported database type. Only sqlite and mysql are allowed.');
}

function assertValidDbType(dbType) {
    if (!['sqlite', 'mysql'].includes(dbType)) {
        throw routeError('Unsupported database type. Only sqlite and mysql are allowed.');
    }
}

router.get('/stats', async (req, res) => {
    try {
        const { dbType, ...config } = req.query;
        if (!dbType) {
            throw routeError('dbType is required.');
        }

        assertValidDbType(dbType);
        const dbConfig = buildDbConfig(dbType, config);
        const result = await dbMigration.getStats(dbType, dbConfig);

        if (!result.success) {
            return errorResponse(res, 'Failed to get database stats.', 500);
        }

        return successResponse(res, result.stats);
    } catch (error) {
        console.error('Failed to get database stats:', error);
        return handleRouteError(res, error, 'Failed to get database stats.');
    }
});

router.post('/migrate', async (req, res) => {
    try {
        const { sourceType, sourceConfig, targetType, targetConfig, clearExisting } = req.body;

        if (!sourceType || !targetType) {
            throw routeError('sourceType and targetType are required.');
        }

        assertValidDbType(sourceType);
        assertValidDbType(targetType);

        if (sourceType === targetType && JSON.stringify(sourceConfig || {}) === JSON.stringify(targetConfig || {})) {
            throw routeError('Source and target databases cannot be identical.');
        }

        const srcConfig = buildDbConfig(sourceType, sourceConfig);
        const tgtConfig = buildDbConfig(targetType, targetConfig);

        logOperation(req, 'db_migration_start', 'database', null, {
            sourceType,
            targetType,
            clearExisting: !!clearExisting
        });

        const result = await dbMigration.migrate(
            sourceType,
            srcConfig,
            targetType,
            tgtConfig,
            !!clearExisting
        );

        if (!result.success) {
            logOperation(req, 'db_migration_failed', 'database', null, {
                sourceType,
                targetType
            });
            return errorResponse(res, 'Database migration failed.', 500);
        }

        logOperation(req, 'db_migration_success', 'database', null, {
            sourceType,
            targetType,
            stats: result.stats
        });

        return successResponse(res, result.stats, 'Database migration completed.');
    } catch (error) {
        console.error('Database migration error:', error);
        logOperation(req, 'db_migration_error', 'database', null, {
            error: error.message
        });
        return handleRouteError(res, error, 'Database migration failed.');
    }
});

router.post('/test-connection', async (req, res) => {
    let sequelize;

    try {
        const { dbType, config } = req.body;
        if (!dbType) {
            throw routeError('dbType is required.');
        }

        assertValidDbType(dbType);
        const testConfig = buildDbConfig(dbType, config);

        if (dbType === 'mysql') {
            sequelize = new Sequelize(
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
        } else {
            sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: testConfig.path,
                logging: false
            });
        }

        await sequelize.authenticate();
        return successResponse(res, null, 'Database connection succeeded.');
    } catch (error) {
        console.error('Database connection test failed:', error);
        return handleRouteError(res, error, 'Database connection failed.');
    } finally {
        if (sequelize) {
            await sequelize.close().catch(() => {});
        }
    }
});

module.exports = router;
