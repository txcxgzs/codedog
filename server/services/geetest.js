/**
 * 极验验证码SDK
 * 官方文档: https://docs.geetest.com/sensebot/deploy/server/node
 */

const Geetest = require('gt3-sdk');
// 引入 crypto 用于生成安全的随机 challenge（修复 Math.random 安全漏洞）
const crypto = require('crypto');

class GeetestLib {
    constructor(captchaId, privateKey) {
        this.captchaId = captchaId;
        this.privateKey = privateKey;
        this.geetest = new Geetest({
            geetest_id: captchaId,
            geetest_key: privateKey
        });
        // 记录 register 是否成功，用于 validate 时决定是否走宕机模式（fallback）
        // 默认 true 表示正常模式（validate 用 fallback=false，保持原行为）
        // geetestService.verify 会先调用 register 检测极验状态来更新该字段
        this.lastRegisterSuccess = true;
    }

    register() {
        return new Promise((resolve) => {
            this.geetest.register(null, (err, data) => {
                if (err) {
                    console.error('[极验] 注册失败:', err);
                    // 极验服务不可达，标记为宕机模式，validate 时将使用 fallback=true 本地校验
                    this.lastRegisterSuccess = false;
                    resolve({
                        success: 0,
                        gt: this.captchaId,
                        challenge: this._randomStr(),
                        new_captcha: true
                    });
                } else {
                    console.log('[极验] 注册成功:', data);
                    // 标记 register 是否成功：success===1 为正常，其余视为宕机
                    this.lastRegisterSuccess = data.success === 1;
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

            console.log('[极验] 调用SDK验证...');

            // 正确的调用方式: validate(fallback, result, callback)
            // fallback: false 表示正常模式（向极验服务器校验），true 表示宕机模式（本地校验 seccode）
            // 根据 register 结果决定：register 成功用 false（安全），register 失败/宕机用 true（避免极验故障导致 DoS）
            // 若实例未调用过 register（如 routes /validate 直接调用），lastRegisterSuccess 默认 true，保持原安全行为
            const fallback = this.lastRegisterSuccess ? false : true;
            console.log('[极验] 当前模式:', fallback ? '宕机模式(本地校验)' : '正常模式(服务器校验)');
            this.geetest.validate(fallback, {
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

    // 生成 32 字符的随机 challenge
    // 修复：原实现使用 Math.random，属于伪随机数，可被预测从而伪造宕机模式的 challenge
    // 改用 crypto.randomBytes(16) 生成 16 字节密码学安全随机数，转 hex 得到 32 字符
    _randomStr() {
        return crypto.randomBytes(16).toString('hex');
    }
}

module.exports = { GeetestLib };
