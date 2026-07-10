#!/usr/bin/env node
'use strict';

/**
 * CodeDog Terminal Toolbox — data-level diagnostic & repair CLI.
 *
 * Reuses the project's Sequelize connection (server/models/index.js) so it
 * always talks to the same DB the app uses. Run from the project root or
 * from server/ (env vars / .env are auto-loaded from server/.env when present).
 *
 * Usage:
 *   node scripts/toolbox.js <command> [options]
 *
 * Commands:
 *   help                Show this help screen
 *   list-commands       Print the available subcommands (one per line)
 *   consistency-check   Scan DB for drifted counters, dangling refs, soft-delete orphans
 *   repair-counts       Recompute & fix drifted counters (use --dry-run to preview)
 *   security-audit     Scan for weak password hashes, XSS-y nickname/bio, invalid ENUMs
 *   db-health           DB file/WAL size, pool stats, table row counts, orphan FKs
 *
 * Global options:
 *   --json              Emit machine-readable JSON to stdout (human messages go to stderr)
 *   --dry-run           For repair commands: print what would change, do NOT write
 *   -h, --help          Show this help
 *
 * Examples:
 *   node scripts/toolbox.js consistency-check
 *   node scripts/toolbox.js consistency-check --json
 *   node scripts/toolbox.js repair-counts --dry-run
 *   node scripts/toolbox.js repair-counts            # actually writes (single transaction)
 *   node scripts/toolbox.js db-health
 *   node scripts/toolbox.js security-audit --json
 *
 * NOTE: scripts/check-consistency.js runs STATIC source-code consistency checks
 *       (run via `npm run check:consistency` from server/). This toolbox covers
 *       DATA-level consistency / repair — the two are complementary.
 */

const path = require('path');
const fs = require('fs');

// ----------------------------------------------------------------------------
// Argument parsing (minimal, dependency-free)
// ----------------------------------------------------------------------------

// Flags that never consume the following token as their value.
const BOOLEAN_FLAGS = new Set(['json', 'dry-run', 'help']);

function parseArgs(argv) {
    const positional = [];
    const flags = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--') {
            positional.push(...argv.slice(i + 1));
            break;
        }
        if (token.startsWith('--')) {
            const key = token.slice(2);
            if (BOOLEAN_FLAGS.has(key)) {
                flags[key] = true;
            } else {
                const next = argv[i + 1];
                if (next !== undefined && !next.startsWith('--')) {
                    flags[key] = next;
                    i += 1;
                } else {
                    flags[key] = true;
                }
            }
        } else if (token === '-h') {
            flags.help = true;
        } else {
            positional.push(token);
        }
    }
    return {
        command: positional[0],
        args: positional.slice(1),
        flags,
        json: flags.json === true,
        dryRun: flags['dry-run'] === true
    };
}

// ----------------------------------------------------------------------------
// Output helpers
// ----------------------------------------------------------------------------

const COLORS = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m',
    green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
    cyan: '\x1b[36m', gray: '\x1b[90m'
};

function useColor(args) {
    return !args.json && process.stdout.isTTY === true;
}

function color(args, name, text) {
    if (!useColor(args)) return String(text);
    return `${COLORS[name] || ''}${text}${COLORS.reset}`;
}

function visibleLen(s) {
    return String(s == null ? '' : s).replace(/\x1b\[[0-9;]*m/g, '').length;
}

function pad(str, width) {
    const s = String(str == null ? '' : str);
    return s + ' '.repeat(Math.max(0, width - visibleLen(s)));
}

// Markdown-ish table. rows = array of flat objects; headers derived from the first row.
function printTable(args, headers, rows) {
    if (args.json) return;
    if (!rows || !rows.length) {
        console.log(color(args, 'dim', '  (no rows)'));
        return;
    }
    const widths = headers.map((h) => Math.max(visibleLen(h), ...rows.map((r) => visibleLen(r[h]))));
    const sep = '  ';
    console.log(color(args, 'bold', headers.map((h, i) => pad(h, widths[i])).join(sep)));
    console.log(color(args, 'dim', headers.map((_, i) => '-'.repeat(widths[i])).join(sep)));
    for (const r of rows) {
        console.log(headers.map((h, i) => pad(r[h], widths[i])).join(sep));
    }
}

// Print a sample of drift/finding rows, flattening nested {stored, actual} -> "stored→actual".
function printSample(args, title, sample) {
    if (args.json || !sample || !sample.length) return;
    const limit = 10;
    const slice = sample.slice(0, limit);
    console.log(color(args, 'bold', `\n${title} (showing ${slice.length} of ${sample.length}):`));
    const flatRows = slice.map((r) => {
        const flat = {};
        for (const [k, v] of Object.entries(r)) {
            if (v && typeof v === 'object' && 'stored' in v && 'actual' in v) {
                flat[k] = `${v.stored}→${v.actual}`;
            } else {
                flat[k] = v;
            }
        }
        return flat;
    });
    printTable(args, Object.keys(flatRows[0]), flatRows);
}

function emitResult(args, payload) {
    if (args.json) {
        process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    }
}

function fileSize(p) {
    try { return fs.statSync(p).size; } catch (_) { return null; }
}

function humanBytes(n) {
    if (n == null) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ----------------------------------------------------------------------------
// Model loading (deferred so --json/help/list-commands don't bootstrap the DB)
// ----------------------------------------------------------------------------

async function loadModels(args) {
    const envPath = path.resolve(__dirname, '../server/.env');
    try {
        const dotenv = require('dotenv');
        if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
    } catch (_) {
        // dotenv not resolvable from this location; server/models/index.js loads
        // its own dotenv.config() (relative to CWD) when required below.
    }

    // 修复: DB_PATH 路径解析问题
    // config/database.js 使用 process.env.DB_PATH || './data/database.sqlite'
    // 默认路径 ./data/ 是相对于 CWD(当前工作目录)解析的。
    //
    // 问题场景:
    //   - 本地开发: server/.env 无 DB_PATH,默认 ./data/database.sqlite
    //     * 从 server/ 运行 app.js → 解析为 server/data/database.sqlite ✓
    //     * 从项目根运行 toolbox.js → 解析为 <root>/data/database.sqlite ✗(应为 server/data/)
    //
    // 修复策略: 如果 DB_PATH 是相对路径且解析后的文件不存在,
    //          尝试相对于 server/ 目录解析(本地开发场景)
    if (process.env.DB_TYPE !== 'mysql' && process.env.DB_PATH) {
        const dbPath = process.env.DB_PATH;
        if (!path.isAbsolute(dbPath)) {
            const rootResolved = path.resolve(process.cwd(), dbPath);
            if (!fs.existsSync(rootResolved)) {
                // 尝试相对于 server/ 目录解析(本地开发场景)
                const serverResolved = path.resolve(__dirname, '../server', dbPath);
                if (fs.existsSync(serverResolved)) {
                    process.env.DB_PATH = serverResolved;
                }
            }
        }
    } else if (!process.env.DB_PATH && process.env.DB_TYPE !== 'mysql') {
        // DB_PATH 未设置且非 MySQL: 默认 ./data/database.sqlite
        // 先检查 CWD/data/database.sqlite,不存在则用 server/data/database.sqlite
        const defaultPath = path.resolve(process.cwd(), './data/database.sqlite');
        if (!fs.existsSync(defaultPath)) {
            const serverDefault = path.resolve(__dirname, '../server/data/database.sqlite');
            if (fs.existsSync(serverDefault)) {
                process.env.DB_PATH = serverDefault;
            }
        }
    }

    // Redirect the bootstrap console.log noise (📦 加载Sequelize模型 etc.)
    // to stderr when --json so stdout stays pure JSON.
    const origLog = console.log;
    if (args.json) console.log = (...a) => console.error(...a);
    try {
        const models = require('../server/models');
        const Sequelize = models.sequelize.constructor;
        return { models, Op: Sequelize.Op, QueryTypes: Sequelize.QueryTypes };
    } finally {
        console.log = origLog;
    }
}

async function closeModels(ctx) {
    if (!ctx || !ctx.models) return;
    try { await ctx.models.sequelize.close(); } catch (_) { /* ignore */ }
}

// ----------------------------------------------------------------------------
// Query helpers
// ----------------------------------------------------------------------------

// Aggregate count map: groupField value -> row count.
async function buildCountMap(ctx, model, groupField, where) {
    const { sequelize } = ctx.models;
    const rows = await model.findAll({
        attributes: [groupField, [sequelize.fn('COUNT', sequelize.col(groupField)), 'cnt']],
        where,
        group: [groupField],
        raw: true
    });
    const map = new Map();
    for (const r of rows) {
        if (r[groupField] != null) map.set(Number(r[groupField]), Number(r.cnt));
    }
    return map;
}

// Count rows in `model` whose `field` is non-null and references a missing `refModel.refField`.
async function countOrphanRows(ctx, model, field, refModel, refField) {
    const table = model.getTableName();
    const refTable = refModel.getTableName();
    const [result] = await ctx.models.sequelize.query(
        `SELECT COUNT(*) AS cnt FROM \`${table}\` t ` +
        `WHERE t.\`${field}\` IS NOT NULL ` +
        `AND NOT EXISTS (SELECT 1 FROM \`${refTable}\` r WHERE r.\`${refField}\` = t.\`${field}\`)`
    );
    return Number(result[0] && result[0].cnt) || 0;
}

// ----------------------------------------------------------------------------
// Command: consistency-check
// ----------------------------------------------------------------------------

async function runConsistencyCheck(ctx, args) {
    const { models, Op } = ctx;
    const { Work, Like, Favorite, Comment, User, Post, Studio, StudioMember, StudioWork, Report, Follow } = models;

    const result = { command: 'consistency-check', timestamp: new Date().toISOString(), checks: {} };

    // 1. Work counter drift: praise_times / collection_times / comment_count
    const likeByWork = await buildCountMap(ctx, Like, 'work_id', { work_id: { [Op.ne]: null } });
    const favByWork = await buildCountMap(ctx, Favorite, 'work_id', { work_id: { [Op.ne]: null } });
    const cmtByWork = await buildCountMap(ctx, Comment, 'work_id', { work_id: { [Op.ne]: null }, status: 'active' });
    const works = await Work.findAll({
        attributes: ['id', 'name', 'status', 'praise_times', 'collection_times', 'comment_count'],
        raw: true
    });
    const workDrifts = [];
    for (const w of works) {
        const praise = likeByWork.get(w.id) || 0;
        const coll = favByWork.get(w.id) || 0;
        const cmt = cmtByWork.get(w.id) || 0;
        if (w.praise_times !== praise || w.collection_times !== coll || w.comment_count !== cmt) {
            workDrifts.push({
                id: w.id, name: w.name, status: w.status,
                praise_times: { stored: w.praise_times, actual: praise },
                collection_times: { stored: w.collection_times, actual: coll },
                comment_count: { stored: w.comment_count, actual: cmt }
            });
        }
    }
    result.checks.work_counters = { drift_count: workDrifts.length, sample: workDrifts.slice(0, 100) };

    // 2. User.work_count drift (counts published works only — matches userController convention)
    const workByUser = await buildCountMap(ctx, Work, 'user_id', { status: 'published' });
    const users = await User.findAll({ attributes: ['id', 'username', 'work_count', 'follower_count', 'following_count'], raw: true });
    const userWorkDrifts = [];
    for (const u of users) {
        const actual = workByUser.get(u.id) || 0;
        if (u.work_count !== actual) {
            userWorkDrifts.push({ id: u.id, username: u.username, work_count: { stored: u.work_count, actual } });
        }
    }
    result.checks.user_work_count = { drift_count: userWorkDrifts.length, sample: userWorkDrifts.slice(0, 100) };

    // 3. User follower_count / following_count drift
    const followerByUser = await buildCountMap(ctx, Follow, 'following_id', {});
    const followingByUser = await buildCountMap(ctx, Follow, 'follower_id', {});
    const userFollowDrifts = [];
    for (const u of users) {
        const follower = followerByUser.get(u.id) || 0;
        const following = followingByUser.get(u.id) || 0;
        if (u.follower_count !== follower || u.following_count !== following) {
            userFollowDrifts.push({
                id: u.id, username: u.username,
                follower_count: { stored: u.follower_count, actual: follower },
                following_count: { stored: u.following_count, actual: following }
            });
        }
    }
    result.checks.user_follow_counts = { drift_count: userFollowDrifts.length, sample: userFollowDrifts.slice(0, 100) };

    // 4. Comment.parent_id -> soft-deleted (or missing) parent (orphan replies)
    const replies = await Comment.findAll({
        attributes: ['id', 'parent_id', 'status'],
        where: { parent_id: { [Op.ne]: null } },
        raw: true
    });
    const parentIds = [...new Set(replies.map((r) => r.parent_id))];
    const parents = parentIds.length
        ? await Comment.findAll({ attributes: ['id', 'status'], where: { id: parentIds }, raw: true })
        : [];
    const parentStatus = new Map(parents.map((p) => [p.id, p.status]));
    const orphanReplies = [];
    for (const r of replies) {
        const ps = parentStatus.get(r.parent_id);
        if (ps === 'deleted' || ps === 'hidden') {
            orphanReplies.push({ id: r.id, parent_id: r.parent_id, parent_status: ps });
        } else if (ps === undefined) {
            orphanReplies.push({ id: r.id, parent_id: r.parent_id, parent_status: 'missing' });
        }
    }
    result.checks.comment_orphan_replies = { drift_count: orphanReplies.length, sample: orphanReplies.slice(0, 100) };

    // 5. Report.target_id -> non-existent target (dangling)
    const reports = await Report.findAll({ attributes: ['id', 'type', 'target_id'], raw: true });
    const danglingReports = [];
    const groupedByType = {};
    for (const r of reports) {
        const resolver = { work: Work, post: Post, comment: Comment, user: User }[r.type];
        if (!resolver) {
            danglingReports.push({ id: r.id, type: r.type, target_id: r.target_id, reason: 'unknown_report_type' });
            continue;
        }
        (groupedByType[r.type] = groupedByType[r.type] || []).push(r);
    }
    for (const [type, group] of Object.entries(groupedByType)) {
        const resolver = { work: Work, post: Post, comment: Comment, user: User }[type];
        const ids = [...new Set(group.map((r) => r.target_id))];
        if (!ids.length) continue;
        const existing = await resolver.findAll({ attributes: ['id'], where: { id: ids }, raw: true });
        const existingSet = new Set(existing.map((e) => e.id));
        for (const r of group) {
            if (!existingSet.has(r.target_id)) {
                danglingReports.push({ id: r.id, type: r.type, target_id: r.target_id, reason: 'target_missing' });
            }
        }
    }
    result.checks.report_dangling_targets = { drift_count: danglingReports.length, sample: danglingReports.slice(0, 100) };

    // 6. Studio member_count / work_count drift
    const memberByStudio = await buildCountMap(ctx, StudioMember, 'studio_id', { status: 'active' });
    const studioWorkByStudio = await buildCountMap(ctx, StudioWork, 'studio_id', { status: 'approved' });
    const studios = await Studio.findAll({ attributes: ['id', 'name', 'status', 'member_count', 'work_count'], raw: true });
    const studioDrifts = [];
    for (const s of studios) {
        const members = memberByStudio.get(s.id) || 0;
        const sw = studioWorkByStudio.get(s.id) || 0;
        if (s.member_count !== members || s.work_count !== sw) {
            studioDrifts.push({
                id: s.id, name: s.name, status: s.status,
                member_count: { stored: s.member_count, actual: members },
                work_count: { stored: s.work_count, actual: sw }
            });
        }
    }
    result.checks.studio_counts = { drift_count: studioDrifts.length, sample: studioDrifts.slice(0, 100) };

    result.summary = {
        total_drifts: Object.values(result.checks).reduce((acc, c) => acc + (c.drift_count || 0), 0),
        healthy: Object.values(result.checks).every((c) => (c.drift_count || 0) === 0)
    };

    if (!args.json) {
        console.log(color(args, 'cyan', '\n═══ Consistency Check ═══'));
        console.log(`Scanned at ${result.timestamp}`);
        console.log('');
        printTable(args, ['Check', 'Drifts'], [
            { Check: 'Work counters (praise/collection/comment)', Drifts: workDrifts.length },
            { Check: 'User.work_count', Drifts: userWorkDrifts.length },
            { Check: 'User follower/following_count', Drifts: userFollowDrifts.length },
            { Check: 'Comment orphan replies (soft-deleted/missing parent)', Drifts: orphanReplies.length },
            { Check: 'Report dangling targets', Drifts: danglingReports.length },
            { Check: 'Studio member_count/work_count', Drifts: studioDrifts.length }
        ]);
        printSample(args, 'Work counter drifts', workDrifts);
        printSample(args, 'User.work_count drifts', userWorkDrifts);
        printSample(args, 'User follow-count drifts', userFollowDrifts);
        printSample(args, 'Comment orphan replies', orphanReplies);
        printSample(args, 'Dangling reports', danglingReports);
        printSample(args, 'Studio count drifts', studioDrifts);
        console.log('');
        if (result.summary.healthy) {
            console.log(color(args, 'green', '✓ All counts consistent.'));
        } else {
            console.log(color(args, 'yellow', `⚠ ${result.summary.total_drifts} drift(s) found. Run \`repair-counts --dry-run\` to preview fixes.`));
        }
        console.log(color(args, 'dim', '  Tip: add --json for full machine-readable output (all samples, not capped).'));
    }
    emitResult(args, result);
    return result;
}

// ----------------------------------------------------------------------------
// Command: repair-counts
// ----------------------------------------------------------------------------

async function runRepairCounts(ctx, args) {
    const { models, Op } = ctx;
    const { Work, Like, Favorite, Comment, User, Studio, StudioMember, StudioWork, Follow, sequelize } = models;

    // Aggregate actuals
    const likeByWork = await buildCountMap(ctx, Like, 'work_id', { work_id: { [Op.ne]: null } });
    const favByWork = await buildCountMap(ctx, Favorite, 'work_id', { work_id: { [Op.ne]: null } });
    const cmtByWork = await buildCountMap(ctx, Comment, 'work_id', { work_id: { [Op.ne]: null }, status: 'active' });
    const workByUser = await buildCountMap(ctx, Work, 'user_id', { status: 'published' });
    const followerByUser = await buildCountMap(ctx, Follow, 'following_id', {});
    const followingByUser = await buildCountMap(ctx, Follow, 'follower_id', {});
    const memberByStudio = await buildCountMap(ctx, StudioMember, 'studio_id', { status: 'active' });
    const studioWorkByStudio = await buildCountMap(ctx, StudioWork, 'studio_id', { status: 'approved' });

    const works = await Work.findAll({ attributes: ['id', 'praise_times', 'collection_times', 'comment_count'], raw: true });
    const users = await User.findAll({ attributes: ['id', 'work_count', 'follower_count', 'following_count'], raw: true });
    const studios = await Studio.findAll({ attributes: ['id', 'member_count', 'work_count'], raw: true });

    const planned = { work_counters: [], user_work_count: [], user_follow_counts: [], studio_counts: [] };

    for (const w of works) {
        const praise = likeByWork.get(w.id) || 0;
        const coll = favByWork.get(w.id) || 0;
        const cmt = cmtByWork.get(w.id) || 0;
        if (w.praise_times !== praise || w.collection_times !== coll || w.comment_count !== cmt) {
            planned.work_counters.push({
                id: w.id, praise_times: praise, collection_times: coll, comment_count: cmt,
                prev: { praise_times: w.praise_times, collection_times: w.collection_times, comment_count: w.comment_count }
            });
        }
    }
    for (const u of users) {
        const wc = workByUser.get(u.id) || 0;
        if (u.work_count !== wc) {
            planned.user_work_count.push({ id: u.id, work_count: wc, prev: u.work_count });
        }
        const fc = followerByUser.get(u.id) || 0;
        const fg = followingByUser.get(u.id) || 0;
        if (u.follower_count !== fc || u.following_count !== fg) {
            planned.user_follow_counts.push({
                id: u.id, follower_count: fc, following_count: fg,
                prev: { follower_count: u.follower_count, following_count: u.following_count }
            });
        }
    }
    for (const s of studios) {
        const mc = memberByStudio.get(s.id) || 0;
        const wkc = studioWorkByStudio.get(s.id) || 0;
        if (s.member_count !== mc || s.work_count !== wkc) {
            planned.studio_counts.push({
                id: s.id, member_count: mc, work_count: wkc,
                prev: { member_count: s.member_count, work_count: s.work_count }
            });
        }
    }

    const totalPlanned = planned.work_counters.length + planned.user_work_count.length
        + planned.user_follow_counts.length + planned.studio_counts.length;

    let applied = null;
    if (!args.dryRun) {
        applied = { work_counters: 0, user_work_count: 0, user_follow_counts: 0, studio_counts: 0 };
        const t = await sequelize.transaction();
        try {
            for (const w of planned.work_counters) {
                await Work.update(
                    { praise_times: w.praise_times, collection_times: w.collection_times, comment_count: w.comment_count },
                    { where: { id: w.id }, transaction: t }
                );
                applied.work_counters += 1;
            }
            for (const u of planned.user_work_count) {
                await User.update({ work_count: u.work_count }, { where: { id: u.id }, transaction: t });
                applied.user_work_count += 1;
            }
            for (const u of planned.user_follow_counts) {
                await User.update(
                    { follower_count: u.follower_count, following_count: u.following_count },
                    { where: { id: u.id }, transaction: t }
                );
                applied.user_follow_counts += 1;
            }
            for (const s of planned.studio_counts) {
                await Studio.update(
                    { member_count: s.member_count, work_count: s.work_count },
                    { where: { id: s.id }, transaction: t }
                );
                applied.studio_counts += 1;
            }
            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }

    const result = {
        command: 'repair-counts',
        dry_run: args.dryRun,
        timestamp: new Date().toISOString(),
        planned,
        applied,
        total_planned: totalPlanned
    };

    if (!args.json) {
        console.log(color(args, 'cyan', '\n═══ Repair Counts ═══'));
        console.log(`Mode: ${args.dryRun ? color(args, 'yellow', 'DRY-RUN (no writes)') : color(args, 'green', 'WRITE')}`);
        console.log('');
        printTable(args, ['Target', 'Planned updates'], [
            { Target: 'Work counters (praise/collection/comment)', 'Planned updates': planned.work_counters.length },
            { Target: 'User.work_count', 'Planned updates': planned.user_work_count.length },
            { Target: 'User follower/following_count', 'Planned updates': planned.user_follow_counts.length },
            { Target: 'Studio member_count/work_count', 'Planned updates': planned.studio_counts.length }
        ]);
        if (!args.dryRun) {
            console.log('');
            printTable(args, ['Target', 'Applied'], [
                { Target: 'Work counters', Applied: applied.work_counters },
                { Target: 'User.work_count', Applied: applied.user_work_count },
                { Target: 'User follower/following', Applied: applied.user_follow_counts },
                { Target: 'Studio counts', Applied: applied.studio_counts }
            ]);
            console.log(color(args, 'green', `\n✓ Applied ${totalPlanned} update(s) in a single transaction.`));
        } else {
            console.log(color(args, 'yellow', `\n⚠ DRY-RUN: ${totalPlanned} update(s) planned. Re-run without --dry-run to apply.`));
        }
        printSample(args, 'Work counter updates', planned.work_counters.map((p) => ({
            id: p.id,
            praise: `${p.prev.praise_times}→${p.praise_times}`,
            collection: `${p.prev.collection_times}→${p.collection_times}`,
            comment: `${p.prev.comment_count}→${p.comment_count}`
        })));
        printSample(args, 'User.work_count updates', planned.user_work_count.map((p) => ({ id: p.id, work_count: `${p.prev}→${p.work_count}` })));
        printSample(args, 'User follow-count updates', planned.user_follow_counts.map((p) => ({
            id: p.id,
            follower: `${p.prev.follower_count}→${p.follower_count}`,
            following: `${p.prev.following_count}→${p.following_count}`
        })));
        printSample(args, 'Studio count updates', planned.studio_counts.map((p) => ({
            id: p.id,
            member: `${p.prev.member_count}→${p.member_count}`,
            work: `${p.prev.work_count}→${p.work_count}`
        })));
    }
    emitResult(args, result);
    return result;
}

// ----------------------------------------------------------------------------
// Command: security-audit
// ----------------------------------------------------------------------------

async function runSecurityAudit(ctx, args) {
    const { models, Op } = ctx;
    const { User, Work, Post, Studio, Comment, StudioMember, StudioWork, Report, SensitiveWord } = models;

    const result = { command: 'security-audit', timestamp: new Date().toISOString(), findings: {} };

    // 1. Weak/invalid password hashes (bcrypt format: $2[aby]$XX$[53 chars]) + known placeholders.
    const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
    const PLACEHOLDER_PW = new Set(['not-used', 'placeholder', '', 'password', '123456', 'admin']);
    const users = await User.findAll({
        attributes: ['id', 'username', 'role', 'status', 'password', 'nickname', 'bio'],
        raw: true
    });
    const weakPw = [];
    const xssBio = [];
    for (const u of users) {
        const pw = u.password || '';
        if (!BCRYPT_RE.test(pw) || PLACEHOLDER_PW.has(pw)) {
            weakPw.push({
                id: u.id, username: u.username, role: u.role, status: u.status,
                reason: !BCRYPT_RE.test(pw) ? 'not_bcrypt_format' : 'placeholder_value'
            });
        }
        const nickHasAngle = u.nickname && /[<>]/.test(u.nickname);
        const bioHasAngle = u.bio && /[<>]/.test(u.bio);
        if (nickHasAngle || bioHasAngle) {
            xssBio.push({
                id: u.id, username: u.username,
                nickname: nickHasAngle ? 'has <>' : '',
                bio: bioHasAngle ? 'has <>' : ''
            });
        }
    }
    result.findings.weak_password_hash = { count: weakPw.length, sample: weakPw.slice(0, 100) };
    result.findings.xss_in_nickname_or_bio = { count: xssBio.length, sample: xssBio.slice(0, 100) };

    // 2. Invalid ENUM status values (raw query to catch anything outside the valid set, incl. NULL).
    const enumChecks = [
        { table: 'works', field: 'status', valid: ['pending', 'published', 'rejected', 'deleted'] },
        { table: 'posts', field: 'status', valid: ['published', 'draft', 'hidden', 'deleted'] },
        { table: 'comments', field: 'status', valid: ['active', 'hidden', 'deleted'] },
        { table: 'studios', field: 'status', valid: ['active', 'pending', 'dissolved', 'banned'] },
        { table: 'studio_members', field: 'status', valid: ['active', 'pending', 'rejected'] },
        { table: 'studio_works', field: 'status', valid: ['pending', 'approved', 'rejected', 'down'] },
        { table: 'reports', field: 'status', valid: ['pending', 'processing', 'resolved', 'rejected'] },
        { table: 'sensitive_words', field: 'status', valid: ['active', 'disabled'] }
    ];
    const invalidEnums = [];
    for (const c of enumChecks) {
        const placeholders = c.valid.map(() => '?').join(',');
        const [badRows] = await models.sequelize.query(
            `SELECT \`${c.field}\` AS val, COUNT(*) AS cnt FROM \`${c.table}\` ` +
            `WHERE \`${c.field}\` IS NOT NULL AND \`${c.field}\` NOT IN (${placeholders}) ` +
            `GROUP BY \`${c.field}\``,
            { replacements: c.valid }
        );
        for (const row of badRows) {
            invalidEnums.push({ table: c.table, field: c.field, value: row.val, count: Number(row.cnt) });
        }
        const [nullRows] = await models.sequelize.query(
            `SELECT COUNT(*) AS cnt FROM \`${c.table}\` WHERE \`${c.field}\` IS NULL`
        );
        const nullCount = Number(nullRows[0] && nullRows[0].cnt) || 0;
        if (nullCount > 0) {
            invalidEnums.push({ table: c.table, field: c.field, value: null, count: nullCount });
        }
    }
    result.findings.invalid_enum_status = { count: invalidEnums.length, sample: invalidEnums.slice(0, 100) };

    result.summary = {
        total_findings: Object.values(result.findings).reduce((a, f) => a + (f.count || 0), 0),
        healthy: Object.values(result.findings).every((f) => (f.count || 0) === 0)
    };

    if (!args.json) {
        console.log(color(args, 'cyan', '\n═══ Security Audit ═══'));
        console.log(`Scanned at ${result.timestamp}`);
        console.log('');
        printTable(args, ['Finding', 'Count'], [
            { Finding: 'Weak / invalid password hashes', Count: weakPw.length },
            { Finding: 'XSS-y < or > in nickname/bio', Count: xssBio.length },
            { Finding: 'Invalid ENUM status values', Count: invalidEnums.length }
        ]);
        printSample(args, 'Weak password hashes', weakPw);
        printSample(args, 'XSS-y nickname/bio', xssBio);
        printSample(args, 'Invalid ENUM statuses', invalidEnums);
        console.log('');
        if (result.summary.healthy) {
            console.log(color(args, 'green', '✓ No security findings.'));
        } else {
            console.log(color(args, 'yellow', `⚠ ${result.summary.total_findings} finding(s).`));
        }
    }
    emitResult(args, result);
    return result;
}

// ----------------------------------------------------------------------------
// Command: db-health
// ----------------------------------------------------------------------------

async function runDbHealth(ctx, args) {
    const { models } = ctx;
    const { sequelize } = models;
    const dialect = sequelize.getDialect();

    const result = { command: 'db-health', timestamp: new Date().toISOString(), dialect, checks: {} };

    // 1. DB file / WAL size (sqlite only)
    if (dialect === 'sqlite') {
        let file = null;
        try {
            const [dbList] = await sequelize.query('PRAGMA database_list');
            const main = dbList.find((r) => r.name === 'main') || dbList[0];
            const dbPath = main && main.file;
            if (dbPath) {
                file = { path: dbPath };
                file.size_bytes = fileSize(dbPath);
                file.size_human = humanBytes(file.size_bytes);
                const walPath = `${dbPath}-wal`;
                const shmPath = `${dbPath}-shm`;
                file.wal = fs.existsSync(walPath)
                    ? { path: walPath, size_bytes: fileSize(walPath), size_human: humanBytes(fileSize(walPath)) }
                    : null;
                file.shm = fs.existsSync(shmPath)
                    ? { path: shmPath, size_bytes: fileSize(shmPath), size_human: humanBytes(fileSize(shmPath)) }
                    : null;
            }
        } catch (e) {
            file = { error: e.message };
        }
        result.checks.file = file;

        let pragma = null;
        try {
            const [jm] = await sequelize.query('PRAGMA journal_mode');
            const [fk] = await sequelize.query('PRAGMA foreign_keys');
            pragma = {
                journal_mode: jm[0] && jm[0].journal_mode,
                foreign_keys: fk[0] && fk[0].foreign_keys
            };
        } catch (e) {
            pragma = { error: e.message };
        }
        result.checks.pragma = pragma;
    } else {
        result.checks.file = null;
        result.checks.pragma = null;
    }

    // 2. Connection pool stats (best-effort — pool shape varies by sequelize version).
    let pool = null;
    try {
        const p = sequelize.connectionManager && sequelize.connectionManager.pool;
        if (p) {
            pool = {
                size: typeof p.size === 'function' ? p.size() : p.size,
                available: typeof p.available === 'function' ? p.available() : p.available,
                pending: typeof p.pending === 'function' ? p.pending() : p.pending,
                min: p.min,
                max: p.max
            };
        }
    } catch (e) {
        pool = { error: e.message };
    }
    result.checks.pool = pool;

    // 3. Table row counts
    const tableCounts = [];
    for (const [name, model] of Object.entries(models)) {
        if (!model || typeof model.getTableName !== 'function' || typeof model.count !== 'function') continue;
        try {
            const count = await model.count();
            tableCounts.push({ table: model.getTableName(), rows: count });
        } catch (e) {
            tableCounts.push({ table: model.getTableName(), rows: 'error', error: e.message });
        }
    }
    result.checks.tables = tableCounts;

    // 4. Orphan FK references (non-null field pointing to a missing parent)
    const fkSpecs = [
        ['Work', 'user_id', 'User', 'id'],
        ['Post', 'user_id', 'User', 'id'],
        ['Comment', 'user_id', 'User', 'id'],
        ['Comment', 'work_id', 'Work', 'id'],
        ['Comment', 'post_id', 'Post', 'id'],
        ['Comment', 'parent_id', 'Comment', 'id'],
        ['Studio', 'owner_id', 'User', 'id'],
        ['StudioMember', 'studio_id', 'Studio', 'id'],
        ['StudioMember', 'user_id', 'User', 'id'],
        ['StudioWork', 'studio_id', 'Studio', 'id'],
        ['StudioWork', 'work_id', 'Work', 'id'],
        ['StudioWork', 'user_id', 'User', 'id'],
        ['Like', 'user_id', 'User', 'id'],
        ['Like', 'work_id', 'Work', 'id'],
        ['Like', 'post_id', 'Post', 'id'],
        ['Like', 'comment_id', 'Comment', 'id'],
        ['Favorite', 'user_id', 'User', 'id'],
        ['Favorite', 'work_id', 'Work', 'id'],
        ['Favorite', 'post_id', 'Post', 'id'],
        ['Follow', 'follower_id', 'User', 'id'],
        ['Follow', 'following_id', 'User', 'id'],
        ['Notification', 'user_id', 'User', 'id'],
        ['Report', 'reporter_id', 'User', 'id']
    ];
    const orphanFks = [];
    for (const [modelName, field, refModelName, refField] of fkSpecs) {
        const model = models[modelName];
        const refModel = models[refModelName];
        if (!model || !refModel) continue;
        try {
            const cnt = await countOrphanRows(ctx, model, field, refModel, refField);
            orphanFks.push({ table: model.getTableName(), field, ref_table: refModel.getTableName(), orphan_rows: cnt });
        } catch (e) {
            orphanFks.push({ table: model.getTableName(), field, ref_table: refModel.getTableName(), orphan_rows: 'error', error: e.message });
        }
    }
    result.checks.orphan_fks = orphanFks;

    const orphanTotal = orphanFks.reduce((a, r) => a + (Number(r.orphan_rows) || 0), 0);
    result.summary = { orphan_fk_rows: orphanTotal, healthy: orphanTotal === 0 };

    if (!args.json) {
        console.log(color(args, 'cyan', '\n═══ DB Health ═══'));
        console.log(`Dialect: ${dialect}  @  ${result.timestamp}`);
        console.log('');
        if (result.checks.file) {
            const f = result.checks.file;
            if (f.error) {
                console.log(color(args, 'red', `File info error: ${f.error}`));
            } else {
                console.log(color(args, 'bold', 'File:'));
                printTable(args, ['path', 'size', 'wal', 'shm'], [{
                    path: f.path,
                    size: f.size_human,
                    wal: f.wal ? f.wal.size_human : '—',
                    shm: f.shm ? f.shm.size_human : '—'
                }]);
            }
        }
        if (result.checks.pragma) {
            const p = result.checks.pragma;
            if (!p.error) {
                console.log(color(args, 'bold', '\nPRAGMA:'));
                printTable(args, ['journal_mode', 'foreign_keys'], [{ journal_mode: p.journal_mode, foreign_keys: p.foreign_keys }]);
            }
        }
        if (result.checks.pool) {
            console.log(color(args, 'bold', '\nConnection pool:'));
            if (result.checks.pool.error) {
                console.log(color(args, 'dim', `  (unavailable: ${result.checks.pool.error})`));
            } else {
                printTable(args, ['size', 'available', 'pending', 'min', 'max'], [result.checks.pool]);
            }
        }
        console.log(color(args, 'bold', '\nTable row counts:'));
        printTable(args, ['table', 'rows'], tableCounts);
        console.log(color(args, 'bold', '\nOrphan FK references:'));
        const orphanRows = orphanFks.filter((r) => Number(r.orphan_rows) > 0);
        if (orphanRows.length) {
            printTable(args, ['table', 'field', 'ref_table', 'orphan_rows'], orphanRows);
        } else {
            console.log(color(args, 'green', '  ✓ No orphan FK rows.'));
        }
        console.log('');
        if (result.summary.healthy) {
            console.log(color(args, 'green', '✓ DB looks healthy (no orphan FK rows).'));
        } else {
            console.log(color(args, 'yellow', `⚠ ${result.summary.orphan_fk_rows} orphan FK row(s) across tables.`));
        }
    }
    emitResult(args, result);
    return result;
}

// ----------------------------------------------------------------------------
// Help / list-commands
// ----------------------------------------------------------------------------

const COMMANDS = [
    { name: 'help', desc: 'Show this help screen' },
    { name: 'list-commands', desc: 'Print the available subcommands (one per line)' },
    { name: 'consistency-check', desc: 'Scan DB for drifted counters, dangling refs, soft-delete orphans' },
    { name: 'repair-counts', desc: 'Recompute & fix drifted counters (--dry-run to preview)' },
    { name: 'security-audit', desc: 'Scan for weak password hashes, XSS-y nickname/bio, invalid ENUMs' },
    { name: 'db-health', desc: 'DB file/WAL size, pool stats, table row counts, orphan FKs' }
];

function printHelp(args) {
    const out = args && args.json ? console.error : console.log;
    out(color(args, 'cyan', '\nCodeDog Terminal Toolbox'));
    out('');
    out('Usage: node scripts/toolbox.js <command> [options]');
    out('');
    out(color(args, 'bold', 'Commands:'));
    for (const c of COMMANDS) {
        out(`  ${pad(c.name, 20)}  ${c.desc}`);
    }
    out('');
    out(color(args, 'bold', 'Options:'));
    out('  --json              Emit machine-readable JSON to stdout (human messages -> stderr)');
    out('  --dry-run           For repair commands: preview without writing');
    out('  -h, --help          Show this help');
    out('');
    out(color(args, 'bold', 'Examples:'));
    out('  node scripts/toolbox.js consistency-check');
    out('  node scripts/toolbox.js consistency-check --json');
    out('  node scripts/toolbox.js repair-counts --dry-run');
    out('  node scripts/toolbox.js repair-counts            # actually writes');
    out('  node scripts/toolbox.js db-health');
    out('  node scripts/toolbox.js security-audit');
    out('');
    out(color(args, 'dim', 'NOTE: scripts/check-consistency.js runs static source-code consistency checks'));
    out(color(args, 'dim', '      (run via `npm run check:consistency` from server/). This toolbox covers DATA-level checks.'));
    out('');
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const cmd = args.command;

    if (!cmd || cmd === 'help' || args.flags.help) {
        printHelp(args);
        return;
    }

    if (cmd === 'list-commands') {
        if (args.json) {
            process.stdout.write(JSON.stringify({
                commands: COMMANDS.map((c) => ({ name: c.name, description: c.desc }))
            }, null, 2) + '\n');
        } else {
            for (const c of COMMANDS) {
                console.log(`${pad(c.name, 20)}  ${c.desc}`);
            }
        }
        return;
    }

    // Reject unknown commands BEFORE loading models (so a typo doesn't bootstrap the DB).
    const knownDbCommands = new Set(['consistency-check', 'repair-counts', 'security-audit', 'db-health']);
    if (!knownDbCommands.has(cmd)) {
        console.error(color(args, 'red', `Unknown command: ${cmd}`));
        printHelp(args);
        process.exitCode = 2;
        return;
    }

    let ctx = null;
    try {
        ctx = await loadModels(args);
        switch (cmd) {
            case 'consistency-check': await runConsistencyCheck(ctx, args); break;
            case 'repair-counts': await runRepairCounts(ctx, args); break;
            case 'security-audit': await runSecurityAudit(ctx, args); break;
            case 'db-health': await runDbHealth(ctx, args); break;
        }
    } catch (err) {
        console.error(color(args, 'red', `✗ Command "${cmd}" failed: ${err.message}`));
        if (process.env.DEBUG) console.error(err.stack);
        process.exitCode = 1;
    } finally {
        await closeModels(ctx);
    }
}

main().catch((err) => {
    console.error('Toolbox crashed:', err);
    process.exit(1);
});
