const test = require('node:test');
const assert = require('node:assert/strict');

test('IM server modules load', () => {
  const api = require('../src/app');
  assert.equal(typeof api.start, 'function');
  assert.ok(api.app);
});

test('SSO user profiles are stored and refreshed', async () => {
  const { UserProfile } = require('../src/database');
  await UserProfile.upsert({ id: 81, username: 'codedog_81', nickname: '编程狗用户', avatar: 'https://example.test/avatar.png', codemao_user_id: '970000081', role: 'user' });
  await UserProfile.upsert({ id: 81, username: 'codedog_81', nickname: '新昵称', avatar: 'https://example.test/new.png', codemao_user_id: '970000081', role: 'user' });
  const user = await UserProfile.findByPk(81);
  assert.equal(user.nickname, '新昵称');
  assert.equal(user.avatar, 'https://example.test/new.png');
  assert.equal(user.codemao_user_id, '970000081');
});
