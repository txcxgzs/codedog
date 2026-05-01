/**
 * hCaptcha验证服务
 */

const axios = require('axios');

class HCaptchaService {
    constructor(secretKey) {
        this.secretKey = secretKey;
        this.verifyUrl = 'https://api.hcaptcha.com/siteverify';
    }

    async verify(token) {
        if (!token) {
            return { success: false, reason: '缺少验证token' };
        }

        try {
            const params = new URLSearchParams();
            params.append('secret', this.secretKey);
            params.append('response', token);
            
            const response = await axios.post(this.verifyUrl, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            });

            console.log('[hCaptcha] 验证响应:', response.data);

            return {
                success: response.data.success,
                score: response.data.score,
                reason: response.data['error-codes']?.join(', ') || null
            };
        } catch (error) {
            console.error('hCaptcha验证失败:', error.message);
            return { success: false, reason: '验证服务异常' };
        }
    }
}

module.exports = { HCaptchaService };
