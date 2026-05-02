/**
 * 数据填充脚本
 * 从编程猫获取大量作品数据填充数据库
 */

require('dotenv').config();
const { Work, User, sequelize } = require('../models');
const codemaoApi = require('./codemaoApi');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAndSaveWork(workId) {
    try {
        const data = await codemaoApi.getWorkDetail(workId);
        
        if (!data || !data.id) {
            return null;
        }
        
        const existing = await Work.findOne({ where: { codemao_work_id: data.id } });
        if (existing) {
            return existing;
        }
        
        // 使用编程猫用户ID查找或创建用户
        let user = await User.findOne({ where: { codemao_user_id: data.user_info.id } });
        if (!user) {
            user = await User.create({
                codemao_user_id: data.user_info.id,
                username: `codemao_${data.user_info.id}`,
                email: `codemao_${data.user_info.id}@placeholder.com`,
                password: '$2a$10$placeholder',
                nickname: data.user_info.nickname,
                avatar: data.user_info.avatar,
                bio: data.user_info.description,
                role: 'user',
                status: 'active'
            });
        }
        
        const type = data.work_label_list && data.work_label_list[0] 
            ? data.work_label_list[0].label_name 
            : '其他';
        
        const work = await Work.create({
            codemao_work_id: data.id,
            name: data.work_name,
            description: data.description,
            preview: data.preview,
            type: type,
            ide_type: data.ide_type,
            work_url: data.player_url,
            user_id: user.id,
            codemao_author_id: data.user_info.id,
            codemao_author_name: data.user_info.nickname,
            view_times: data.view_times || 0,
            praise_times: data.liked_times || 0,
            collection_times: data.collect_times || 0,
            comment_count: data.comment_times || 0,
            status: 'published'
        });
        
        console.log(`✅ 作品: ${data.work_name} (作者ID: ${data.user_info.id})`);
        return { work, authorId: data.user_info.id };
    } catch (error) {
        return null;
    }
}

async function fetchBanners() {
    try {
        const { Banner } = require('../models');
        const data = await codemaoApi.getBanners('OFFICIAL');

        if (!data || !data.items) return;

        let index = 0;
        for (const item of data.items) {
            const existing = await Banner.findOne({ where: { title: item.title } });
            if (!existing) {
                await Banner.create({
                    title: item.title,
                    image_url: item.background_url,
                    link_url: item.target_url,
                    sort: index,
                    is_active: true
                });
                console.log(`✅ 轮播图: ${item.title}`);
            }
            index++;
        }
    } catch (error) {
        console.error('获取轮播图失败:', error.message);
    }
}

async function fetchUserWorks(userId, limit = 10) {
    try {
        const data = await codemaoApi.getUserWorks(userId, 0, limit);
        if (!data || !data.items) return { count: 0, authorIds: [] };
        
        let count = 0;
        const authorIds = new Set();
        
        for (const item of data.items) {
            const result = await fetchAndSaveWork(item.id);
            if (result) {
                count++;
                if (result.authorId) authorIds.add(result.authorId);
            }
            await delay(200);
        }
        return { count, authorIds: Array.from(authorIds) };
    } catch (error) {
        return { count: 0, authorIds: [] };
    }
}

async function fetchUserCollections(userId, limit = 10) {
    try {
        const data = await codemaoApi.getUserCollections(userId, 0, limit);
        if (!data || !data.items) return { count: 0, authorIds: [] };
        
        let count = 0;
        const authorIds = new Set();
        
        for (const item of data.items) {
            const result = await fetchAndSaveWork(item.id);
            if (result) {
                count++;
                if (result.authorId) authorIds.add(result.authorId);
            }
            await delay(200);
        }
        return { count, authorIds: Array.from(authorIds) };
    } catch (error) {
        return { count: 0, authorIds: [] };
    }
}

async function fetchForumPosts() {
    try {
        const boardsData = await codemaoApi.getForumBoards();
        if (!boardsData || !boardsData.items) return { count: 0, authorIds: [] };
        
        let totalWorks = 0;
        const authorIds = new Set();
        
        for (const board of boardsData.items) {
            console.log(`\n📌 板块: ${board.name}`);
            
            for (let page = 1; page <= 3; page++) {
                const postsData = await codemaoApi.getBoardPosts(board.id, page, 30);
                if (!postsData || !postsData.items) continue;
                
                for (const post of postsData.items) {
                    const workIdMatch = post.content?.match(/work\/(\d+)/);
                    if (workIdMatch) {
                        const result = await fetchAndSaveWork(parseInt(workIdMatch[1]));
                        if (result) {
                            totalWorks++;
                            if (result.authorId) authorIds.add(result.authorId);
                        }
                        await delay(200);
                    }
                }
                await delay(300);
            }
        }
        
        return { count: totalWorks, authorIds: Array.from(authorIds) };
    } catch (error) {
        console.error('获取论坛帖子失败:', error.message);
        return { count: 0, authorIds: [] };
    }
}

async function searchAndFetchWorks(keyword, limit = 50) {
    try {
        console.log(`\n🔍 搜索: ${keyword}`);
        const data = await codemaoApi.searchPosts(keyword, 1, 50);
        if (!data || !data.items) return { count: 0, authorIds: [] };
        
        let count = 0;
        const authorIds = new Set();
        
        for (const post of data.items) {
            const workIdMatch = post.content?.match(/work\/(\d+)/);
            if (workIdMatch) {
                const result = await fetchAndSaveWork(parseInt(workIdMatch[1]));
                if (result) {
                    count++;
                    if (result.authorId) authorIds.add(result.authorId);
                }
                await delay(200);
            }
        }
        
        return { count, authorIds: Array.from(authorIds) };
    } catch (error) {
        return { count: 0, authorIds: [] };
    }
}

async function main() {
    console.log('🚀 开始填充数据...\n');
    console.log('=' .repeat(50));
    
    try {
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功\n');
        
        const allAuthorIds = new Set();
        
        // 1. 获取轮播图
        console.log('📌 步骤1: 获取轮播图');
        console.log('-'.repeat(30));
        await fetchBanners();
        
        // 2. 从论坛帖子获取作品
        console.log('\n📌 步骤2: 从论坛帖子获取作品');
        console.log('-'.repeat(30));
        const forumResult = await fetchForumPosts();
        console.log(`获取 ${forumResult.count} 个作品，发现 ${forumResult.authorIds.length} 个作者`);
        forumResult.authorIds.forEach(id => allAuthorIds.add(id));
        
        // 3. 搜索热门关键词获取更多作品
        console.log('\n📌 步骤3: 搜索热门关键词');
        console.log('-'.repeat(30));
        const keywords = ['游戏', '作品', '源码', '开源', '分享', '教程', '推荐', '精品'];
        for (const keyword of keywords) {
            const result = await searchAndFetchWorks(keyword);
            console.log(`  "${keyword}": ${result.count} 个作品`);
            result.authorIds.forEach(id => allAuthorIds.add(id));
            await delay(500);
        }
        
        // 4. 从发现的作者获取更多作品
        console.log('\n📌 步骤4: 从作者获取更多作品');
        console.log('-'.repeat(30));
        const authorArray = Array.from(allAuthorIds);
        console.log(`发现 ${authorArray.length} 个作者`);
        
        let authorWorksCount = 0;
        let collectionCount = 0;
        
        for (const authorId of authorArray.slice(0, 30)) {
            // 获取作者作品
            const worksResult = await fetchUserWorks(authorId, 5);
            authorWorksCount += worksResult.count;
            
            // 获取作者收藏
            const collectResult = await fetchUserCollections(authorId, 5);
            collectionCount += collectResult.count;
            
            await delay(300);
        }
        
        // 统计
        const totalWorks = await Work.count();
        const totalUsers = await User.count();
        
        console.log('\n' + '='.repeat(50));
        console.log('✨ 数据填充完成！');
        console.log(`📊 统计:`);
        console.log(`   - 作品总数: ${totalWorks}`);
        console.log(`   - 用户总数: ${totalUsers}`);
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('执行失败:', error);
    } finally {
        await sequelize.close();
    }
}

main();
