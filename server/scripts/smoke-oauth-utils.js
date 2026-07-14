const fs = require('fs');
const vm = require('vm');
const { URL } = require('url');
const src = fs.readFileSync('utils/oauth.js', 'utf8');
const sandbox = {
  module: { exports: {} },
  exports: {},
  require: (name) => {
    if (name === 'crypto') return require('crypto');
    if (name === 'bcryptjs') return {
      hash: async (s) => 'h:' + s,
      compare: async (s, h) => h === 'h:' + s
    };
    throw new Error('unexpected require ' + name);
  },
  console,
  process,
  Buffer,
  URL
};
sandbox.global = sandbox;
vm.runInNewContext(src, sandbox, { filename: 'oauth.js' });
const oauth = sandbox.module.exports;
const results = [];
const ok = (n, c, d = '') => {
  results.push(!!c);
  console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d ? ': ' + d : ''));
};
const t = oauth.randomToken('atk_', 8);
ok('randomToken', /^atk_[a-f0-9]{16}$/.test(t), t);
ok('hashToken', oauth.hashToken('abc') === oauth.hashToken('abc') && oauth.hashToken('abc').length === 64);
ok('normalizeScopes', JSON.stringify(oauth.normalizeScopes(['profile:read', 'x', 'works:read'])) === JSON.stringify(['profile:read', 'works:read']));
ok('intersectScopes', JSON.stringify(oauth.intersectScopes(['profile:read', 'works:read'], ['profile:read'])) === JSON.stringify(['profile:read']));
ok('matchRedirect exact', oauth.matchRedirectUri(JSON.stringify(['http://localhost:9999/cb']), 'http://localhost:9999/cb'));
ok('matchRedirect mismatch', !oauth.matchRedirectUri(JSON.stringify(['http://localhost:9999/cb']), 'http://localhost:9999/x'));
const uris = oauth.normalizeRedirectUris(['http://localhost:9999/cb', 'https://example.com/cb']);
ok('normalizeRedirectUris', uris.ok && uris.list.length === 2, JSON.stringify(uris));
const badUri = oauth.normalizeRedirectUris(['not-a-url']);
ok('normalizeRedirectUris reject bad', !badUri.ok);
ok('scopeCatalog', oauth.scopeCatalog().length === Object.keys(oauth.ALL_SCOPES).length);
const redir = oauth.buildRedirectWithParams('http://localhost:9999/cb', { code: 'c1', state: 's1' });
ok('buildRedirect', redir.includes('code=c1') && redir.includes('state=s1'), redir);
(async () => {
  const hash = await oauth.hashSecret('sk_test');
  ok('hashSecret', !!hash);
  ok('verifySecret ok', await oauth.verifySecret('sk_test', hash));
  ok('verifySecret bad', !(await oauth.verifySecret('nope', hash)));
  console.log('SUMMARY', results.filter(Boolean).length + '/' + results.length);
  if (results.some((x) => !x)) process.exitCode = 1;
})();
