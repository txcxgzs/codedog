const crypto = require('crypto');
const { sequelize, User, Work, Post, Studio, StudioMember, StudioWork } = require('../server/models');

const baseUrl = (process.env.SECURITY_TEST_BASE_URL || process.argv[2] || 'http://127.0.0.1:3299').replace(/\/$/, '');
const jwtSecret = process.env.JWT_SECRET || 'development-secret-key-do-not-use-in-production';
const marker = `codex_sec_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const created = {
    studioWorkIds: [],
    studioMemberIds: [],
    studioIds: [],
    workIds: [],
    postIds: [],
    userIds: []
};
const failures = [];

function base64url(input) {
    return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(payload) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64url(JSON.stringify({
        iat: now,
        exp: now + 3600,
        ...payload
    }));
    const unsigned = `${header}.${body}`;
    const signature = base64url(crypto.createHmac('sha256', jwtSecret).update(unsigned).digest());
    return `${unsigned}.${signature}`;
}

async function http(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body = options.body;

    if (body !== undefined && typeof body !== 'string' && !(body instanceof Buffer)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${path}`, {
        method: options.method || 'GET',
        headers,
        body,
        redirect: 'manual'
    });
    const text = await response.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch (_) {
        json = null;
    }
    return { status: response.status, text, json };
}

function auth(token) {
    return { Authorization: `Bearer ${token}` };
}

function record(name, passed, detail) {
    console.log(`${passed ? 'PASS' : 'FAIL'} ${name} - ${detail}`);
    if (!passed) failures.push(`${name}: ${detail}`);
}

async function createUser(role, status = 'active') {
    const user = await User.create({
        codemao_user_id: `${marker}_${role}_${status}`,
        username: `${marker}_${role}_${status}`,
        email: `${marker}_${role}_${status}@example.test`,
        password: 'not-used',
        nickname: `${role}-${status}`,
        role,
        status
    });
    created.userIds.push(user.id);
    return user;
}

async function cleanup() {
    await StudioWork.destroy({ where: { id: created.studioWorkIds } });
    await StudioMember.destroy({ where: { id: created.studioMemberIds } });
    await Studio.destroy({ where: { id: created.studioIds } });
    await Work.destroy({ where: { id: created.workIds } });
    await Post.destroy({ where: { id: created.postIds } });
    await User.destroy({ where: { id: created.userIds } });
}

async function main() {
    await sequelize.sync({ alter: false });

    const activeUser = await createUser('user');
    const disabledUser = await createUser('user', 'disabled');
    const adminUser = await createUser('admin');
    const superadminUser = await createUser('superadmin');

    const activeTokenClaimingSuperadmin = signJwt({ id: activeUser.id, username: activeUser.username, role: 'superadmin' });
    const disabledToken = signJwt({ id: disabledUser.id, username: disabledUser.username, role: 'user' });
    const adminToken = signJwt({ id: adminUser.id, username: adminUser.username, role: 'admin' });
    const superadminToken = signJwt({ id: superadminUser.id, username: superadminUser.username, role: 'superadmin' });

    const disabledMe = await http('/api/users/me', { headers: auth(disabledToken) });
    record('disabled user token is rejected', disabledMe.status === 403, `status=${disabledMe.status}`);

    const staleRoleAdmin = await http('/api/admin/stats', { headers: auth(activeTokenClaimingSuperadmin) });
    record('JWT role claim cannot override database role', staleRoleAdmin.status === 403, `status=${staleRoleAdmin.status}`);

    const impersonateSuperadmin = await http(`/api/admin/users/${superadminUser.id}/impersonate`, {
        method: 'POST',
        headers: auth(adminToken)
    });
    record('admin cannot impersonate superadmin', impersonateSuperadmin.status === 403, `status=${impersonateSuperadmin.status}`);

    const disableSuperadmin = await http(`/api/admin/users/${superadminUser.id}/status`, {
        method: 'PUT',
        headers: auth(adminToken),
        body: { status: 'disabled' }
    });
    record('admin cannot disable superadmin', disableSuperadmin.status === 403, `status=${disableSuperadmin.status}`);

    const resetSuperadminPassword = await http(`/api/admin/users/${superadminUser.id}/password`, {
        method: 'PUT',
        headers: auth(adminToken),
        body: { newPassword: 'new-password-123' }
    });
    record('admin cannot reset superadmin password', resetSuperadminPassword.status === 403, `status=${resetSuperadminPassword.status}`);

    const pendingWork = await Work.create({
        codemao_work_id: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        name: `${marker}_pending_work`,
        user_id: activeUser.id,
        codemao_author_id: String(activeUser.id),
        codemao_author_name: activeUser.username,
        status: 'pending'
    });
    created.workIds.push(pendingWork.id);

    const publicPendingWork = await http(`/api/works/${pendingWork.codemao_work_id}`);
    record('public cannot read pending work detail', publicPendingWork.status === 404, `status=${publicPendingWork.status}`);

    const ownerPendingWork = await http(`/api/works/${pendingWork.codemao_work_id}`, { headers: auth(signJwt({ id: activeUser.id, username: activeUser.username, role: 'user' })) });
    record('owner can read own pending work detail', ownerPendingWork.status === 200, `status=${ownerPendingWork.status}`);

    const likePendingWork = await http(`/api/works/${pendingWork.codemao_work_id}/like`, {
        method: 'POST',
        headers: auth(signJwt({ id: activeUser.id, username: activeUser.username, role: 'user' }))
    });
    record('user cannot like pending work', likePendingWork.status === 404, `status=${likePendingWork.status}`);

    const favoritePendingWork = await http('/api/favorites', {
        method: 'POST',
        headers: auth(signJwt({ id: activeUser.id, username: activeUser.username, role: 'user' })),
        body: { workId: pendingWork.id }
    });
    record('user cannot favorite pending work', favoritePendingWork.status === 404, `status=${favoritePendingWork.status}`);

    const commentPendingWork = await http('/api/comments', {
        method: 'POST',
        headers: auth(signJwt({ id: activeUser.id, username: activeUser.username, role: 'user' })),
        body: { content: 'blocked', work_id: pendingWork.id }
    });
    record('user cannot comment on pending work', commentPendingWork.status === 404, `status=${commentPendingWork.status}`);

    const reportPendingWork = await http('/api/reports', {
        method: 'POST',
        headers: auth(signJwt({ id: activeUser.id, username: activeUser.username, role: 'user' })),
        body: { type: 'work', target_id: pendingWork.id, reason: 'blocked' }
    });
    record('user cannot report hidden work by id oracle', reportPendingWork.status === 404, `status=${reportPendingWork.status}`);

    const missingCodemaoImport = await http(`/api/works/codemao/${Date.now()}123`);
    record('anonymous codemao import is blocked before external fetch', missingCodemaoImport.status === 401, `status=${missingCodemaoImport.status}`);

    const hiddenPost = await Post.create({
        title: `${marker}_hidden_post`,
        content: 'hidden',
        user_id: activeUser.id,
        status: 'hidden'
    });
    created.postIds.push(hiddenPost.id);

    const publicHiddenPost = await http(`/api/posts/${hiddenPost.id}`);
    record('public cannot read hidden post detail', publicHiddenPost.status === 404, `status=${publicHiddenPost.status}`);

    const likeHiddenPost = await http(`/api/posts/${hiddenPost.id}/like`, {
        method: 'POST',
        headers: auth(signJwt({ id: activeUser.id, username: activeUser.username, role: 'user' }))
    });
    record('user cannot like hidden post', likeHiddenPost.status === 404, `status=${likeHiddenPost.status}`);

    const commentHiddenPost = await http('/api/comments', {
        method: 'POST',
        headers: auth(signJwt({ id: activeUser.id, username: activeUser.username, role: 'user' })),
        body: { content: 'blocked', post_id: hiddenPost.id }
    });
    record('user cannot comment on hidden post', commentHiddenPost.status === 404, `status=${commentHiddenPost.status}`);

    const reportHiddenPost = await http('/api/reports', {
        method: 'POST',
        headers: auth(signJwt({ id: activeUser.id, username: activeUser.username, role: 'user' })),
        body: { type: 'post', target_id: hiddenPost.id, reason: 'blocked' }
    });
    record('user cannot report hidden post by id oracle', reportHiddenPost.status === 404, `status=${reportHiddenPost.status}`);

    const studio = await Studio.create({
        name: `${marker}_studio`,
        owner_id: activeUser.id,
        is_public: true,
        status: 'active'
    });
    created.studioIds.push(studio.id);

    const studioMember = await StudioMember.create({
        studio_id: studio.id,
        user_id: activeUser.id,
        role: 'owner',
        status: 'active'
    });
    created.studioMemberIds.push(studioMember.id);

    const privateStudio = await Studio.create({
        name: `${marker}_private_studio`,
        owner_id: activeUser.id,
        is_public: false,
        status: 'active'
    });
    created.studioIds.push(privateStudio.id);

    const publicPrivateStudioDetail = await http(`/api/studios/${privateStudio.id}`);
    record('public cannot read private studio detail', publicPrivateStudioDetail.status === 404, `status=${publicPrivateStudioDetail.status}`);

    const ownerPrivateStudioDetail = await http(`/api/studios/${privateStudio.id}`, {
        headers: auth(signJwt({ id: activeUser.id, username: activeUser.username, role: 'user' }))
    });
    record('owner can read private studio detail', ownerPrivateStudioDetail.status === 200, `status=${ownerPrivateStudioDetail.status}`);

    const publicPrivateStudioWorks = await http(`/api/studios/${privateStudio.id}/works`);
    record('public cannot read private studio works', publicPrivateStudioWorks.status === 404, `status=${publicPrivateStudioWorks.status}`);

    const publicStudioList = await http(`/api/studios?keyword=${encodeURIComponent(marker)}`);
    record(
        'public studio list hides private studios',
        publicStudioList.status === 200 && !publicStudioList.text.includes(`${marker}_private_studio`),
        `status=${publicStudioList.status}; containsPrivate=${publicStudioList.text.includes(`${marker}_private_studio`)}`
    );

    const joinPrivateStudio = await http(`/api/studios/${privateStudio.id}/join`, {
        method: 'POST',
        headers: auth(adminToken)
    });
    record('user cannot join private studio by id', joinPrivateStudio.status === 404, `status=${joinPrivateStudio.status}`);

    const submitPendingWork = await http(`/api/studios/${studio.id}/works`, {
        method: 'POST',
        headers: auth(signJwt({ id: activeUser.id, username: activeUser.username, role: 'user' })),
        body: { workId: pendingWork.id }
    });
    record('user cannot submit pending work to studio', submitPendingWork.status === 404, `status=${submitPendingWork.status}`);

    const studioWork = await StudioWork.create({
        studio_id: studio.id,
        work_id: pendingWork.id,
        user_id: activeUser.id,
        status: 'pending'
    });
    created.studioWorkIds.push(studioWork.id);

    const approvedHiddenStudioWork = await StudioWork.create({
        studio_id: studio.id,
        work_id: pendingWork.id,
        user_id: activeUser.id,
        status: 'approved'
    });
    created.studioWorkIds.push(approvedHiddenStudioWork.id);

    const publicStudioWorks = await http(`/api/studios/${studio.id}/works?status=pending`);
    record(
        'public studio work list ignores status override and hidden works',
        publicStudioWorks.status === 200 && !publicStudioWorks.text.includes(`${marker}_pending_work`),
        `status=${publicStudioWorks.status}; containsPending=${publicStudioWorks.text.includes(`${marker}_pending_work`)}`
    );

    const badSqlitePath = await http('/api/admin/db-migration/test-connection', {
        method: 'POST',
        headers: auth(superadminToken),
        body: { dbType: 'sqlite', config: { path: '../app.js' } }
    });
    record('db migration rejects sqlite path escape with valid superadmin', badSqlitePath.status !== 200, `status=${badSqlitePath.status}`);

    if (failures.length > 0) {
        console.error('\nTargeted security test failures:');
        for (const failure of failures) {
            console.error(`- ${failure}`);
        }
        process.exitCode = 1;
    } else {
        console.log(`\nTargeted security tests passed against ${baseUrl}.`);
    }
}

main()
    .catch((error) => {
        console.error('Targeted security test crashed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await cleanup();
        } finally {
            await sequelize.close();
        }
    });
