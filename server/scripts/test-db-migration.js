const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const migration = require('../services/dbMigration');

const files = ['source', 'target', 'rollback'].map(name =>
    path.resolve(__dirname, `../data/__migration_test_${name}.sqlite`)
);
const [sourcePath, targetPath, rollbackPath] = files;
const open = storage => new Sequelize({ dialect: 'sqlite', storage, logging: false });
const cleanup = () => files.forEach(file => {
    for (const suffix of ['', '-wal', '-shm']) {
        try { fs.unlinkSync(file + suffix); } catch (_) {}
    }
});

async function seedSource() {
    const connection = open(sourcePath);
    try {
        const models = migration.getCanonicalModels(connection);
        await connection.sync({ force: true });
        await models.User.create({
            id: 1,
            username: 'migration-user',
            email: 'migration@example.test',
            password: 'not-a-real-password-hash'
        });
        await models.Studio.create({ id: 1, name: 'Migration Studio', owner_id: 1 });
        await models.StudioPointLog.create({
            studio_id: 1, admin_id: 1, delta: 5, points_before: 0, points_after: 5, note: 'migration test'
        });
        await models.Report.create({ id: 1, type: 'work', target_id: 1, reporter_id: 1, reason: 'migration test' });
        await models.ReportAuditLog.create({ report_id: 1, handler_id: 1, action: 'created' });
        await models.DeveloperApp.create({
            id: 1,
            owner_user_id: 1,
            name: 'Migration App',
            client_id: 'migration-client',
            client_secret_hash: 'migration-secret-hash'
        });
        await models.DeveloperAppAuditLog.create({ app_id: 1, actor_user_id: 1, action: 'created' });
        const expires_at = new Date(Date.now() + 60 * 60 * 1000);
        await models.OAuthAuthCode.create({
            code: 'migration-code', app_id: 1, user_id: 1,
            redirect_uri: 'https://example.test/callback', expires_at
        });
        await models.OAuthAccessToken.create({ token_hash: 'a'.repeat(64), app_id: 1, user_id: 1, expires_at });
        await models.OAuthRefreshToken.create({ token_hash: 'b'.repeat(64), app_id: 1, user_id: 1, expires_at });
        await models.UserAppAuthorization.create({ user_id: 1, app_id: 1, authorized_at: new Date() });
        await models.SystemConfig.create({ config_key: 'migration_test', config_value: 'source-value' });
        await models.Statistics.create({ stat_key: 'migration_test', stat_value: 42 });
    } finally {
        await connection.close();
    }
}

async function assertTargetValue(storage, expected) {
    const connection = open(storage);
    try {
        const models = migration.getCanonicalModels(connection);
        const row = await models.SystemConfig.findOne({ where: { config_key: 'migration_test' } });
        if (row?.config_value !== expected) {
            throw new Error(`target value mismatch: expected=${expected}, actual=${row?.config_value}`);
        }
    } finally {
        await connection.close();
    }
}

async function testFullAndReplacementMigration() {
    await seedSource();
    const first = await migration.migrate('sqlite', { path: sourcePath }, 'sqlite', { path: targetPath }, false);
    if (!first.success || Object.keys(first.stats).length !== migration.getCanonicalModelEntries().length) {
        throw new Error(`full migration failed: ${JSON.stringify(first)}`);
    }
    for (const name of [
        'studioPointLog', 'reportAuditLog', 'developerApp', 'developerAppAuditLog',
        'oAuthAuthCode', 'oAuthAccessToken', 'oAuthRefreshToken', 'userAppAuthorization'
    ]) {
        if (first.stats[name] !== 1) throw new Error(`previously omitted table was not migrated: ${name}`);
    }
    await assertTargetValue(targetPath, 'source-value');

    const target = open(targetPath);
    try {
        const models = migration.getCanonicalModels(target);
        await models.SystemConfig.update(
            { config_value: 'old-target-value' },
            { where: { config_key: 'migration_test' } }
        );
    } finally {
        await target.close();
    }

    const replacement = await migration.migrate(
        'sqlite', { path: sourcePath }, 'sqlite', { path: targetPath }, true
    );
    if (!replacement.success) throw new Error(`replacement migration failed: ${JSON.stringify(replacement)}`);
    await assertTargetValue(targetPath, 'source-value');
}

async function testRollback() {
    const target = open(rollbackPath);
    try {
        const models = migration.getCanonicalModels(target);
        await target.sync({ force: true });
        await models.SystemConfig.create({ config_key: 'migration_test', config_value: 'preserved' });
    } finally {
        await target.close();
    }

    const data = Object.fromEntries(migration.getCanonicalModelEntries().map(([name]) => [name, []]));
    data.User = [{ id: 1, username: null, email: null, password: null }];
    let failed = false;
    try {
        await migration.writeToTarget('sqlite', { path: rollbackPath }, data, true);
    } catch (_) {
        failed = true;
    }
    if (!failed) throw new Error('invalid migration unexpectedly succeeded');
    await assertTargetValue(rollbackPath, 'preserved');
}

(async () => {
    cleanup();
    await testFullAndReplacementMigration();
    await testRollback();
    console.log(`Migration tests passed (${migration.getCanonicalModelEntries().length} tables).`);
})().finally(cleanup).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
