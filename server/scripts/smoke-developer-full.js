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

  const auths = await req('GET', '/api/developer/authorizations', { token });
  if (!pass('list authorizations', auths.status === 200 && Array.isArray(auths.data?.data), JSON.stringify(auths.data))) failed++;
  const authId = auths.data?.data?.[0]?.id;
  if (authId) {
    const rev = await req('DELETE', `/api/developer/authorizations/${authId}`, { token });
    if (!pass('revoke authorization', rev.status === 200, JSON.stringify(rev.data))) failed++;
    const meAfter = await req('GET', '/api/open/v1/me', { headers: { Authorization: 'Bearer ' + access } });
    if (!pass('access after revoke invalid', meAfter.status === 401, JSON.stringify(meAfter.data))) failed++;
  } else {
    if (!pass('revoke authorization', false, 'no auth id')) failed++;
  }


  // ---- New scopes smoke ----
  const studios = await req('GET', '/api/open/v1/me/studios', { headers: { Authorization: 'Bearer ' + access } });
  if (!pass('open /studios', studios.status === 200, JSON.stringify(studios.data).slice(0, 200))) failed++;
  const followers = await req('GET', '/api/open/v1/me/followers', { headers: { Authorization: 'Bearer ' + access } });
  if (!pass('open /followers', followers.status === 200, JSON.stringify(followers.data).slice(0, 200))) failed++;
  const following = await req('GET', '/api/open/v1/me/following', { headers: { Authorization: 'Bearer ' + access } });
  if (!pass('open /following', following.status === 200, JSON.stringify(following.data).slice(0, 200))) failed++;
  const favorites = await req('GET', '/api/open/v1/me/favorites', { headers: { Authorization: 'Bearer ' + access } });
  if (!pass('open /favorites', favorites.status === 200, JSON.stringify(favorites.data).slice(0, 200))) failed++;
  const likes = await req('GET', '/api/open/v1/me/likes', { headers: { Authorization: 'Bearer ' + access } });
  if (!pass('open /likes', likes.status === 200, JSON.stringify(likes.data).slice(0, 200))) failed++;
  const reviewNo = await req('GET', '/api/open/v1/studios/pending-review', { headers: { Authorization: 'Bearer ' + access } });
  if (!pass('review without scope 403', reviewNo.status === 403, JSON.stringify(reviewNo.data))) failed++;
  try { await user.destroy(); } catch {}
  console.log('\nDONE failed=', failed);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('SMOKE ERROR', e);
  process.exit(1);
});
