/**
 * 修复历史数据中的相对路径图片 URL
 * 将以 / 或 // 开头的相对路径补全为 https://cdn.codemao.cn 开头的绝对 URL
 *
 * 用法: node scripts/repairImageUrls.js
 */
const path = require('path');
const { sequelize } = require(path.join(__dirname, '..', 'models'));

function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return url;
    url = url.trim();
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;       // 已是绝对 URL
    if (url.startsWith('//')) return 'https:' + url;  // 协议相对
    if (url.startsWith('/')) return 'https://cdn.codemao.cn' + url; // 相对路径
    return url;
}

async function repairTable(modelName, fields) {
    const model = sequelize.models[modelName];
    if (!model) {
        console.log(`  [跳过] 模型 ${modelName} 不存在`);
        return { scanned: 0, fixed: 0 };
    }

    const records = await model.findAll({ attributes: ['id', ...fields] });
    console.log(`  ${modelName}: 扫描 ${records.length} 条记录`);

    let fixed = 0;
    for (const record of records) {
        const updates = {};
        let changed = false;

        for (const field of fields) {
            const val = record[field];
            if (val && typeof val === 'string') {
                const newVal = normalizeUrl(val);
                if (newVal !== val) {
                    updates[field] = newVal;
                    changed = true;
                }
            }
        }

        if (changed) {
            await model.update(updates, { where: { id: record.id } });
            fixed++;
            if (fixed <= 5) {
                console.log(`    [${modelName}] id=${record.id}: ${JSON.stringify(updates)}`);
            }
        }
    }

    if (fixed > 5) console.log(`    ... 及其他 ${fixed - 5} 条`);
    console.log(`  ${modelName}: 修复 ${fixed} 条`);
    return { scanned: records.length, fixed };
}

async function main() {
    console.log('=== 修复历史相对路径图片 URL ===\n');

    const tasks = [
        ['User',  ['avatar']],
        ['Work',  ['preview', 'work_url']],
        ['Post',  ['cover']],
        ['Studio',['cover', 'cover_url']],
        ['Banner',['image_url']],
    ];

    let totalFixed = 0;
    for (const [model, fields] of tasks) {
        try {
            const { fixed } = await repairTable(model, fields);
            totalFixed += fixed;
        } catch (e) {
            console.error(`  [错误] ${model}: ${e.message}`);
        }
    }

    console.log(`\n=== 完成,共修复 ${totalFixed} 条记录 ===`);
    process.exit(0);
}

main().catch(err => {
    console.error('修复失败:', err);
    process.exit(1);
});
