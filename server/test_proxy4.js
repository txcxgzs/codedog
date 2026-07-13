const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const https = require('https');

async function test() {
    const proxies = ['socks5://8.215.3.250:104', 'socks5://206.123.156.233:4724'];
    for (const url of proxies) {
        const agent = new SocksProxyAgent(url);
        console.log('Testing: ' + url);

        try {
            const res = await axios.post(
                'https://api.codemao.cn/tiger/v3/web/accounts/login',
                { pid: '65edCTyg', identity: 'test', password: 'wrong' },
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
            console.log('  Status:', res.status, 'Body:', JSON.stringify(res.data).substring(0, 200));
        } catch (e) {
            console.log('  Error:', e.code || e.message);
        }
    }
}

async function testDirect() {
    console.log('\nDirect test (no proxy):');
    try {
        const res = await axios.post(
            'https://api.codemao.cn/tiger/v3/web/accounts/login',
            { pid: '65edCTyg', identity: 'test', password: 'wrong' },
            {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Origin': 'https://shequ.codemao.cn',
                    'Referer': 'https://shequ.codemao.cn/'
                },
                validateStatus: () => true
            }
        );
        console.log('  Status:', res.status, 'Body:', JSON.stringify(res.data).substring(0, 200));
    } catch (e) {
        console.log('  Error:', e.code || e.message);
    }
}

test().then(testDirect).catch(e => console.error('ERROR:', e.message));
