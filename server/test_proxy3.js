const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

async function test() {
    const url = 'socks5://8.215.3.250:104';
    const agent = new SocksProxyAgent(url, { tls: { rejectUnauthorized: false } });
    console.log('Testing Codemao login via proxy: ' + url);

    try {
        const res = await axios.post(
            'https://api.codemao.cn/tiger/v3/web/accounts/login',
            { pid: '65edCTyg', identity: 'test_user', password: 'wrong_password' },
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
        console.log('Status:', res.status);
        console.log('Body:', JSON.stringify(res.data).substring(0, 500));
    } catch (e) {
        console.log('Error:', e.message);
    }
}

test().catch(e => console.error('ERROR:', e.message));
