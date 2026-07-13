/**
 * Full OAuth developer-platform smoke test.
 * Prerequisites:
 *   1) server running: cd server && npm start
 *   2) optional env SMOKE_TOKEN=jwt for real auth path
 *
 * Usage:
 *   node scripts/smoke-developer-http.js
 *
 * Without SMOKE_TOKEN, script validates public endpoints only and prints remaining steps.
 */
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3001';
const token = process.env.SMOKE_TOKEN || '';

async function req(method, path, { body, headers } = {}) {
  const res = await fetch(BASE + path, {
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

  // open API without token should 401
  const meNo = await req('GET', '/api/open/v1/me');
  if (!pass('open /me without token -> 401', meNo.status === 401, JSON.stringify(meNo.data))) failed++;

  // token endpoint missing creds
  const tokBad = await req('POST', '/api/oauth/token', { body: { grant_type: 'authorization_code' } });
  if (!pass('token missing client -> 401', tokBad.status === 401, JSON.stringify(tokBad.data))) failed++;

  if (!token) {
    console.log('\nNo SMOKE_TOKEN set. Authenticated flow skipped.');
    console.log('To run full flow:');
    console.log('  1) Login in browser, copy JWT from sessionStorage.token or cookie cd_token');
    console.log('  2) $env:SMOKE_TOKEN=\"...\"');
    console.log('  3) node scripts/smoke-developer-http.js');
    process.exit(failed ? 1 : 0);
  }

  // create app
  const create = await req('POST', '/api/developer/apps', {
    body: {
      name: 'Smoke App ' + Date.now(),
      description: 'smoke',
      redirect_uris: ['http://localhost:9999/callback'],
      scopes: ['profile:read', 'works:read']
    }
  });
  if (!pass('create app', create.status === 200 && create.data?.data?.client_id, JSON.stringify(create.data))) failed++;
  const app = create.data?.data || {};
  const appId = app.id;
  const clientId = app.client_id;
  const clientSecret = app.client_secret;
  if (!pass('secret shown once', !!clientSecret)) failed++;
  if (!pass('pending status', app.status === 'pending', app.status)) failed++;

  // pending app token should fail after fake code - authorize info should fail for pending
  const infoPending = await req('GET', `/api/oauth/authorize-info?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent('http://localhost:9999/callback')}&scope=profile:read`);
  if (!pass('authorize-info pending rejected', infoPending.status >= 400, JSON.stringify(infoPending.data))) failed++;

  // admin review (requires admin token)
  const review = await req('POST', `/api/admin/developer-apps/${appId}/review`, {
    body: { action: 'approve', note: 'smoke approve' }
  });
  if (!pass('admin approve', review.status === 200, JSON.stringify(review.data))) {
    failed++;
    console.log('NOTE: if fail due to permission, use admin/superadmin JWT');
  }

  const info = await req('GET', `/api/oauth/authorize-info?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent('http://localhost:9999/callback')}&scope=profile:read%20works:read&state=s1`);
  if (!pass('authorize-info active', info.status === 200, JSON.stringify(info.data))) failed++;

  const approve = await req('POST', '/api/oauth/authorize', {
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
  const code = new URL(redirectTo).searchParams.get('code');
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
  if (!pass('exchange token', tokenRes.status === 200 && tokenRes.data?.data?.access_token, JSON.stringify(tokenRes.data))) failed++;
  const access = tokenRes.data?.data?.access_token;
  const refresh = tokenRes.data?.data?.refresh_token;

  // reuse code should fail
  const tokenReuse = await req('POST', '/api/oauth/token', {
    body: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:9999/callback',
      client_id: clientId,
      client_secret: clientSecret
    }
  });
  if (!pass('code one-time', tokenReuse.status >= 400, JSON.stringify(tokenReuse.data))) failed++;

  const me = await fetch(BASE + '/api/open/v1/me', {
    headers: { Authorization: 'Bearer ' + access }
  }).then(async r => ({ status: r.status, data: await r.json() }));
  if (!pass('open /me', me.status === 200 && me.data?.data?.id, JSON.stringify(me.data))) failed++;

  // works scope ok
  const works = await fetch(BASE + '/api/open/v1/me/works', {
    headers: { Authorization: 'Bearer ' + access }
  }).then(async r => ({ status: r.status, data: await r.json() }));
  if (!pass('open /me/works with scope', works.status === 200, JSON.stringify(works.data))) failed++;

  // posts scope missing -> 403
  const posts = await fetch(BASE + '/api/open/v1/me/posts', {
    headers: { Authorization: 'Bearer ' + access }
  }).then(async r => ({ status: r.status, data: await r.json() }));
  if (!pass('open /me/posts without scope -> 403', posts.status === 403, JSON.stringify(posts.data))) failed++;

  // refresh
  const refreshed = await req('POST', '/api/oauth/token', {
    body: {
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: clientId,
      client_secret: clientSecret
    }
  });
  if (!pass('refresh token', refreshed.status === 200 && refreshed.data?.data?.access_token, JSON.stringify(refreshed.data))) failed++;

  console.log('\nDone. failed=', failed);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
