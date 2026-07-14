const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Module = require('module');

const results = [];
function ok(name, cond, detail='') {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ': ' + detail : ''}`);
}

const serverRoot = __dirname ? path.resolve(__dirname, '..') : process.cwd();
// When compiled via Module from scripts/, __dirname is scripts

for (const f of [
  'routes/developerRoutes.js',
  'routes/oauthRoutes.js',
  'routes/openRoutes.js',
  'utils/oauth.js',
  'middleware/oauthAuth.js',
  'controllers/developerController.js'
]) {
  ok('exists ' + f, fs.existsSync(path.join(serverRoot, f)));
}

let oauth;
try {
  const filename = path.join(serverRoot, 'utils/oauth.js');
  const m = new Module(filename);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  m._compile(fs.readFileSync(filename, 'utf8'), filename);
  oauth = m.exports;
  ok('load oauth utils', !!oauth && typeof oauth.randomToken === 'function');
} catch (e) {
  ok('load oauth utils', false, e.message);
}

if (oauth) {
  const t = oauth.randomToken('atk_', 8);
  ok('randomToken format', /^atk_[a-f0-9]{16}$/.test(t), t);
  const h1 = oauth.hashToken('abc');
  const h2 = oauth.hashToken('abc');
  ok('hashToken stable', h1 === h2 && h1.length === 64);
  ok('normalizeScopes filters', JSON.stringify(oauth.normalizeScopes(['profile:read','x','works:read'])) === JSON.stringify(['profile:read','works:read']));
  ok('intersectScopes', JSON.stringify(oauth.intersectScopes(['profile:read','works:read'], ['profile:read'])) === JSON.stringify(['profile:read']));
  ok('matchRedirectUri exact', oauth.matchRedirectUri(JSON.stringify(['http://localhost:9999/cb']), 'http://localhost:9999/cb'));
  ok('matchRedirectUri reject mismatch', !oauth.matchRedirectUri(JSON.stringify(['http://localhost:9999/cb']), 'http://localhost:9999/cb2'));
  const uris = oauth.normalizeRedirectUris(['http://localhost:9999/cb', 'https://example.com/cb']);
  ok('normalizeRedirectUris ok', uris.ok && uris.list.length === 2, JSON.stringify(uris));
  const scopes = oauth.scopeCatalog();
  ok('scopeCatalog matches ALL_SCOPES', Array.isArray(scopes) && scopes.length === Object.keys(oauth.ALL_SCOPES).length);
}

const appJs = fs.readFileSync(path.join(serverRoot, 'app.js'), 'utf8');
ok('app mounts developer', appJs.includes("app.use('/api/developer'"));
ok('app mounts oauth', appJs.includes("app.use('/api/oauth'"));
ok('app mounts open', appJs.includes("app.use('/api/open/v1'"));

const hcap = fs.readFileSync(path.join(serverRoot, 'middleware/hcaptcha.js'), 'utf8');
ok('hcaptcha excludes oauth', hcap.includes("'/api/oauth'"));
ok('hcaptcha excludes open', hcap.includes("'/api/open'"));
ok('hcaptcha excludes developer', hcap.includes("'/api/developer'"));

const adminR = fs.readFileSync(path.join(serverRoot, 'routes/adminRoutes.js'), 'utf8');
ok('admin developer-apps route', adminR.includes('/developer-apps'));

const perms = fs.readFileSync(path.join(serverRoot, 'config/permissions.js'), 'utf8');
ok('permission developer:review in admin role', perms.includes("'developer:review'"));
ok('permission catalog entry', perms.includes("key: 'developer:review'"));

const root = path.join(serverRoot, '..');
for (const f of [
  'client/src/api/developer.js',
  'client/src/views/developer/DeveloperHome.vue',
  'client/src/views/developer/DeveloperDocs.vue',
  'client/src/views/OAuthAuthorize.vue'
]) {
  ok('exists ' + f, fs.existsSync(path.join(root, f)));
}
const router = fs.readFileSync(path.join(root, 'client/src/router/index.js'), 'utf8');
ok('router /developer', router.includes("path: '/developer'"));
ok('router /oauth/authorize', router.includes("path: '/oauth/authorize'"));

const profile = fs.readFileSync(path.join(root, 'client/src/views/Profile.vue'), 'utf8');
ok('profile authorizations tab', profile.includes('name="authorizations"'));
const adminVue = fs.readFileSync(path.join(root, 'client/src/views/Admin.vue'), 'utf8');
ok('admin developer UI', adminVue.includes("activeMenu === 'developer-apps'") && adminVue.includes('fetchDeveloperApps'));
const appVue = fs.readFileSync(path.join(root, 'client/src/App.vue'), 'utf8');
ok('nav developer entry', appVue.includes('command="developer"'));

const ctrl = fs.readFileSync(path.join(serverRoot, 'controllers/developerController.js'), 'utf8');
for (const name of ['listMyApps','createApp','tokenEndpoint','approveAuthorize','openMe','adminReviewApp','revokeMyAuthorization']) {
  ok('controller exports ' + name, ctrl.includes(name));
}

const failed = results.filter(r => !r.pass);
console.log('\nSUMMARY:', results.filter(r=>r.pass).length + '/' + results.length, 'passed');
if (failed.length) {
  console.log('FAILED:');
  failed.forEach(f => console.log(' -', f.name, f.detail || ''));
  process.exitCode = 1;
}
