/**
 * 并发竞态条件测试
 * 验证关键操作的并发安全性
 */

const { sequelize, User, Studio, StudioMember, Follow, Favorite, Work } = require('../models');
const DbAdapter = require('../utils/dbAdapter');
const { Op } = require('sequelize');

// 测试辅助函数
async function setupTestDB() {
    await sequelize.sync({ force: true });
    
    // 创建测试用户
    const user1 = await DbAdapter.create(User, {
        codemao_user_id: 'test_user_1',
        username: 'test_user_1',
        email: 'test1@example.com',
        password: 'test_password',
        nickname: '测试用户1',
        role: 'user',
        status: 'active'
    });
    
    const user2 = await DbAdapter.create(User, {
        codemao_user_id: 'test_user_2',
        username: 'test_user_2',
        email: 'test2@example.com',
        password: 'test_password',
        nickname: '测试用户2',
        role: 'user',
        status: 'active'
    });
    
    return { user1, user2 };
}

async function cleanupTestDB() {
    await sequelize.drop();
}

// 测试1: 工作室创建并发竞态
async function testStudioCreationRaceCondition() {
    console.log('\n=== 测试工作室创建并发竞态 ===');
    
    const { user1 } = await setupTestDB();
    
    // 模拟并发创建两个工作室
    const createStudio = async (name) => {
        const transaction = await sequelize.transaction();
        try {
            const existingOwner = await DbAdapter.findOne(Studio, {
                where: { owner_id: user1.id, status: { [Op.ne]: 'banned' } },
                lock: true,
                transaction
            });
            
            if (existingOwner) {
                await transaction.rollback();
                return { success: false, error: '已创建过工作室' };
            }
            
            const studio = await DbAdapter.create(Studio, {
                name,
                owner_id: user1.id,
                status: 'active'
            }, { transaction });
            
            await DbAdapter.create(StudioMember, {
                studio_id: studio.id,
                user_id: user1.id,
                role: 'owner',
                status: 'active'
            }, { transaction });
            
            await transaction.commit();
            return { success: true, studio };
        } catch (error) {
            await transaction.rollback();
            if (error.name === 'SequelizeUniqueConstraintError') {
                return { success: false, error: '唯一约束冲突' };
            }
            return { success: false, error: error.message };
        }
    };
    
    // 并发执行
    const results = await Promise.all([
        createStudio('工作室A'),
        createStudio('工作室B')
    ]);
    
    // 验证结果：只有一个应该成功
    const successCount = results.filter(r => r.success).length;
    console.log(`结果: ${successCount} 个工作室创建成功`);
    
    if (successCount === 1) {
        console.log('✅ 测试通过：并发创建被正确阻止');
    } else {
        console.log('❌ 测试失败：应该只有一个工作室创建成功');
    }
    
    await cleanupTestDB();
    return successCount === 1;
}

// 测试2: 关注并发竞态
async function testFollowRaceCondition() {
    console.log('\n=== 测试关注并发竞态 ===');
    
    const { user1, user2 } = await setupTestDB();
    
    const followUser = async (follower, target) => {
        const transaction = await sequelize.transaction();
        try {
            const [follow, created] = await DbAdapter.findOrCreate(Follow, {
                where: { follower_id: follower.id, following_id: target.id },
                defaults: {
                    follower_id: follower.id,
                    following_id: target.id
                },
                lock: true,
                transaction
            });
            
            if (!created) {
                await transaction.rollback();
                return { success: false, error: '已关注' };
            }
            
            await follower.increment('following_count', { transaction });
            await target.increment('follower_count', { transaction });
            
            await transaction.commit();
            return { success: true };
        } catch (error) {
            await transaction.rollback();
            if (error.name === 'SequelizeUniqueConstraintError') {
                return { success: false, error: '唯一约束冲突' };
            }
            return { success: false, error: error.message };
        }
    };
    
    // 并发关注同一个用户
    const results = await Promise.all([
        followUser(user1, user2),
        followUser(user1, user2)
    ]);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`结果: ${successCount} 次关注成功`);
    
    if (successCount === 1) {
        console.log('✅ 测试通过：并发重复关注被正确阻止');
    } else {
        console.log('❌ 测试失败：应该只有一次关注成功');
    }
    
    await cleanupTestDB();
    return successCount === 1;
}

// 测试3: 收藏并发竞态
async function testFavoriteRaceCondition() {
    console.log('\n=== 测试收藏并发竞态 ===');
    
    const { user1 } = await setupTestDB();
    
    const work = await DbAdapter.create(Work, {
        codemao_work_id: 'test_work_1',
        name: '测试作品',
        user_id: user1.id,
        status: 'published'
    });
    
    const addFavorite = async (user, workId) => {
        const transaction = await sequelize.transaction();
        try {
            const workInstance = await DbAdapter.findByPk(Work, workId, { lock: true, transaction });
            
            const [favorite, created] = await DbAdapter.findOrCreate(Favorite, {
                where: { user_id: user.id, work_id: workId },
                defaults: {
                    user_id: user.id,
                    work_id: workId
                },
                transaction
            });
            
            if (!created) {
                await transaction.rollback();
                return { success: false, error: '已收藏' };
            }
            
            await workInstance.increment('collection_times', { transaction });
            
            await transaction.commit();
            return { success: true };
        } catch (error) {
            await transaction.rollback();
            if (error.name === 'SequelizeUniqueConstraintError') {
                return { success: false, error: '唯一约束冲突' };
            }
            return { success: false, error: error.message };
        }
    };
    
    // 并发收藏同一个作品
    const results = await Promise.all([
        addFavorite(user1, work.id),
        addFavorite(user1, work.id)
    ]);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`结果: ${successCount} 次收藏成功`);
    
    if (successCount === 1) {
        console.log('✅ 测试通过：并发重复收藏被正确阻止');
    } else {
        console.log('❌ 测试失败：应该只有一次收藏成功');
    }
    
    await cleanupTestDB();
    return successCount === 1;
}

// 运行所有测试
async function runAllTests() {
    console.log('开始并发竞态条件测试...\n');
    
    const results = {
        studioCreation: await testStudioCreationRaceCondition(),
        follow: await testFollowRaceCondition(),
        favorite: await testFavoriteRaceCondition()
    };
    
    console.log('\n=== 测试结果汇总 ===');
    console.log(`工作室创建: ${results.studioCreation ? '✅ 通过' : '❌ 失败'}`);
    console.log(`关注操作: ${results.follow ? '✅ 通过' : '❌ 失败'}`);
    console.log(`收藏操作: ${results.favorite ? '✅ 通过' : '❌ 失败'}`);
    
    const allPassed = Object.values(results).every(r => r);
    console.log(`\n总体结果: ${allPassed ? '✅ 所有测试通过' : '❌ 存在失败的测试'}`);
    
    process.exit(allPassed ? 0 : 1);
}

// 如果直接运行此文件
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    testStudioCreationRaceCondition,
    testFollowRaceCondition,
    testFavoriteRaceCondition,
    runAllTests
};