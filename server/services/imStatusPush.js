const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Op } = require('sequelize');
const { User } = require('../models');
const { createImStatusEvent, getImPublicUrl } = require('./imSso');

const queueFile = path.resolve(__dirname, '../data/im-status-push-queue.json');
let queue = new Map();
let timer = null;
let flushing = false;

function loadQueue() {
  try { queue = new Map(JSON.parse(fs.readFileSync(queueFile, 'utf8')).map(item => [String(item.user_id), item])); }
  catch { queue = new Map(); }
}

function persistQueue() {
  fs.mkdirSync(path.dirname(queueFile), { recursive: true });
  const temp = `${queueFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify([...queue.values()], null, 2));
  fs.renameSync(temp, queueFile);
}

function enqueueImStatus(user) {
  if (!user?.id) return;
  queue.set(String(user.id), {
    user_id: Number(user.id), status: user.status, role: user.role,
    token_version: Number(user.token_version || 0), attempts: 0, next_attempt_at: Date.now()
  });
  persistQueue();
  setImmediate(() => flushQueue().catch(error => console.error('[IM status flush]', error.message)));
}

async function flushQueue() {
  if (flushing || !queue.size) return;
  const publicUrl = getImPublicUrl();
  if (!publicUrl) return;
  flushing = true;
  try {
    for (const [key, item] of [...queue]) {
      if (item.next_attempt_at > Date.now()) continue;
      try {
        const token = createImStatusEvent(item);
        const response = await axios.post(`${publicUrl}/api/internal/account-status`, { token }, { timeout: 8000, maxRedirects: 0, validateStatus: () => true });
        if (response.status !== 200 || response.data?.code !== 200) throw new Error(`IM returned ${response.status}`);
        queue.delete(key);
      } catch (error) {
        item.attempts += 1;
        item.next_attempt_at = Date.now() + Math.min(15 * 60 * 1000, 5000 * (2 ** Math.min(item.attempts, 8)));
        console.error(`[IM status push] user=${item.user_id} attempt=${item.attempts}:`, error.message);
      }
    }
    persistQueue();
  } finally { flushing = false; }
}

async function scanRecentUsers() {
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const users = await User.findAll({ where: { updated_at: { [Op.gte]: since } }, attributes: ['id', 'status', 'role', 'token_version'] });
  users.forEach(enqueueImStatus);
}

function startImStatusPush() {
  if (timer) return;
  loadQueue();
  flushQueue().catch(error => console.error('[IM status flush]', error.message));
  // Restart reconciliation: disabled accounts are security-critical and must
  // be replayed even if CodeDog was offline when the status changed.
  User.findAll({ where: { status: 'disabled' }, attributes: ['id', 'status', 'role', 'token_version'] })
    .then(users => { users.forEach(enqueueImStatus); return flushQueue(); })
    .catch(error => console.error('[IM disabled-account reconciliation]', error.message));
  timer = setInterval(() => { scanRecentUsers().then(flushQueue).catch(error => console.error('[IM status scan]', error.message)); }, 60 * 1000);
  timer.unref?.();
}

module.exports = { enqueueImStatus, flushQueue, startImStatusPush };
