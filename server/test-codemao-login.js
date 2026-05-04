/**
 * 测试编程猫登录API
 */

const axios = require('axios');

const CODEMAO_BASE_URL = 'https://api.codemao.cn';
const CODEMAO_PID = '65edCTyg';

async function testLogin(identity, password) {
    console.log('========================================');
    console.log('测试编程猫登录 API');
    console.log('========================================');
    console.log('API地址:', `${CODEMAO_BASE_URL}/tiger/v3/web/accounts/login`);
    console.log('PID:', CODEMAO_PID);
    console.log('账号:', identity);
    console.log('密码:', password);
    console.log('----------------------------------------');
    
    try {
        const response = await axios.post(`${CODEMAO_BASE_URL}/tiger/v3/web/accounts/login`, {
            pid: CODEMAO_PID,
            identity,
            password
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log('✅ 登录成功!');
        console.log('响应状态:', response.status);
        console.log('响应数据:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.log('❌ 登录失败!');
        if (error.response) {
            console.log('HTTP状态码:', error.response.status);
            console.log('响应数据:', JSON.stringify(error.response.data, null, 2));
            console.log('响应头:', JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
            console.log('无响应，请求详情:', error.request);
        } else {
            console.log('错误信息:', error.message);
        }
        return null;
    }
}

// 获取命令行参数或使用占位符
const identity = process.argv[2] || 'YOUR_IDENTITY_HERE';
const password = process.argv[3] || 'YOUR_PASSWORD_HERE';

// 测试
testLogin(identity, password).then(result => {
    console.log('========================================');
    console.log('测试完成');
    process.exit(result ? 0 : 1);
});
