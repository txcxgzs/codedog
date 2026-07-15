/**
 * Full OAuth developer platform smoke against local server.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3001';

async function req(method, urlPath, { body, headers, token } = {}) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(headers || {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

function pass(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
  return !!cond;
}

(async () => {
  let failed = 0;
  const health = await req('GET', '/api/health');
  if (!pass('health', health.status === 200, JSON.stringify(health.data))) failed++;

  const meNo = await req('GET', '/api/open/v1/me');
  if (!pass('open /me no token 401', meNo.status === 401, JSON.stringify(meNo.data))) failed++;

  const { User, sequelize } = require('../models');
  const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth');
  await sequelize.authenticate();

  const username = 'smoke_dev_' + Date.now();
  const passwordHash = await bcrypt.hash('SmokeTest123!', 10);
  const user = await User.create({
    username,
    email: username + '@example.com',
    password: passwordHash,
    nickname: 'Smoke Admin',
    role: 'superadmin',
    status: 'active',
    token_version: 0
  });
  console.log('created user id=', user.id, 'username=', username);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, token_version: 0 },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN || '7d', issuer: 'codedog-community', audience: 'codedog-frontend' }
  );

  const create = await req('POST', '/api/developer/apps', {
    token,
    body: {
      name: 'Smoke App ' + Date.now(),
      description: 'smoke test app',
      redirect_uris: ['http://localhost:9999/callback'],
      scopes: ['profile:read', 'works:read']
    }
  });
  if (!pass('create app', create.status === 200 && create.data?.code === 200 && create.data?.data?.client_id, JSON.stringify(create.data))) failed++;
  const app = create.data?.data || {};
  const appId = app.id;
  const clientId = app.client_id;
  const clientSecret = app.client_secret;
  if (!pass('client_secret once', !!clientSecret)) failed++;
  if (!pass('status pending', app.status === 'pending', app.status)) failed++;

  const infoPending = await req('GET', `/api/oauth/authorize-info?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent('http://localhost:9999/callback')}&scope=profile:read`);
  if (!pass('pending authorize-info fails', infoPending.status >= 400 || infoPending.data?.code >= 400, JSON.stringify(infoPending.data))) failed++;

  const review = await req('POST', `/api/admin/developer-apps/${appId}/review`, {
    token,
    body: { action: 'approve', note: 'smoke approve' }
  });
  if (!pass('admin approve', review.status === 200 && review.data?.code === 200, JSON.stringify(review.data))) failed++;

  const info = await req('GET', `/api/oauth/authorize-info?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent('http://localhost:9999/callback')}&scope=profile:read%20works:read&state=s1`, { token });
  if (!pass('authorize-info active', info.status === 200 && info.data?.code === 200, JSON.stringify(info.data))) failed++;

  const approve = await req('POST', '/api/oauth/authorize', {
    token,
    body: {
      client_id: clientId,
      redirect_uri: 'http://localhost:9999/callback',
      scope: 'profile:read works:read',
      state: 's1',
      approved: true
    }
  });
  if (!pass('approve authorize', approve.status === 200 && approve.data?.data?.redirect_to, JSON.stringify(approve.data))) failed++;
  const redirectTo = approve.data?.data?.redirect_to || '';
  let code = '';
  try { code = new URL(redirectTo).searchParams.get('code') || ''; } catch {}
  if (!pass('got code', !!code, redirectTo)) failed++;

  const tokenRes = await req('POST', '/api/oauth/token', {
    body: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:9999/callback',
      client_id: clientId,
      client_secret: clientSecret
    }
  });
  if (!pass('token exchange', tokenRes.status === 200 && tokenRes.data?.data?.access_token, JSON.stringify(tokenRes.data))) failed++;
  const access = tokenRes.data?.data?.access_token;
  const refresh = tokenRes.data?.data?.refresh_token;

  const reuse = await req('POST', '/api/oauth/token', {
    body: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:9999/callback',
      client_id: clientId,
      client_secret: clientSecret
    }
  });
  if (!pass('code one-time', reuse.status >= 400 || (reuse.data && reuse.data.code !== 200), JSON.stringify(reuse.data))) failed++;

  const openMe = await req('GET', '/api/open/v1/me', { headers: { Authorization: 'Bearer ' + access } });
  if (!pass('open /me', openMe.status === 200 && openMe.data?.data?.id, JSON.stringify(openMe.data))) failed++;

  const works = await req('GET', '/api/open/v1/me/works', { headers: { Authorization: 'Bearer ' + access } });
  if (!pass('open /works', works.status === 200 && works.data?.code === 200, JSON.stringify(works.data).slice(0, 200))) failed++;

  const posts = await req('GET', '/api/open/v1/me/posts', { headers: { Authorization: 'Bearer ' + access } });
  if (!pass('open /posts no scope 403', posts.status === 403, JSON.stringify(posts.data))) failed++;

  const refreshed = await req('POST', '/api/oauth/token', {
    body: {
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: clientId,
      client_secret: clientSecret
    }
  });
  if (!pass('refresh token', refreshed.status === 200 && refreshed.data?.data?.access_token, JSON.stringify(refreshed.data))) failed++;

  // 缩减应用权限后，旧 access/refresh token 必须立即失效，历史授权也必须同步收缩。
  const narrowed = await req('PATCH', `/api/developer/apps/${appId}`, {
    token,
    body: {
      redirect_uris: ['http://localhost:9999/callback'],
      scopes: ['profile:read']
    }
  });
  if (!pass('narrow app scopes -> pending', narrowed.status === 200 && narrowed.data?.data?.status === 'pending', JSON.stringify(narrowed.data))) failed++;
  await req('POST', `/api/admin/developer-apps/${appId}/review`, { token, body: { action: 'approve', note: 'approve narrowed scopes' } });

  const oldAccessAfterNarrow = await req('GET', '/api/open/v1/me', { headers: { Authorization: 'Bearer ' + refreshed.data?.data?.access_token } });
  if (!pass('old access revoked after scope change', oldAccessAfterNarrow.status === 401, JSON.stringify(oldAccessAfterNarrow.data))) failed++;
  const oldRefreshAfterNarrow = await req('POST', '/api/oauth/token', {
    body: {
      grant_type: 'refresh_token',
      refresh_token: refreshed.data?.data?.refresh_token,
      client_id: clientId,
      client_secret: clientSecret
    }
  });
  if (!pass('old refresh revoked after scope change', oldRefreshAfterNarrow.status >= 400 && oldRefreshAfterNarrow.data?.code !== 200, JSON.stringify(oldRefreshAfterNarrow.data))) failed++;

  const auths = await req('GET', '/api/developer/authorizations', { token });
  if (!pass('list authorizations', auths.status === 200 && Array.isArray(auths.data?.data), JSON.stringify(auths.data))) failed++;
  const authId = auths.data?.data?.[0]?.id;
  if (!pass('authorization scopes narrowed', JSON.stringify(auths.data?.data?.[0]?.scopes || []) === JSON.stringify(['profile:read']), JSON.stringify(auths.data?.data?.[0]))) failed++;
  if (authId) {
    const codeBeforeRevoke = await req('POST', '/api/oauth/authorize', {
      token,
      body: {
        client_id: clientId,
        redirect_uri: 'http://localhost:9999/callback',
        scope: 'profile:read',
        state: 'before-revoke',
        approved: true
      }
    });
    let pendingCode = '';
    try { pendingCode = new URL(codeBeforeRevoke.data?.data?.redirect_to).searchParams.get('code') || ''; } catch {}
    const rev = await req('DELETE', `/api/developer/authorizations/${authId}`, { token });
    if (!pass('revoke authorization', rev.status === 200, JSON.stringify(rev.data))) failed++;
    const meAfter = await req('GET', '/api/open/v1/me', { headers: { Authorization: 'Bearer ' + access } });
    if (!pass('access after revoke invalid', meAfter.status === 401, JSON.stringify(meAfter.data))) failed++;
    const exchangeAfterRevoke = await req('POST', '/api/oauth/token', {
      body: {
        grant_type: 'authorization_code',
        code: pendingCode,
        redirect_uri: 'http://localhost:9999/callback',
        client_id: clientId,
        client_secret: clientSecret
      }
    });
    if (!pass('authorization code invalid after revoke', exchangeAfterRevoke.status >= 400 && exchangeAfterRevoke.data?.code !== 200, JSON.stringify(exchangeAfterRevoke.data))) failed++;
  } else {
    if (!pass('revoke authorization', false, 'no auth id')) failed++;
  }


  // ---- New scopes smoke (re-auth with new app+scopes after revoke) ----
  const create2 = await req('POST', '/api/developer/apps', {
    token,
    body: {
      name: 'Smoke App2 ' + Date.now(),
      description: 'smoke new scopes',
      redirect_uris: ['http://localhost:9999/callback'],
      scopes: [
        'profile:read','studios:read','follows:read','favorites:read',
        'notifications:read','notifications:write','works:stats:read','community:activity:read',
        'posts:write','comments:write','works:write'
      ]
    }
  });
  if (!pass('create app2', create2.status === 200 && create2.data?.data?.client_id, '')) failed++;
  const app2 = create2.data?.data || {};
  const cid2 = app2.client_id;
  const csec2 = app2.client_secret;
  await req('POST', '/api/admin/developer-apps/' + app2.id + '/review', { token, body: { action: 'approve' } });
  const approve2 = await req('POST', '/api/oauth/authorize', {
    token,
    body: {
      client_id: cid2,
      redirect_uri: 'http://localhost:9999/callback',
      scope: 'profile:read studios:read follows:read favorites:read notifications:read notifications:write works:stats:read community:activity:read posts:write comments:write works:write',
      state: 's2', approved: true
    }
  });
  let code2 = '';
  try { code2 = new URL(approve2.data?.data?.redirect_to).searchParams.get('code') || ''; } catch {}
  const token2 = await req('POST', '/api/oauth/token', {
    body: { grant_type: 'authorization_code', code: code2, redirect_uri: 'http://localhost:9999/callback', client_id: cid2, client_secret: csec2 }
  });
  const access2 = token2.data?.data?.access_token;
  if (!pass('app2 token exchange', !!access2, JSON.stringify(token2.data))) failed++;
  const studios = await req('GET', '/api/open/v1/me/studios', { headers: { Authorization: 'Bearer ' + access2 } });
  if (!pass('open /studios', studios.status === 200, JSON.stringify(studios.data).slice(0, 200))) failed++;
  const followers = await req('GET', '/api/open/v1/me/followers', { headers: { Authorization: 'Bearer ' + access2 } });
  if (!pass('open /followers', followers.status === 200, JSON.stringify(followers.data).slice(0, 200))) failed++;
  const following = await req('GET', '/api/open/v1/me/following', { headers: { Authorization: 'Bearer ' + access2 } });
  if (!pass('open /following', following.status === 200, JSON.stringify(following.data).slice(0, 200))) failed++;
  const favorites = await req('GET', '/api/open/v1/me/favorites', { headers: { Authorization: 'Bearer ' + access2 } });
  if (!pass('open /favorites', favorites.status === 200, JSON.stringify(favorites.data).slice(0, 200))) failed++;
  const likes = await req('GET', '/api/open/v1/me/likes', { headers: { Authorization: 'Bearer ' + access2 } });
  if (!pass('open /likes', likes.status === 200, JSON.stringify(likes.data).slice(0, 200))) failed++;
  const reviewNo = await req('GET', '/api/open/v1/studios/pending-review', { headers: { Authorization: 'Bearer ' + access2 } });
  if (!pass('review without scope 403', reviewNo.status === 403, JSON.stringify(reviewNo.data))) failed++;

  const sendNotification = await req('POST', '/api/open/v1/me/notifications', {
    headers: { Authorization: 'Bearer ' + access2 },
    body: { title: 'OAuth smoke notification', content: 'hello from app2' }
  });
  if (!pass('open notification write', sendNotification.status === 200, JSON.stringify(sendNotification.data))) failed++;
  const notifications = await req('GET', '/api/open/v1/me/notifications', { headers: { Authorization: 'Bearer ' + access2 } });
  if (!pass('open notifications read', notifications.status === 200 && notifications.data?.data?.list?.length >= 1, JSON.stringify(notifications.data).slice(0, 300))) failed++;

  const activity = await req('GET', '/api/open/v1/me/activity', { headers: { Authorization: 'Bearer ' + access2 } });
  if (!pass('open activity read', activity.status === 200, JSON.stringify(activity.data).slice(0, 200))) failed++;
  const workStats = await req('GET', '/api/open/v1/me/works/stats', { headers: { Authorization: 'Bearer ' + access2 } });
  if (!pass('open work stats', workStats.status === 200, JSON.stringify(workStats.data).slice(0, 200))) failed++;

  const createPost = await req('POST', '/api/open/v1/posts', {
    headers: { Authorization: 'Bearer ' + access2 },
    body: { title: 'OAuth smoke post', content: 'OAuth write scope smoke content', category: 'discussion', tags: ['oauth'] }
  });
  const openPostId = createPost.data?.data?.id;
  if (!pass('open post write', createPost.status === 200 && !!openPostId, JSON.stringify(createPost.data).slice(0, 300))) failed++;
  if (openPostId) {
    const createComment = await req('POST', '/api/open/v1/comments', {
      headers: { Authorization: 'Bearer ' + access2 },
      body: { post_id: openPostId, content: 'OAuth comment write smoke' }
    });
    const openCommentId = createComment.data?.data?.id;
    if (!pass('open comment write', createComment.status === 200 && !!openCommentId, JSON.stringify(createComment.data).slice(0, 300))) failed++;
    if (openCommentId) {
      const deleteComment = await req('DELETE', `/api/open/v1/comments/${openCommentId}`, { headers: { Authorization: 'Bearer ' + access2 } });
      if (!pass('open comment delete own', deleteComment.status === 200, JSON.stringify(deleteComment.data))) failed++;
    }
    const updatePost = await req('PATCH', `/api/open/v1/posts/${openPostId}`, {
      headers: { Authorization: 'Bearer ' + access2 },
      body: { title: 'OAuth smoke post edited', content: 'OAuth write scope edited content' }
    });
    if (!pass('open post update own', updatePost.status === 200, JSON.stringify(updatePost.data).slice(0, 200))) failed++;
    const deletePost = await req('DELETE', `/api/open/v1/posts/${openPostId}`, { headers: { Authorization: 'Bearer ' + access2 } });
    if (!pass('open post delete own', deletePost.status === 200, JSON.stringify(deletePost.data))) failed++;
  }

  const workWriteValidation = await req('POST', '/api/open/v1/works', {
    headers: { Authorization: 'Bearer ' + access2 }, body: {}
  });
  if (!pass('open work write scope reaches validation', workWriteValidation.status === 400, JSON.stringify(workWriteValidation.data))) failed++;
  const studioMembersValidation = await req('GET', '/api/open/v1/me/studios/999999/members', { headers: { Authorization: 'Bearer ' + access2 } });
  if (!pass('studio members scope required', studioMembersValidation.status === 403, JSON.stringify(studioMembersValidation.data))) failed++;
  try { await user.destroy(); } catch {}
  try { await user.destroy(); } catch {}
  console.log('\nDONE failed=', failed);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('SMOKE ERROR', e);
  process.exit(1);
});
