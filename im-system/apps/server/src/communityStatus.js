const crypto = require('crypto');
const axios = require('axios');
const config = require('./config');

const cache = new Map();
const CACHE_MS = 60 * 1000;

async function verifyCommunityStatus(user, force = false) {
  if (!user?.status_token || !user?.community_status_url) throw Object.assign(new Error('请重新从编程狗进入即时通讯'), { statusCode: 401 });
  const key = crypto.createHash('sha256').update(user.status_token).digest('hex');
  const cached = cache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.data;
  const publicUrl = new URL(user.community_status_url);
  const urls = [`${config.communityInternalUrl}${publicUrl.pathname}`, user.community_status_url];
  let lastError;
  for (const url of [...new Set(urls)]) {
    try {
      const response = await axios.post(url, {}, {
        timeout: 5000,
        maxRedirects: 0,
        headers: { Authorization: `Bearer ${user.status_token}`, 'User-Agent': 'CodeDog-IM-Status/1.0', Host: publicUrl.host },
        validateStatus: () => true
      });
      if (response.status !== 200 || response.data?.code !== 200 || !response.data?.data?.active) throw new Error(response.data?.msg || `账号状态接口返回 ${response.status}`);
      cache.set(key, { expiresAt: Date.now() + CACHE_MS, data: response.data.data });
      return response.data.data;
    } catch (error) { lastError = error; }
  }
  cache.delete(key);
  console.error('[community-status] all endpoints failed:', lastError?.message);
  throw Object.assign(new Error(lastError?.response?.data?.msg || lastError?.message || '无法确认编程狗账号状态'), { statusCode: 401 });
}

module.exports = { verifyCommunityStatus };
