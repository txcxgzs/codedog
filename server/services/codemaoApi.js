/**
 * 编程猫API服务
 * 用于调用编程猫官方API获取数据
 * 支持代理配置，解决服务器IP被封问题
 */

const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const CODEMAO_BASE_URL = 'https://api.codemao.cn';
const CODEMAO_PID = '65edCTyg';

/**
 * 默认请求头，模拟正常浏览器请求
 * 避免被WAF拦截
 */
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Origin': 'https://shequ.codemao.cn',
    'Referer': 'https://shequ.codemao.cn/'
};

/**
 * 获取代理配置
 * 支持环境变量配置: HTTP_PROXY, HTTPS_PROXY, ALL_PROXY
 * 也支持数据库配置: proxy_url
 */
function getProxyAgent() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
    
    if (!proxyUrl) {
        return undefined;
    }

    // 修复：脱敏代理 URL 中的凭据（用户名/密码），避免日志泄露敏感信息
    // 形如 http://user:pass@host:port → http://user:***@host:port
    const safeProxy = proxyUrl.replace(/\/\/([^:/?#]+):([^@/?#]+)@/, '//$1:***@');
    console.log('[代理] 使用代理:', safeProxy);
    
    if (proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://')) {
        return new SocksProxyAgent(proxyUrl);
    } else {
        return new HttpsProxyAgent(proxyUrl);
    }
}

/**
 * 获取axios请求配置
 */
function getAxiosConfig(customConfig = {}) {
    const proxyAgent = getProxyAgent();

    return {
        timeout: 15000,
        headers: DEFAULT_HEADERS,
        ...(proxyAgent && { httpsAgent: proxyAgent, proxy: false }),
        ...customConfig
    };
}

async function requestWithRetry(requestFn, retries = 2, delay = 1000) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await requestFn();
        } catch (error) {
            if (i === retries) throw error;
            await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
    }
}

const codemaoApi = {
    /**
     * 获取作品详情
     */
    async getWorkDetail(workId) {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/creation-tools/v1/works/${workId}`,
                getAxiosConfig()
            ));
            return codemaoApi.normalizeWorkUrls(response.data);
        } catch (error) {
            console.error('[编程猫] 获取作品详情失败:', error.message);
            return null;
        }
    },

    /**
     * 获取用户作品列表
     */
    async getUserWorks(userId, offset = 0, limit = 20) {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/creation-tools/v1/user/center/work-list`,
                getAxiosConfig({
                    params: { user_id: userId, offset, limit }
                })
            ));
            const data = response.data;
            if (data && Array.isArray(data.items)) {
                data.items = data.items.map(item => codemaoApi.normalizeWorkUrls(item));
            }
            return data;
        } catch (error) {
            console.error('[编程猫] 获取用户作品失败:', error.message);
            return null;
        }
    },

    /**
     * 获取用户收藏作品列表
     */
    async getUserCollections(userId, offset = 0, limit = 20) {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/creation-tools/v1/user/center/collect/list`,
                getAxiosConfig({
                    params: { user_id: userId, offset, limit }
                })
            ));
            const data = response.data;
            if (data && Array.isArray(data.items)) {
                data.items = data.items.map(item => codemaoApi.normalizeWorkUrls(item));
            }
            return data;
        } catch (error) {
            console.error('[编程猫] 获取用户收藏失败:', error.message);
            return null;
        }
    },

    /**
     * 获取轮播图
     */
    async getBanners(type = 'OFFICIAL') {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/web/banners/all`,
                getAxiosConfig({
                    params: { type }
                })
            ));
            const data = response.data;
            if (data && Array.isArray(data.items)) {
                data.items = data.items.map(item => {
                    if (item && typeof item === 'object') {
                        if (item.background_url && typeof item.background_url === 'string') {
                            item.background_url = normalizeCodemaoImageUrl(item.background_url);
                        }
                        if (item.image_url && typeof item.image_url === 'string') {
                            item.image_url = normalizeCodemaoImageUrl(item.image_url);
                        }
                        if (item.cover_url && typeof item.cover_url === 'string') {
                            item.cover_url = normalizeCodemaoImageUrl(item.cover_url);
                        }
                    }
                    return item;
                });
            }
            return data;
        } catch (error) {
            console.error('[编程猫] 获取轮播图失败:', error.message);
            return null;
        }
    },

    /**
     * 编程猫登录
     */
    async login(identity, password) {
        try {
            console.log('[编程猫] 尝试登录');
            
            const proxyAgent = getProxyAgent();
            const config = {
                timeout: 15000,
                headers: DEFAULT_HEADERS,
                ...(proxyAgent && { httpsAgent: proxyAgent, proxy: false })
            };
            
            const response = await axios.post(
                `${CODEMAO_BASE_URL}/tiger/v3/web/accounts/login`,
                {
                    pid: CODEMAO_PID,
                    identity,
                    password
                },
                config
            );
            
            console.log('[编程猫] 登录成功');
            return response.data;
        } catch (error) {
            console.error('[编程猫] 登录失败:', error.message);

            if (error.response) {
                console.error('[编程猫] 响应状态:', error.response.status);

                return {
                    error: true,
                    status: error.response.status,
                    message: error.response.data?.message || '登录请求失败'
                };
            }

            return { error: true, message: error.message || '网络请求失败' };
        }
    },

    /**
     * 获取用户信息
     */
    async getUserInfo(userId) {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/tiger/v3/web/accounts/info`,
                getAxiosConfig({
                    params: { user_id: userId }
                })
            ));
            return response.data;
        } catch (error) {
            console.error('[编程猫] 获取用户信息失败:', error.message);
            return null;
        }
    },

    /**
     * 获取所有论坛板块
     */
    async getWorkInfo(workId) {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/creation-tools/v1/works/${workId}`,
                getAxiosConfig()
            ));
            return codemaoApi.normalizeWorkUrls(response.data);
        } catch (error) {
            console.error('[编程猫] 获取作品信息失败:', error.message);
            return null;
        }
    },

    /**
     * 获取板块帖子列表
     */
    async getBoardPosts(boardId, page = 1, pageSize = 20) {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/web/forums/boards/${boardId}/posts`,
                getAxiosConfig({
                    params: { page, page_size: pageSize }
                })
            ));
            return response.data;
        } catch (error) {
            console.error('[编程猫] 获取帖子列表失败:', error.message);
            return null;
        }
    },

    /**
     * 搜索帖子
     */
    async searchPosts(keyword, page = 1, pageSize = 20) {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/web/forums/posts/search`,
                getAxiosConfig({
                    params: { q: keyword, page, page_size: pageSize }
                })
            ));
            return response.data;
        } catch (error) {
            console.error('[编程猫] 搜索帖子失败:', error.message);
            return null;
        }
    },

    /**
     * 获取推荐小说
     */
    async getRecommendFanfics() {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/api/fanfic/list/recommend`,
                getAxiosConfig()
            ));
            const data = response.data;
            if (data && Array.isArray(data.items)) {
                data.items = data.items.map(item => codemaoApi.normalizeWorkUrls(item));
            }
            return data;
        } catch (error) {
            console.error('[编程猫] 获取推荐小说失败:', error.message);
            return null;
        }
    },

    /**
     * 获取发现页面作品（推荐作品）
     */
    async getDiscoverWorks(offset = 0, limit = 20) {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/creation-tools/v1/pc/discover/subject-work`,
                getAxiosConfig({
                    params: { offset, limit: Math.max(limit, 5) }
                })
            ));
            const data = response.data;
            if (data && Array.isArray(data.items)) {
                data.items = data.items.map(item => codemaoApi.normalizeWorkUrls(item));
            }
            return data;
        } catch (error) {
            console.error('[编程猫] 获取发现作品失败:', error.message);
            return null;
        }
    },

    /**
     * 获取所有论坛板块
     * 修复: 补充 seedData.js 所需的 getForumBoards 函数
     */
    async getForumBoards() {
        try {
            const response = await requestWithRetry(() => axios.get(
                `${CODEMAO_BASE_URL}/web/forums/boards`,
                getAxiosConfig()
            ));
            return response.data;
        } catch (error) {
            console.error('[编程猫] 获取论坛板块失败:', error.message);
            return null;
        }
    }
};

/**
 * 规范化图片/媒体 URL：处理相对路径，确保可被前端直接加载
 * 编程猫部分接口返回的是相对路径(如 /app/... 或 //cdn...)，需要补全协议和域名
 */
function normalizeCodemaoImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    if (!url) return null;
    // 去除首尾反引号（编程猫部分接口返回的URL被 Markdown 代码块标记包裹）
    while (url.startsWith('`') || url.endsWith('`')) {
        url = url.replace(/^`+/, '').replace(/`+$/, '').trim();
        if (!url) return null;
    }
    if (/^https?:\/\//i.test(url)) return url;        // 完整URL，直接返回
    if (url.startsWith('//')) return 'https:' + url;   // 协议相对，补全协议
    if (url.startsWith('/')) return 'https://cdn.codemao.cn' + url; // 相对路径，拼接CDN域名
    return url;
}

/**
 * 规范化头像 URL（兼容旧函数名）
 */
function normalizeAvatarUrl(url) {
    return normalizeCodemaoImageUrl(url);
}

/**
 * 从编程猫 API 响应对象中提取头像 URL
 * 编程猫不同接口(login/getUserInfo/discover/getWorkDetail)返回的 user_info
 * 头像字段名不一致(avatar_url / avatar / portrait 等)，此函数穷举所有可能字段名
 */
codemaoApi.normalizeCodemaoAvatar = function(rawUserInfo) {
    if (!rawUserInfo || typeof rawUserInfo !== 'object') return null;
    const avatarFields = ['avatar_url', 'avatar', 'portrait', 'portrait_url', 'head_icon', 'head_icon_url', 'head_url', 'avatar_path'];
    for (const field of avatarFields) {
        let val = rawUserInfo[field];
        if (val && typeof val === 'string') {
            val = val.trim();
            if (val) return normalizeCodemaoImageUrl(val);
        }
    }
    return null;
};

/**
 * 通用：规范化任意图片/媒体 URL
 */
codemaoApi.normalizeCodemaoImageUrl = normalizeCodemaoImageUrl;

/**
 * 规范化作品对象中的图片/播放器 URL
 * 编程猫不同接口返回的封面字段名不一致(preview/preview_url/cover/cover_url/image_url)，
 * 且部分接口返回相对路径，需要统一补全为可访问的绝对 URL。
 */
codemaoApi.normalizeWorkUrls = function(work) {
    if (!work || typeof work !== 'object') return work;

    const imageFields = ['preview', 'preview_url', 'cover', 'cover_url', 'image_url', 'picture', 'src'];
    for (const field of imageFields) {
        if (work[field] && typeof work[field] === 'string') {
            work[field] = normalizeCodemaoImageUrl(work[field]);
        }
    }

    // player_url / work_url 通常是播放器链接,也做规范化(协议相对路径等)
    if (work.player_url && typeof work.player_url === 'string') {
        work.player_url = normalizeCodemaoImageUrl(work.player_url);
    }
    if (work.work_url && typeof work.work_url === 'string') {
        work.work_url = normalizeCodemaoImageUrl(work.work_url);
    }

    // 嵌套的作者头像也一并规范化
    if (work.user_info && typeof work.user_info === 'object') {
        work.user_info.avatar = codemaoApi.normalizeCodemaoAvatar(work.user_info);
    }

    return work;
};

module.exports = codemaoApi;
