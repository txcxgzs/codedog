const { sequelize, User } = require('../models');
const { QueryTypes, Op } = require('sequelize');

const CACHE_TTL_MS = 60 * 1000;
let cache = null;
let cacheExpiresAt = 0;
let pendingBuild = null;

function buildBadges(stats) {
    const badges = [];
    if (stats.topics_count >= 1) badges.push({ key: 'author', name: '论坛作者', icon: '✍', color: '#5b8def' });
    if (stats.replies_count >= 10) badges.push({ key: 'helper', name: '热心互助', icon: '❤', color: '#ef6a5b' });
    if (stats.accepted_answers >= 5) badges.push({ key: 'solver', name: '问题终结者', icon: '✓', color: '#37a56b' });
    if (stats.likes_received >= 20) badges.push({ key: 'quality', name: '优质创作者', icon: '★', color: '#e49b18' });
    if (stats.contribution_score >= 500) badges.push({ key: 'mentor', name: '社区导师', icon: '冠', color: '#8b6ee8' });
    return badges;
}

function titleFor(score) {
    if (score >= 500) return '社区导师';
    if (score >= 200) return '资深创作者';
    if (score >= 80) return '活跃贡献者';
    if (score >= 20) return '社区新星';
    return '初来乍到';
}

function numberMap(rows, valueKey = 'count') {
    return new Map(rows.map(row => [Number(row.user_id), Number(row[valueKey] || 0)]));
}

async function buildReputationCache() {
    const [topicRows, replyRows, acceptedRows, likeRows] = await Promise.all([
        sequelize.query("SELECT user_id, COUNT(*) AS count FROM posts WHERE status = 'published' GROUP BY user_id", { type: QueryTypes.SELECT }),
        sequelize.query("SELECT user_id, COUNT(*) AS count FROM comments WHERE status = 'active' AND post_id IS NOT NULL GROUP BY user_id", { type: QueryTypes.SELECT }),
        sequelize.query("SELECT c.user_id, COUNT(*) AS count FROM posts p INNER JOIN comments c ON p.accepted_comment_id = c.id WHERE p.status = 'published' AND c.status = 'active' AND c.post_id IS NOT NULL GROUP BY c.user_id", { type: QueryTypes.SELECT }),
        sequelize.query(`SELECT owner_id AS user_id, SUM(received_count) AS count FROM (
            SELECT p.user_id AS owner_id, COUNT(l.id) AS received_count FROM likes l INNER JOIN posts p ON l.post_id = p.id WHERE p.status = 'published' GROUP BY p.user_id
            UNION ALL
            SELECT c.user_id AS owner_id, COUNT(l.id) AS received_count FROM likes l INNER JOIN comments c ON l.comment_id = c.id WHERE c.status = 'active' AND c.post_id IS NOT NULL GROUP BY c.user_id
        ) forum_likes GROUP BY owner_id`, { type: QueryTypes.SELECT })
    ]);
    const topics = numberMap(topicRows);
    const replies = numberMap(replyRows);
    const accepted = numberMap(acceptedRows);
    const likes = numberMap(likeRows);
    const userIds = [...new Set([...topics.keys(), ...replies.keys(), ...accepted.keys(), ...likes.keys()])];
    const users = userIds.length ? await User.findAll({
        where: { id: { [Op.in]: userIds }, status: 'active' },
        attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar'],
        raw: true
    }) : [];
    const entries = users.map(user => {
        const stats = {
            topics_count: topics.get(Number(user.id)) || 0,
            replies_count: replies.get(Number(user.id)) || 0,
            accepted_answers: accepted.get(Number(user.id)) || 0,
            likes_received: likes.get(Number(user.id)) || 0
        };
        stats.contribution_score = stats.topics_count * 8 + stats.replies_count * 2 + stats.accepted_answers * 20 + stats.likes_received;
        return { user, ...stats, title: titleFor(stats.contribution_score), badges: buildBadges(stats) };
    }).sort((a, b) => b.contribution_score - a.contribution_score || b.accepted_answers - a.accepted_answers || Number(a.user.id) - Number(b.user.id))
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    cache = { entries, byUserId: new Map(entries.map(entry => [Number(entry.user.id), entry])), generatedAt: new Date().toISOString() };
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return cache;
}

async function getReputationData(force = false) {
    if (!force && cache && cacheExpiresAt > Date.now()) return cache;
    if (!pendingBuild) pendingBuild = buildReputationCache().finally(() => { pendingBuild = null; });
    return pendingBuild;
}

function invalidateForumReputation() {
    cacheExpiresAt = 0;
}

async function getForumLeaderboard(limit = 10) {
    const data = await getReputationData();
    return { list: data.entries.slice(0, Math.max(1, Math.min(50, Number(limit) || 10))), generated_at: data.generatedAt };
}

async function getUserForumReputation(userId) {
    const id = Number(userId);
    const data = await getReputationData();
    const existing = data.byUserId.get(id);
    if (existing) return existing;
    const user = await User.findOne({ where: { id, status: 'active' }, attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar'], raw: true });
    if (!user) return null;
    const empty = { topics_count: 0, replies_count: 0, accepted_answers: 0, likes_received: 0, contribution_score: 0 };
    return { user, ...empty, title: titleFor(0), badges: [] };
}

module.exports = { getForumLeaderboard, getUserForumReputation, invalidateForumReputation, buildBadges, titleFor };
