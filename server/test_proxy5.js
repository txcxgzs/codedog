const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

async function testHttp() {
    const proxies = [
        { url: 'socks5://8.215.3.250:104', name: 'socks5' },
        { url: 'socks5://206.123.156.233:4724', name: 'socks5_2' },
    ];
    for (const p of proxies) {
        const agent = new SocksProxyAgent(p.url);
        console.log('Testing: ' + p.name + ' (' + p.url + ')');
        try {
            const res = await axios.get('http://api.codemao.cn/tiger/v3/web/accounts/login', {
                timeout: 10000,
                httpAgent: agent,
                httpsAgent: agent,
                proxy: false,
                headers: { 'User-Agent': 'Mozilla/5.0' },
                validateStatus: () => true
            });
            console.log('  HTTP Status:', res.status, 'Body:', JSON.stringify(res.data).substring(0, 100));
        } catch (e) {
            console.log('  Error:', e.code || e.message);
        }
    }
}

async function testCodemaoPort80() {
    console.log('\nCodemao port 80 via socks5:');
    const agent = new SocksProxyAgent('socks5://8.215.3.250:104');
    try {
        const res = await axios.get('http://api.codemao.cn/tiger/v3/web/accounts/login', {
            timeout: 15000,
            httpAgent: agent,
            httpsAgent: agent,
            proxy: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'application/json',
                'Origin': 'https://shequ.codemao.cn',
                'Referer': 'https://shequ.codemao.cn/'
            },
            validateStatus: () => true
        });
        console.log('  Status:', res.status, 'Body:', JSON.stringify(res.data).substring(0, 200));
    } catch (e) {
        console.log('  Error:', e.code || e.message);
    }
}

testHttp().then(testCodemaoPort80).catch(e => console.error('ERROR:', e.message));
