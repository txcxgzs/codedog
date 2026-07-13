const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function testHttpProxy() {
    console.log('Fetching HTTP proxies from scdn.io...');
    const res = await axios.get('https://proxy.scdn.io/api/get_proxy.php?protocol=http&count=3', { timeout: 15000, responseType: 'text' });
    const data = JSON.parse(res.data);
    const proxies = data.data.proxies;
    console.log('Got:', proxies);

    for (const p of proxies) {
        const url = 'http://' + p;
        console.log('\nTesting: ' + url);
        try {
            const agent = new HttpsProxyAgent(url);
            const r = await axios.post(
                'https://api.codemao.cn/tiger/v3/web/accounts/login',
                { pid: '65edCTyg', identity: 'test_user', password: 'wrong_pass' },
                {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Origin': 'https://shequ.codemao.cn',
                        'Referer': 'https://shequ.codemao.cn/'
                    },
                    httpsAgent: agent,
                    proxy: false,
                    validateStatus: () => true
                }
            );
            console.log('  Status:', r.status, 'Body:', JSON.stringify(r.data).substring(0, 200));
        } catch (e) {
            console.log('  Error:', e.code || e.message);
        }
    }
}

testHttpProxy().catch(e => console.error('ERROR:', e.message));
