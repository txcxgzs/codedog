const crypto = require('crypto');
const WebSocket = require('ws');
const { createImTicket } = require('../../server/services/imSso');

const base = process.env.IM_SMOKE_URL || 'http://127.0.0.1:3100';
let failed = 0;
function pass(name, condition, detail = '') { console.log(`${condition ? 'PASS' : 'FAIL'} - ${name}${detail ? `: ${detail}` : ''}`); if (!condition) failed++; }
function ticket(id, role = 'admin') {
  return createImTicket({ id, username: `smoke_${id}`, nickname: `测试用户${id}`, avatar: '', role, token_version: 0 });
}
async function request(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json(); return { response, body, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
async function main() {
  const health = await request('/health'); pass('health', health.response.status === 200 && health.body.data?.database === 'up');
  const ssoTicket = ticket(900001);
  const exchange = await request('/api/auth/sso/exchange', { method: 'POST', body: JSON.stringify({ ticket: ssoTicket }) });
  pass('SSO exchange', exchange.response.status === 200 && exchange.cookie.startsWith('im_session='));
  const replay = await request('/api/auth/sso/exchange', { method: 'POST', body: JSON.stringify({ ticket: ssoTicket }) });
  pass('SSO replay rejected', replay.response.status === 409);
  const cookie = exchange.cookie;
  const me = await request('/api/me', { headers: { Cookie: cookie } }); pass('session profile', me.body.data?.id === 900001);
  const badImageForm = new FormData(); badImageForm.append('image', new Blob([Buffer.from('not-an-image')], { type: 'image/jpeg' }), 'bad.jpg');
  const badImageResponse = await fetch(`${base}/api/images`, { method: 'POST', headers: { Cookie: cookie }, body: badImageForm });
  pass('invalid image signature rejected', badImageResponse.status === 400);
  const group = await request('/api/conversations/group', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify({ name: '本地测试群' }) });
  pass('create group default 100', group.response.status === 200 && group.body.data?.member_limit === 100);
  const conversationId = group.body.data.id;
  const wsUrl = base.replace(/^http/, 'ws') + '/ws';
  const ws = new WebSocket(wsUrl, { headers: { Cookie: cookie } });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const authFrame = await new Promise(resolve => ws.once('message', raw => resolve(JSON.parse(raw))));
  pass('WebSocket authenticated', authFrame.event === 'auth.ok');
  const clientMessageId = crypto.randomUUID();
  const message = await request('/api/messages', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify({ conversation_id: conversationId, client_message_id: clientMessageId, content: '你好，CodeDog IM' }) });
  pass('send text message', message.response.status === 200 && Number(message.body.data?.sequence) === 1);
  const duplicate = await request('/api/messages', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify({ conversation_id: conversationId, client_message_id: clientMessageId, content: '重复请求' }) });
  pass('idempotent retry', String(duplicate.body.data?.id) === String(message.body.data?.id));
  const history = await request(`/api/conversations/${conversationId}/messages`, { headers: { Cookie: cookie } });
  pass('message history', history.body.data?.length === 1 && history.body.data[0].content.includes('CodeDog'));
  const audit = await request('/api/admin/messages/search', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify({ conversation_id: conversationId, reason: '本地自动化安全测试' }) });
  pass('admin chat audit', audit.response.status === 200 && audit.body.data?.length === 1);
  ws.close();
  console.log(`SUMMARY: ${failed ? 'FAILED' : 'PASSED'} (${failed} failed)`);
  process.exit(failed ? 1 : 0);
}
main().catch(error => { console.error(error); process.exit(1); });
