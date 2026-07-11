/**
 * 数据填充脚本
 * 从编程猫获取大量作品数据填充数据库
 *
 * 修复说明（M17/M18/L3/L4）：
 * - M17: 占位密码改为合法 bcrypt 哈希（运行时生成，避免非法哈希导致登录校验异常）
 * - M18: 邮箱改用 .invalid 保留 TLD（避免占用真实域名 placeholder.com）
 * - L3: catch 块补充 console.error 错误日志，便于排查问题
 * - L4: 用户+作品创建用 sequelize.transaction 包裹，保证原子性
 */

require('dotenv').config();
const { Work, User, sequelize } = require('../models');
const codemaoApi = require('./codemaoApi');
const bcrypt = require('bcryptjs');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAndSaveWork(workId) {
    try {
        const data = await codemaoApi.getWorkDetail(workId);

        if (!data || !data.id) {
            return null;
        }

        const existing = await Work.findOne({ where: { codemao_work_id: String(data.id) } });
        if (existing) {
            // 修复: 返回值结构与新建分支统一,补上 authorId 字段
            // 调用方通过 result.authorId 收集作者ID,缺失会导致已存在作品的作者不被收集
            return { work: existing, authorId: String(data.user_info?.id || existing.codemao_author_id || '') };
        }

        // 修复: 校验 data.user_info 是否存在,避免编程猫接口异常时抛 TypeError
        if (!data || !data.id || !data.user_info || !data.user_info.id) {
            return null;
        }

        // 使用编程猫用户ID查找或创建用户
        const codemaoUserId = String(data.user_info.id);

        // L4: 用事务包裹用户+作品创建，保证原子性（任一失败则全部回滚）
        const result = await sequelize.transaction(async (t) => {
            let user = await User.findOne({ where: { codemao_user_id: codemaoUserId }, transaction: t });
            if (!user) {
                user = await User.create({
                    codemao_user_id: codemaoUserId,
                    username: `codemao_${codemaoUserId}`,
                    // M18: 使用 .invalid 保留 TLD，避免占用真实域名
                    email: `codemao_${codemaoUserId}@example.invalid`,
                    // M17: 生成合法 bcrypt 哈希（占位密码无法通过任何登录校验，但格式合法避免 bcrypt.compare 报错）
                    password: bcrypt.hashSync('seed-user-' + codemaoUserId + '-' + Date.now(), 10),
                    nickname: data.user_info.nickname,
                    avatar: codemaoApi.normalizeCodemaoAvatar(data.user_info),
                    bio: data.user_info.description,
                    role: 'user',
                    status: 'active'
                }, { transaction: t });
            }

            const type = data.work_label_list && data.work_label_list[0]
                ? data.work_label_list[0].label_name
                : '其他';

            const work = await Work.create({
                codemao_work_id: String(data.id),
                name: data.work_name,
                description: data.description,
                preview: data.preview,
                type: type,
                ide_type: data.ide_type,
                work_url: data.player_url,
                user_id: user.id,
                codemao_author_id: codemaoUserId,
                codemao_author_name: data.user_info.nickname,
                view_times: data.view_times || 0,
                praise_times: data.liked_times || 0,
                collection_times: data.collect_times || 0,
                comment_count: data.comment_times || 0,
                status: 'published'
            }, { transaction: t });

            return { work, authorId: codemaoUserId };
        });

        console.log(`✅ 作品: ${data.work_name} (作者ID: ${codemaoUserId})`);
        return result;
    } catch (error) {
        // L3: 补充错误日志，便于排查填充失败原因
        console.error('seedData 错误:', error.message);
        return null;
    }
}

async function fetchBanners() {
    try {
        const { Banner } = require('../models');
        const data = await codemaoApi.getBanners('OFFICIAL');

        if (!data || !data.items) return;

        for (const item of data.items) {
            const existing = await Banner.findOne({ where: { title: item.title } });
            if (!existing) {
                await Banner.create({
                    title: item.title,
                    image_url: item.background_url,
                    link_url: item.target_url,
                    sort: parseInt(item.id) || 0,
                    is_active: true
                });
                console.log(`✅ 轮播图: ${item.title}`);
            }
        }
    } catch (error) {
        console.error('seedData 错误:', error.message);
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
        // L3: 补充错误日志
        console.error('seedData 错误:', error.message);
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
        // L3: 补充错误日志
        console.error('seedData 错误:', error.message);
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
                    // 修复: 正则加边界约束,避免匹配 network/123、framework/456 等子串
                    const workIdMatch = post.content?.match(/\/work\/(\d+)/);
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
        console.error('seedData 错误:', error.message);
        return { count: 0, authorIds: [] };
    }
}

async function searchAndFetchWorks(keyword, limit = 50) {
    try {
        console.log(`\n🔍 搜索: ${keyword}`);
        // 修复: 使用 limit 参数而非硬编码 50
        const data = await codemaoApi.searchPosts(keyword, 1, limit);
        if (!data || !data.items) return { count: 0, authorIds: [] };

        let count = 0;
        const authorIds = new Set();

        for (const post of data.items) {
            const workIdMatch = post.content?.match(/\/work\/(\d+)/);
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
        // L3: 补充错误日志
        console.error('seedData 错误:', error.message);
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
