#!/usr/bin/env node
/**
 * 修复 IP 封禁脏数据：删除 ip 为空/NULL 的无效记录
 * 用法：node server/scripts/fix-ipban-dirty-data.js [--dry-run]
 */
require('dotenv').config();
const path = require('path');

(async () => {
    const { IpBan, sequelize } = require(path.join(__dirname, '..', 'models'));
    const dryRun = process.argv.includes('--dry-run');

    try {
        await sequelize.authenticate();

        // 1. 查找脏数据：ip 为空、NULL 或仅空白字符
        const { Op } = require('sequelize');
        const dirty = await IpBan.findAll({
            where: {
                [Op.or]: [
                    { ip: null },
                    { ip: '' },
                    { ip: { [Op.like]: '% %' } }
                ]
            },
            attributes: ['id', 'ip', 'reason', 'created_at']
        });

        if (dirty.length === 0) {
            console.log('[OK] 未发现脏数据，IP 封禁表干净。');
            await sequelize.close();
            return;
        }

        console.log(`[发现] ${dirty.length} 条 ip 为空的无效封禁记录：`);
        for (const r of dirty) {
            console.log(`  ID=${r.id}  ip="${(r.ip || '').trim() || '(空)'}"  reason="${r.reason || '-'}"  created=${r.created_at}`);
        }

        if (dryRun) {
            console.log(`\n[DRY-RUN] 以上 ${dirty.length} 条记录将被删除。不带 --dry-run 执行实际删除。`);
        } else {
            const ids = dirty.map(r => r.id);
            const deleted = await IpBan.destroy({ where: { id: { [Op.in]: ids } } });
            console.log(`[完成] 已删除 ${deleted} 条无效封禁记录。`);
        }

        await sequelize.close();
    } catch (err) {
        console.error('[ERROR]', err.message);
        process.exit(1);
    }
})();