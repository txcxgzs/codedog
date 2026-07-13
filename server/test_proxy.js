const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

async function test() {
    console.log('[1] 抓取代理池...');
    const res = await axios.get('https://proxy.scdn.io/api/get_proxy.php?protocol=socks5&count=3', { timeout: 15000, responseType: 'text' });
    const data = JSON.parse(res.data);
    const proxies = data.data.proxies;
    console.log('    获取到 ' + proxies.length + ' 个代理:', proxies);

    for (const p of proxies) {
        const url = 'socks5://' + p;
        const agent = new SocksProxyAgent(url);
        const start = Date.now();
        try {
            const r = await axios.get('https://api.codemao.cn/tiger/v3/web/accounts/login', {
                timeout: 10000,
                httpsAgent: agent,
                proxy: false,
                validateStatus: () => true
            });
            const ms = Date.now() - start;
            console.log('[OK] ' + p + ' -> ' + r.status + ' (' + ms + 'ms)');
        } catch (e) {
            console.log('[FAIL] ' + p + ' -> ' + e.message);
        }
    }
}

test().catch(e => console.error('ERROR:', e.message));
