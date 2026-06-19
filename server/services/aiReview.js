/**
 * AI审核服务
 * 支持自定义API和提示词
 */

const axios = require('axios');
const net = require('net');
const { SystemConfig, SensitiveWord } = require('../models');
const DbAdapter = require('../utils/dbAdapter');
const { Op } = require('sequelize');

const DEFAULT_PROMPT = `# 角色定义
你是一个专业的内容安全审核系统，具备以下能力：
- 识别违规内容类型
- 评估风险等级
- 提供处理建议

# 任务说明
你需要审核以下内容：

**审核类型**：{{type}}
**待审核内容**：
{{content}}

# 审核标准

| 类型 | 定义 | 示例 |
|------|------|------|
| 涉政 | 政治敏感、国家领导人、敏感事件 | 政治讨论、敏感言论 |
| 涉黄 | 色情、低俗、性暗示 | 色情描述、低俗图片 |
| 涉暴 | 暴力、血腥、恐怖 | 暴力描述、恐怖内容 |
| 涉赌 | 赌博、博彩推广 | 赌博网站、博彩信息 |
| 诈骗 | 虚假信息、欺诈诱导 | 虚假中奖、钓鱼链接 |
| 广告 | 商业推广、营销链接 | 微信推广、商业链接 |
| 辱骂 | 人身攻击、侮辱语言 | 脏话、人身攻击 |

**注意**：社区内分享自己的编程作品不算广告。

# 风险等级定义
- **low**：内容完全正常
- **medium**：轻微违规或疑似违规
- **high**：严重违规

# 处理建议定义
- **pass**：通过审核
- **review**：需人工复核
- **delete**：建议删除

# 输出格式【必须严格遵守】

你必须且只能输出一个合法的JSON对象，不要输出任何其他内容。

JSON格式如下：
\`\`\`json
{
  "riskLevel": "<low|medium|high>",
  "violations": ["<违规类型1>", "<违规类型2>"],
  "reason": "<判断理由>",
  "recommendation": "<pass|review|delete>",
  "confidence": <0.0-1.0之间的数字>
}
\`\`\`

# 审核示例

**示例1 - 正常内容**
输入内容：今天做了一个小游戏，欢迎大家来玩！
输出：
{"riskLevel":"low","violations":[],"reason":"用户分享自己的编程作品，内容正常","recommendation":"pass","confidence":0.95}

**示例2 - 广告内容**
输入内容：加微信xxx免费领取课程，限时优惠！
输出：
{"riskLevel":"medium","violations":["广告"],"reason":"包含联系方式和推广信息","recommendation":"review","confidence":0.88}

**示例3 - 辱骂内容**
输入内容：你个傻X，滚蛋！
输出：
{"riskLevel":"high","violations":["辱骂"],"reason":"包含侮辱性语言","recommendation":"delete","confidence":0.96}

**示例4 - 多种违规**
输入内容：加群xxx看黄片，免费！
输出：
{"riskLevel":"high","violations":["涉黄","广告"],"reason":"涉及色情内容和推广信息","recommendation":"delete","confidence":0.98}

# 重要提醒
1. 只输出JSON，不要有任何其他文字
2. confidence必须是0到1之间的数字
3. violations数组为空时表示无违规
4. riskLevel和recommendation必须匹配`;

function isPrivateHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost')) {
        return true;
    }

    const ipVersion = net.isIP(host);
    if (ipVersion === 4) {
        const parts = host.split('.').map(Number);
        return parts[0] === 10
            || parts[0] === 127
            || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
            || (parts[0] === 192 && parts[1] === 168)
            || (parts[0] === 169 && parts[1] === 254)
            || parts[0] === 0;
    }
    if (ipVersion === 6) {
        return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
    }

    return false;
}

function validateAIEndpoint(apiUrl) {
    let parsed;
    try {
        parsed = new URL(apiUrl);
    } catch (error) {
        throw new Error('AI API 地址格式无效');
    }

    if (parsed.protocol !== 'https:') {
        throw new Error('AI API 地址必须使用 HTTPS');
    }

    if (isPrivateHost(parsed.hostname)) {
        throw new Error('AI API 地址不能指向本机或内网地址');
    }
}

async function getAIConfig() {
    const configs = await DbAdapter.findAll(SystemConfig, {
        where: { config_key: { [Op.in]: ['ai_enabled', 'ai_api_url', 'ai_api_key', 'ai_model', 'ai_prompt', 'sensitive_check_mode'] } }
    });

    const configMap = {};
    configs.forEach(c => { configMap[c.config_key] = c.config_value; });

    return {
        enabled: configMap.ai_enabled === 'true',
        apiUrl: configMap.ai_api_url || '',
        apiKey: configMap.ai_api_key || '',
        model: configMap.ai_model || 'gpt-3.5-turbo',
        prompt: configMap.ai_prompt || DEFAULT_PROMPT,
        sensitiveCheckMode: configMap.sensitive_check_mode || 'builtin' // builtin, api, both
    };
}

async function reviewContent(type, content) {
    try {
        const config = await getAIConfig();
        
        console.log('AI审核配置:', {
            enabled: config.enabled,
            apiUrl: config.apiUrl ? '已配置' : '未配置',
            apiKey: config.apiKey ? '已配置' : '未配置',
            model: config.model
        });
        
        if (!config.enabled) {
            console.log('AI审核未启用');
            return {
                success: false,
                error: 'AI审核未启用，请在系统设置中开启',
                fallback: await fallbackReview(content)
            };
        }
        
        if (!config.apiUrl) {
            console.log('AI API地址未配置');
            return {
                success: false,
                error: 'AI API地址未配置',
                fallback: await fallbackReview(content)
            };
        }
        
        validateAIEndpoint(config.apiUrl);

        if (!config.apiKey) {
            console.log('AI API密钥未配置');
            return {
                success: false,
                error: 'AI API密钥未配置',
                fallback: await fallbackReview(content)
            };
        }
        
        const prompt = config.prompt
            .replace('{{type}}', type)
            .replace('{{content}}', content);
        
        console.log('发送AI审核请求...', { type, contentLength: content.length });
        
        const requestBody = {
            model: config.model,
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 500
        };
        
        const response = await axios.post(config.apiUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            timeout: 30000
        });
        
        console.log('AI响应状态:', response.status);
        
        const aiResponse = response.data.choices?.[0]?.message?.content || '';
        console.log('AI原始响应:', aiResponse.substring(0, 200));
        
        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                console.log('AI审核结果:', result);
                return {
                    success: true,
                    riskLevel: result.riskLevel || 'low',
                    violations: result.violations || [],
                    reason: result.reason || '',
                    recommendation: result.recommendation || 'pass',
                    confidence: result.confidence || 0.5
                };
            }
        } catch (parseError) {
            console.error('解析AI响应失败:', parseError.message);
        }
        
        return {
            success: false,
            error: 'AI响应格式错误，无法解析JSON',
            rawResponse: aiResponse.substring(0, 500)
        };
    } catch (error) {
        console.error('AI审核请求失败:', error.message);
        if (error.response) {
            console.error('API错误响应:', error.response.status, error.response.data);
        }
        return {
            success: false,
            error: `AI请求失败: ${error.message}`,
            fallback: await fallbackReview(content)
        };
    }
}

async function fallbackReview(content, overrideMode) {
    try {
        const config = await getAIConfig();

        // 根据配置选择检测方式，如果传入了 overrideMode 则使用它
        const checkMode = overrideMode || config.sensitiveCheckMode || 'builtin'; // builtin, api, both

        let builtinResult = null;
        let apiResult = null;

        // 内置词库检测
        if (checkMode === 'builtin' || checkMode === 'both') {
            builtinResult = await builtinSensitiveCheck(content);
        }

        // 外部 API 检测
        if (checkMode === 'api' || checkMode === 'both') {
            apiResult = await externalSensitiveCheck(content);
        }

        // 合并结果
        if (checkMode === 'both' && builtinResult && apiResult) {
            return mergeResults(builtinResult, apiResult);
        }

        return apiResult || builtinResult || {
            riskLevel: 'low',
            violations: [],
            reason: '未发现敏感词',
            recommendation: 'pass',
            confidence: 0.9
        };
    } catch (e) {
        console.error('敏感词检测失败:', e.message);
        return {
            riskLevel: 'low',
            violations: [],
            reason: '敏感词检测失败',
            recommendation: 'review',
            confidence: 0.5
        };
    }
}

// 内置词库检测
async function builtinSensitiveCheck(content) {
    try {
        const sensitiveWords = await DbAdapter.findAll(SensitiveWord, { where: { status: 'active' } });
        const foundWordsSet = new Set();
        let riskLevel = 'low';

        for (const sw of sensitiveWords) {
            if (content.includes(sw.word)) {
                foundWordsSet.add(sw.word);
                const level = Number(sw.level) || 1;
                if (level >= 3) {
                    riskLevel = 'high';
                } else if (level === 2 && riskLevel !== 'high') {
                    riskLevel = 'medium';
                }
            }
        }

        const foundWords = [...foundWordsSet];

        return {
            riskLevel,
            violations: foundWords,
            reason: foundWords.length > 0 ? `包含敏感词: ${foundWords.join(', ')}` : '未发现敏感词',
            recommendation: riskLevel === 'high' ? 'delete' : (riskLevel === 'medium' ? 'review' : 'pass'),
            confidence: foundWords.length > 0 ? 0.7 : 0.9,
            source: 'builtin'
        };
    } catch (e) {
        return null;
    }
}

// 外部 API 检测
const SENSITIVE_API_URL = 'https://wordcheck.txcxgzs.com/api/check';

async function externalSensitiveCheck(content) {
    try {
        const response = await axios.post(SENSITIVE_API_URL, { text: content }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        const data = response.data;

        // API 返回格式：
        // {
        //   "text": "...",
        //   "sensitivity": { "level": 0, "label": "安全", "score": 0 },
        //   "matchedWords": [],
        //   "matchCount": 0,
        //   "uniqueMatchCount": 0
        // }

        const sensitivity = data.sensitivity || {};
        const level = sensitivity.level || 0; // 0=安全, 1=低风险, 2=中风险, 3=高风险
        const matchedWords = data.matchedWords || [];

        // 转换风险等级
        let riskLevel = 'low';
        if (level >= 3) riskLevel = 'high';
        else if (level >= 2) riskLevel = 'medium';
        else if (level >= 1) riskLevel = 'low';

        return {
            riskLevel,
            violations: matchedWords,
            reason: matchedWords.length > 0 ? `外部API检测: ${matchedWords.join(', ')}` : '外部API未发现敏感词',
            recommendation: riskLevel === 'high' ? 'delete' : (riskLevel === 'medium' ? 'review' : 'pass'),
            confidence: matchedWords.length > 0 ? 0.8 : 0.9,
            source: 'api'
        };
    } catch (e) {
        console.error('外部敏感词API调用失败:', e.message);
        return null;
    }
}

// 合并两种检测结果
function mergeResults(builtin, api) {
    const allViolations = [...new Set([...builtin.violations, ...api.violations])];

    // 取更高的风险等级
    const riskLevels = { low: 1, medium: 2, high: 3 };
    const builtinLevel = riskLevels[builtin.riskLevel] || 1;
    const apiLevel = riskLevels[api.riskLevel] || 1;
    const maxLevel = Math.max(builtinLevel, apiLevel);
    const riskLevel = maxLevel >= 3 ? 'high' : (maxLevel >= 2 ? 'medium' : 'low');

    return {
        riskLevel,
        violations: allViolations,
        reason: allViolations.length > 0 ? `检测发现敏感词: ${allViolations.join(', ')}` : '未发现敏感词',
        recommendation: riskLevel === 'high' ? 'delete' : (riskLevel === 'medium' ? 'review' : 'pass'),
        confidence: Math.max(builtin.confidence || 0, api.confidence || 0),
        source: 'both'
    };
}

module.exports = {
    reviewContent,
    getAIConfig,
    DEFAULT_PROMPT,
    fallbackReview,
    builtinSensitiveCheck,
    externalSensitiveCheck
};
