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

            // 修复：不记录完整响应（可能含敏感信息），只记录关键结果字段
            console.log('[hCaptcha] 验证结果:', response.data?.success, response.data?.error_codes?.length || 0);

            // 修复: 添加 response.data 空值保护,避免 response.data 为 null 时抛 TypeError
            const data = response.data || {};
            return {
                success: !!data.success,
                score: data.score,
                reason: Array.isArray(data['error-codes']) ? data['error-codes'].join(', ') || null : null
            };
        } catch (error) {
            console.error('hCaptcha验证失败:', error.message);
            return { success: false, reason: '验证服务异常' };
        }
    }
}

module.exports = { HCaptchaService };
