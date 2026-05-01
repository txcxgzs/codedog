/**
 * 极验验证码SDK
 * 官方文档: https://docs.geetest.com/sensebot/deploy/server/node
 */

const Geetest = require('gt3-sdk');

class GeetestLib {
    constructor(captchaId, privateKey) {
        this.captchaId = captchaId;
        this.privateKey = privateKey;
        this.geetest = new Geetest({
            geetest_id: captchaId,
            geetest_key: privateKey
        });
    }

    register() {
        return new Promise((resolve) => {
            this.geetest.register(null, (err, data) => {
                if (err) {
                    console.error('[极验] 注册失败:', err);
                    resolve({
                        success: 0,
                        gt: this.captchaId,
                        challenge: this._randomStr(),
                        new_captcha: true
                    });
                } else {
                    console.log('[极验] 注册成功:', data);
                    resolve({
                        success: data.success,
                        gt: this.captchaId,
                        challenge: data.challenge,
                        new_captcha: true
                    });
                }
            });
        });
    }

    validate(challenge, validate, seccode) {
        return new Promise((resolve) => {
            if (!challenge || !validate || !seccode) {
                resolve({ result: 'fail', reason: '参数错误' });
                return;
            }

            console.log('[极验] 调用SDK验证...', { challenge, validate, seccode });
            
            // 正确的调用方式: validate(fallback, result, callback)
            // fallback: false 表示正常模式，true表示宕机模式
            this.geetest.validate(false, {
                geetest_challenge: challenge,
                geetest_validate: validate,
                geetest_seccode: seccode
            }, (err, success) => {
                console.log('[极验] SDK回调:', { err, success });
                
                if (err) {
                    console.error('[极验] 验证错误:', err);
                    resolve({ result: 'fail', reason: err.message || '验证错误' });
                } else if (success) {
                    resolve({ result: 'success', reason: '验证成功' });
                } else {
                    resolve({ result: 'fail', reason: '验证失败' });
                }
            });
        });
    }

    _randomStr() {
        const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let str = '';
        for (let i = 0; i < 32; i++) {
            str += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return str;
    }
}

module.exports = { GeetestLib };
