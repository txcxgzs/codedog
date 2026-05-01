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
    
    console.log('[代理] 使用代理:', proxyUrl);
    
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

const codemaoApi = {
    /**
     * 获取作品详情
     */
    async getWorkDetail(workId) {
        try {
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/creation-tools/v1/works/${workId}`,
                getAxiosConfig()
            );
            return response.data;
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
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/creation-tools/v1/user/center/work-list`,
                getAxiosConfig({
                    params: { user_id: userId, offset, limit }
                })
            );
            return response.data;
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
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/creation-tools/v1/user/center/collect/list`,
                getAxiosConfig({
                    params: { user_id: userId, offset, limit }
                })
            );
            return response.data;
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
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/web/banners/all`,
                getAxiosConfig({
                    params: { type }
                })
            );
            return response.data;
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
            console.log('[编程猫] 尝试登录:', identity);
            
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
            
            console.log('[编程猫] 登录成功, 用户:', response.data?.user_info?.nickname);
            return response.data;
        } catch (error) {
            console.error('[编程猫] 登录失败:', error.message);
            
            if (error.response) {
                console.error('[编程猫] 响应状态:', error.response.status);
                console.error('[编程猫] 响应数据:', JSON.stringify(error.response.data));
                
                if (error.response.status === 405 || error.response.status === 403) {
                    return { 
                        error: true, 
                        status: error.response.status, 
                        message: '服务器IP被编程猫封禁，请配置代理服务器。在.env文件中设置 HTTPS_PROXY=http://代理IP:端口' 
                    };
                }
                
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
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/tiger/v3/web/accounts/info`,
                getAxiosConfig({
                    params: { user_id: userId }
                })
            );
            return response.data;
        } catch (error) {
            console.error('[编程猫] 获取用户信息失败:', error.message);
            return null;
        }
    },

    /**
     * 获取所有论坛板块
     */
    async getForumBoards() {
        try {
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/web/forums/boards/simples/all`,
                getAxiosConfig()
            );
            return response.data;
        } catch (error) {
            console.error('[编程猫] 获取论坛板块失败:', error.message);
            return null;
        }
    },

    /**
     * 获取板块帖子列表
     */
    async getBoardPosts(boardId, page = 1, pageSize = 20) {
        try {
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/web/forums/boards/${boardId}/posts`,
                getAxiosConfig({
                    params: { page, page_size: pageSize }
                })
            );
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
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/web/forums/posts/search`,
                getAxiosConfig({
                    params: { q: keyword, page, page_size: pageSize }
                })
            );
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
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/api/fanfic/list/recommend`,
                getAxiosConfig()
            );
            return response.data;
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
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/creation-tools/v1/pc/discover/subject-work`,
                getAxiosConfig({
                    params: { offset, limit: Math.max(limit, 5) }
                })
            );
            return response.data;
        } catch (error) {
            console.error('[编程猫] 获取发现作品失败:', error.message);
            return null;
        }
    },

    /**
     * 获取作品详情（简化版，用于批量爬取）
     */
    async getWorkInfo(workId) {
        try {
            const response = await axios.get(
                `${CODEMAO_BASE_URL}/creation-tools/v1/works/${workId}`,
                getAxiosConfig()
            );
            return response.data;
        } catch (error) {
            console.error('[编程猫] 获取作品信息失败:', error.message);
            return null;
        }
    }
};

module.exports = codemaoApi;
