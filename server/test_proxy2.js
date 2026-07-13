const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

async function test() {
    console.log('[1] fetch proxy pool...');
    const res = await axios.get('https://proxy.scdn.io/api/get_proxy.php?protocol=socks5&count=5', { timeout: 15000, responseType: 'text' });
    const data = JSON.parse(res.data);
    const proxies = data.data.proxies;
    console.log('    got', proxies.length, 'proxies:', proxies);

    for (const p of proxies) {
        const url = 'socks5://' + p;
        const agent = new SocksProxyAgent(url);
        const start = Date.now();
        try {
            const r = await axios.get('http://httpbin.org/ip', {
                timeout: 10000,
                httpsAgent: agent,
                proxy: false,
                validateStatus: () => true
            });
            const ms = Date.now() - start;
            console.log('[OK] ' + p + ' -> ' + r.status + ' (' + ms + 'ms) body: ' + JSON.stringify(r.data));
        } catch (e) {
            console.log('[FAIL] ' + p + ' -> ' + e.message);
        }
    }
}

test().catch(e => console.error('ERROR:', e.message));
