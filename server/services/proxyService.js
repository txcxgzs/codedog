const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { SystemConfig } = require('../models');

class ProxyService {
    constructor() {
        this.currentProxy = null;
        this.enabled = false;
        this.poolUrl = null;
        this._cache = [];
        this._cacheTime = 0;
        this._cacheTTL = 5 * 60 * 1000;
        this._deadProxies = new Set();
        this._failCount = 0;
        this._maxFailBeforeSwitch = 3;
        this._refreshTimer = null;
        this._refreshInterval = 5 * 60 * 1000;
        this._autoRefreshEnabled = false;
    }

    startAutoRefresh(intervalMs) {
        this.stopAutoRefresh();
        if (!this.poolUrl || !this.enabled) return;
        this._autoRefreshEnabled = true;
        this._refreshInterval = intervalMs || (5 * 60 * 1000);
        this._refreshTimer = setInterval(async () => {
            try {
                console.log(`[代理] 定时刷新(每${Math.round(this._refreshInterval / 60000)}分钟)...`);
                const fresh = await this.fetchFromPool();
                let found = false;
                for (const proxy of fresh) {
                    if (this._deadProxies.has(proxy.url)) continue;
                    const result = await this.testProxy(proxy.url);
                    if (result.ok) {
                        await this.saveCurrentProxy(proxy);
                        console.log(`[代理] 定时刷新获取新代理: ${proxy.host}:${proxy.port}`);
                        found = true;
                        break;
                    } else {
                        this._deadProxies.add(proxy.url);
                    }
                }
                if (!found) {
                    console.warn('[代理] 定时刷新: 代理池全部不可用');
                    this._deadProxies.clear();
                }
            } catch (e) {
                console.warn('[代理] 定时刷新失败:', e.message);
            }
        }, this._refreshInterval);
        console.log(`[代理] 自动刷新已启动, 间隔${Math.round(this._refreshInterval / 60000)}分钟`);
    }

    stopAutoRefresh() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
        this._autoRefreshEnabled = false;
    }

    async loadConfig() {
        try {
            const keys = ['proxy_enabled', 'proxy_pool_url', 'proxy_current', 'proxy_protocol', 'proxy_auto_refresh'];
            const configs = {};
            await Promise.all(keys.map(async (k) => {
                const cfg = await SystemConfig.findOne({ where: { config_key: k } });
                configs[k] = cfg ? cfg.config_value : null;
            }));
            this.enabled = configs.proxy_enabled === 'true';
            this.poolUrl = configs.proxy_pool_url || null;
            this.currentProxy = configs.proxy_current ? JSON.parse(configs.proxy_current) : null;
            this._defaultProtocol = configs.proxy_protocol || null;
            const ar = parseInt(configs.autoRefresh, 10);
            if (this.enabled && this.poolUrl && ar > 0) {
                this.startAutoRefresh(ar * 60 * 1000);
            }
        } catch (e) {
            console.warn('[Proxy] 配置加载失败:', e.message);
        }
    }

    async setEnabled(enabled) {
        this.enabled = enabled;
        await SystemConfig.upsert({ config_key: 'proxy_enabled', config_value: String(enabled) });

        if (enabled && this.poolUrl) {
            const arCfg = await SystemConfig.findOne({ where: { config_key: 'proxy_auto_refresh' } });
            const ar = arCfg ? parseInt(arCfg.config_value, 10) : 0;
            if (ar > 0) this.startAutoRefresh(ar * 60 * 1000);
        } else {
            this.stopAutoRefresh();
        }
    }

    async setPoolUrl(url) {
        this.poolUrl = url || null;
        if (url) {
            await SystemConfig.upsert({ config_key: 'proxy_pool_url', config_value: url });
        } else {
            await SystemConfig.destroy({ where: { config_key: 'proxy_pool_url' } });
        }
    }

    async saveCurrentProxy(proxy) {
        this.currentProxy = proxy;
        await SystemConfig.upsert({ config_key: 'proxy_current', config_value: JSON.stringify(proxy) });
    }

    _parseProxyString(str, defaultProtocol) {
        if (!str) return null;
        str = str.trim();
        if (!str) return null;

        let url = str;
        if (!str.startsWith('http://') && !str.startsWith('https://') && !str.startsWith('socks')) {
            const proto = defaultProtocol || 'http';
            url = proto + '://' + str;
        }

        try {
            const u = new URL(url);
            return {
                url,
                host: u.hostname,
                port: parseInt(u.port, 10) || (u.protocol === 'https:' ? 443 : 80),
                protocol: u.protocol.replace(':', ''),
                auth: u.username ? { username: u.username, password: u.password } : null
            };
        } catch {
            return null;
        }
    }

    _getAgent(proxyUrl) {
        if (!proxyUrl) return null;
        try {
            if (proxyUrl.startsWith('socks')) {
                return new SocksProxyAgent(proxyUrl);
            }
            return new HttpsProxyAgent(proxyUrl);
        } catch {
            return null;
        }
    }

    async fetchFromPool() {
        if (!this.poolUrl) throw new Error('未配置代理池地址');

        const now = Date.now();
        if (this._cache.length > 0 && (now - this._cacheTime) < this._cacheTTL) {
            return this._cache;
        }

        const res = await axios.get(this.poolUrl, { timeout: 15000, responseType: 'text' });
        let data = res.data;

        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch {
                // JSON解析失败,按行分割解析纯文本格式(每行一个代理)
                data = data.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
            }
        }

        let proxies = [];
        if (Array.isArray(data)) {
            proxies = data;
        } else if (data.data && Array.isArray(data.data)) {
            proxies = data.data;
        } else if (data.proxies && Array.isArray(data.proxies)) {
            proxies = data.proxies;
        }

        const parsed = [];
        for (const p of proxies) {
            let str = typeof p === 'string' ? p : (p.proxy || p.url || (p.ip && p.port ? p.ip + ':' + p.port : null));
            if (!str) continue;
            const info = this._parseProxyString(str, this._defaultProtocol);
            if (info) parsed.push(info);
        }

        if (parsed.length > 0) {
            this._cache = parsed;
            this._cacheTime = now;
        }

        return parsed;
    }

    pickOne() {
        const alive = this._cache.filter(p => !this._deadProxies.has(p.url));
        if (alive.length > 0) {
            const idx = Math.floor(Math.random() * alive.length);
            return alive[idx];
        }
        if (this.currentProxy && !this._deadProxies.has(this.currentProxy.url)) return this.currentProxy;
        return null;
    }

    async markDead(proxyUrl) {
        if (!proxyUrl) return;
        this._deadProxies.add(proxyUrl);
        this._failCount++;
        console.warn(`[代理] 标记死亡: ${proxyUrl}, 死亡数: ${this._deadProxies.size}`);
        if (this.currentProxy && this.currentProxy.url === proxyUrl) {
            const next = this.pickOne();
            if (next) {
                await this.saveCurrentProxy(next);
                console.log(`[代理] 自动切换至: ${next.url}`);
            } else {
                this.currentProxy = null;
                await this.saveCurrentProxy(null);
                console.warn('[代理] 代理池全部死亡, 已清空当前代理');
            }
        }
    }

    getAxiosConfigWithRetry(config = {}, maxRetries = 2) {
        const self = this;
        return {
            ...self.getAxiosConfig(config),
            __proxyRetry: true,
            __maxRetries: maxRetries,
            __proxyService: self
        };
    }

    async testProxy(proxyUrl) {
        const agent = this._getAgent(proxyUrl);
        const start = Date.now();
        try {
            const res = await axios.get('https://api.codemao.cn/tiger/v3/web/accounts/login', {
                timeout: 10000,
                httpsAgent: agent,
                proxy: false,
                validateStatus: () => true
            });
            const latency = Date.now() - start;
            return { ok: true, latency, status: res.status };
        } catch (e) {
            return { ok: false, latency: Date.now() - start, error: e.message };
        }
    }

    async testCurrentProxy() {
        const proxy = this.pickOne();
        if (!proxy) throw new Error('无可用代理');
        return { proxy: proxy.url, ...(await this.testProxy(proxy.url)) };
    }

    getAxiosConfig(config = {}) {
        if (!this.enabled) return config;
        const proxy = this.pickOne();
        if (!proxy) return config;
        const agent = this._getAgent(proxy.url);
        if (!agent) return config;
        return { ...config, httpsAgent: agent, proxy: false };
    }

    async refreshFromPool() {
        const proxies = await this.fetchFromPool();
        if (proxies.length === 0) throw new Error('代理池返回为空');

        for (const proxy of proxies.slice(0, 5)) {
            const result = await this.testProxy(proxy.url);
            if (result.ok) {
                await this.saveCurrentProxy(proxy);
                return { ...proxy, ...result };
            }
        }
        throw new Error('代理池中无可用代理');
    }
}

module.exports = new ProxyService();