const test = require('node:test');
const assert = require('node:assert/strict');

test('IM server modules load', () => {
  const api = require('../src/app');
  assert.equal(typeof api.start, 'function');
  assert.ok(api.app);
});
