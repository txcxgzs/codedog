/**
 * 数据库迁移服务
 * 用于在SQLite和MySQL之间复制数据
 * 只有手动触发才会执行，系统不会自动迁移
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');

class DatabaseMigration {
    constructor() {
        this.sourceDb = null;
        this.targetDb = null;
        this.sourceType = null;
        this.targetType = null;
        this.models = require('../models');
    }

    /**
     * 获取数据库连接
     */
    async getConnection(dbType, config = {}) {
        if (dbType === 'mysql') {
            const sequelize = new Sequelize(
                config.database || process.env.DB_NAME,
                config.user || process.env.DB_USER,
                config.password || process.env.DB_PASSWORD,
                {
                    host: config.host || process.env.DB_HOST,
                    port: config.port || process.env.DB_PORT || 3306,
                    dialect: 'mysql',
                    logging: false
                }
            );
            await sequelize.authenticate();
            return { type: 'mysql', connection: sequelize };
        } else {
            const dbPath = config.path || path.join(__dirname, '../migration_temp.sqlite');
            const sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: dbPath,
                logging: false
            });
            await sequelize.authenticate();
            return { type: 'sqlite', connection: sequelize };
        }
    }

    /**
     * 获取SQL模型
     */
    getSqlModels(sequelize) {
        const User = sequelize.define('User', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            codemao_user_id: { type: DataTypes.STRING(50), unique: true },
            username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
            email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
            password: { type: DataTypes.STRING(255), allowNull: false },
            nickname: { type: DataTypes.STRING(50) },
            avatar: { type: DataTypes.STRING(500) },
            bio: { type: DataTypes.TEXT },
            doing: { type: DataTypes.STRING(200) },
            gender: { type: DataTypes.STRING(20), defaultValue: 'unknown' },
            level: { type: DataTypes.INTEGER, defaultValue: 1 },
            experience: { type: DataTypes.INTEGER, defaultValue: 0 },
            follower_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            following_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            work_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            codemao_token: DataTypes.TEXT,
            role: { type: DataTypes.STRING(20), defaultValue: 'user' },
            status: { type: DataTypes.STRING(20), defaultValue: 'active' },
            is_active_dalao: { type: DataTypes.BOOLEAN, defaultValue: false },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'users', timestamps: false });

        const Work = sequelize.define('Work', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            codemao_work_id: { type: DataTypes.STRING(50), unique: true },
            name: { type: DataTypes.STRING(200), allowNull: false },
            description: DataTypes.TEXT,
            preview: { type: DataTypes.STRING(500) },
            type: { type: DataTypes.STRING(50) },
            ide_type: { type: DataTypes.STRING(50) },
            work_url: { type: DataTypes.STRING(500) },
            user_id: DataTypes.INTEGER,
            codemao_author_id: { type: DataTypes.STRING(50) },
            codemao_author_name: { type: DataTypes.STRING(100) },
            view_times: { type: DataTypes.INTEGER, defaultValue: 0 },
            praise_times: { type: DataTypes.INTEGER, defaultValue: 0 },
            collection_times: { type: DataTypes.INTEGER, defaultValue: 0 },
            comment_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            is_featured: { type: DataTypes.BOOLEAN, defaultValue: false },
            status: { type: DataTypes.STRING(20), defaultValue: 'published' },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'works', timestamps: false });

        const Post = sequelize.define('Post', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            title: { type: DataTypes.STRING(200), allowNull: false },
            content: { type: DataTypes.TEXT, allowNull: false },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            view_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            like_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            comment_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            collection_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            is_top: { type: DataTypes.BOOLEAN, defaultValue: false },
            is_essence: { type: DataTypes.BOOLEAN, defaultValue: false },
            category: { type: DataTypes.STRING(50), defaultValue: 'discussion' },
            cover: { type: DataTypes.STRING(500) },
            status: { type: DataTypes.STRING(20), defaultValue: 'published' },
            tags: DataTypes.TEXT,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'posts', timestamps: false });

        const Comment = sequelize.define('Comment', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            content: { type: DataTypes.TEXT, allowNull: false },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            work_id: DataTypes.INTEGER,
            post_id: DataTypes.INTEGER,
            parent_id: DataTypes.INTEGER,
            reply_to_user_id: DataTypes.INTEGER,
            like_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            status: { type: DataTypes.STRING(20), defaultValue: 'active' },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'comments', timestamps: false });

        const Notification = sequelize.define('Notification', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            type: { type: DataTypes.STRING(50), allowNull: false },
            title: { type: DataTypes.STRING(200) },
            content: DataTypes.TEXT,
            related_id: DataTypes.INTEGER,
            related_type: { type: DataTypes.STRING(50) },
            sender_id: DataTypes.INTEGER,
            is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'notifications', timestamps: false });

        const SystemConfig = sequelize.define('SystemConfig', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            config_key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
            config_value: DataTypes.TEXT,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'system_configs', timestamps: false });

        const Banner = sequelize.define('Banner', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            title: { type: DataTypes.STRING(200), allowNull: false },
            image_url: { type: DataTypes.STRING(500), allowNull: false },
            link_url: { type: DataTypes.STRING(500) },
            sort: { type: DataTypes.INTEGER, defaultValue: 0 },
            is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'banners', timestamps: false });

        const Announcement = sequelize.define('Announcement', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            title: { type: DataTypes.STRING(200), allowNull: false },
            content: { type: DataTypes.TEXT, allowNull: false },
            type: { type: DataTypes.STRING(20), defaultValue: 'notice' },
            is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'announcements', timestamps: false });

        const IpBan = sequelize.define('IpBan', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            ip: { type: DataTypes.STRING(50), allowNull: false, unique: true },
            reason: { type: DataTypes.STRING(500) },
            banned_by: DataTypes.INTEGER,
            expires_at: DataTypes.DATE,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'ip_bans', timestamps: false });

        const Report = sequelize.define('Report', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            type: { type: DataTypes.STRING(20), allowNull: false },
            target_id: { type: DataTypes.INTEGER, allowNull: false },
            reporter_id: { type: DataTypes.INTEGER, allowNull: false },
            reason: { type: DataTypes.STRING(200), allowNull: false },
            description: DataTypes.TEXT,
            status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
            handler_id: DataTypes.INTEGER,
            handle_note: DataTypes.TEXT,
            ai_result: DataTypes.TEXT,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'reports', timestamps: false });

        const Studio = sequelize.define('Studio', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            name: { type: DataTypes.STRING(100), allowNull: false },
            description: DataTypes.TEXT,
            cover: { type: DataTypes.STRING(500) },
            cover_url: { type: DataTypes.STRING(500) },
            owner_id: { type: DataTypes.INTEGER, allowNull: false },
            vice_owner_id: DataTypes.INTEGER,
            member_count: { type: DataTypes.INTEGER, defaultValue: 1 },
            work_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            total_score: { type: DataTypes.INTEGER, defaultValue: 0 },
            points: { type: DataTypes.INTEGER, defaultValue: 0 },
            level: { type: DataTypes.INTEGER, defaultValue: 1 },
            is_public: { type: DataTypes.BOOLEAN, defaultValue: true },
            join_type: { type: DataTypes.STRING(20), defaultValue: 'public' },
            status: { type: DataTypes.STRING(20), defaultValue: 'active' },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'studios', timestamps: false });

        const StudioMember = sequelize.define('StudioMember', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            studio_id: { type: DataTypes.INTEGER, allowNull: false },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            role: { type: DataTypes.STRING(20), defaultValue: 'member' },
            status: { type: DataTypes.STRING(20), defaultValue: 'active' },
            joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'studio_members', timestamps: false });

        const StudioWork = sequelize.define('StudioWork', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            studio_id: { type: DataTypes.INTEGER, allowNull: false },
            work_id: { type: DataTypes.INTEGER, allowNull: false },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            score: { type: DataTypes.INTEGER, defaultValue: 0 },
            status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
            reviewed_by: DataTypes.INTEGER,
            reviewed_at: DataTypes.DATE,
            added_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'studio_works', timestamps: false });

        const Like = sequelize.define('Like', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            work_id: DataTypes.INTEGER,
            post_id: DataTypes.INTEGER,
            comment_id: DataTypes.INTEGER,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'likes', timestamps: false });

        const Favorite = sequelize.define('Favorite', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            work_id: DataTypes.INTEGER,
            post_id: DataTypes.INTEGER,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'favorites', timestamps: false });

        const Follow = sequelize.define('Follow', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            follower_id: { type: DataTypes.INTEGER, allowNull: false },
            following_id: { type: DataTypes.INTEGER, allowNull: false },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'follows', timestamps: false });

        const CaptchaStats = sequelize.define('CaptchaStats', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            type: { type: DataTypes.STRING(20), allowNull: false },
            scene: { type: DataTypes.STRING(50) },
            action: { type: DataTypes.STRING(20) },
            ip: { type: DataTypes.STRING(50), allowNull: false },
            user_agent: DataTypes.TEXT,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'captcha_stats', timestamps: false });

        const OperationLog = sequelize.define('OperationLog', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: DataTypes.INTEGER,
            action: { type: DataTypes.STRING(100), allowNull: false },
            target_type: { type: DataTypes.STRING(50) },
            target_id: DataTypes.INTEGER,
            details: DataTypes.TEXT,
            ip_address: { type: DataTypes.STRING(50) },
            user_agent: DataTypes.TEXT,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'operation_logs', timestamps: false });

        const RolePermission = sequelize.define('RolePermission', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            role: { type: DataTypes.STRING(50), allowNull: false, unique: true },
            name: { type: DataTypes.STRING(100) },
            level: { type: DataTypes.INTEGER, defaultValue: 0 },
            permissions: DataTypes.TEXT,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'role_permissions', timestamps: false });

        const Statistics = sequelize.define('Statistics', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            stat_key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
            stat_value: { type: DataTypes.BIGINT, defaultValue: 0 },
            stat_date: DataTypes.DATE,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'statistics', timestamps: false });

        const SensitiveWord = sequelize.define('SensitiveWord', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            word: { type: DataTypes.STRING(200), allowNull: false },
            category: { type: DataTypes.STRING(50) },
            level: { type: DataTypes.INTEGER, defaultValue: 1 },
            replacement: { type: DataTypes.STRING(200) },
            status: { type: DataTypes.STRING(20), defaultValue: 'active' },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'sensitive_words', timestamps: false });

        return {
            User, Work, Post, Comment, Notification, SystemConfig,
            Banner, Announcement, IpBan, Report, Studio,
            StudioMember, StudioWork, Like, Favorite, Follow,
            CaptchaStats, OperationLog, RolePermission, Statistics, SensitiveWord
        };
    }

    /**
     * 从源数据库读取数据
     */
    async readFromSource(sourceType, sourceConfig, models) {
        console.log(`📖 从 ${sourceType} 读取数据...`);
        const data = {};

        const { connection } = await this.getConnection(sourceType, sourceConfig);
        try {
            const sqlModels = this.getSqlModels(connection);
            await connection.sync();

            data.users = await sqlModels.User.findAll({ raw: true });
            data.works = await sqlModels.Work.findAll({ raw: true });
            data.posts = await sqlModels.Post.findAll({ raw: true });
            data.comments = await sqlModels.Comment.findAll({ raw: true });
            data.notifications = await sqlModels.Notification.findAll({ raw: true });
            data.systemConfigs = await sqlModels.SystemConfig.findAll({ raw: true });
            data.banners = await sqlModels.Banner.findAll({ raw: true });
            data.announcements = await sqlModels.Announcement.findAll({ raw: true });
            data.ipBans = await sqlModels.IpBan.findAll({ raw: true });
            data.reports = await sqlModels.Report.findAll({ raw: true });
            data.studios = await sqlModels.Studio.findAll({ raw: true });
            data.studioMembers = await sqlModels.StudioMember.findAll({ raw: true });
            data.studioWorks = await sqlModels.StudioWork.findAll({ raw: true });
            data.likes = await sqlModels.Like.findAll({ raw: true });
            data.favorites = await sqlModels.Favorite.findAll({ raw: true });
            data.follows = await sqlModels.Follow.findAll({ raw: true });
            data.captchaStats = await sqlModels.CaptchaStats.findAll({ raw: true });
            data.operationLogs = await sqlModels.OperationLog.findAll({ raw: true });
            data.rolePermissions = await sqlModels.RolePermission.findAll({ raw: true });
            data.statistics = await sqlModels.Statistics.findAll({ raw: true });
            data.sensitiveWords = await sqlModels.SensitiveWord.findAll({ raw: true });
        } finally {
            await connection.close();
        }

        console.log(`✅ 读取完成: 用户 ${data.users.length}, 作品 ${data.works.length}, 评论 ${data.comments.length}`);
        return data;
    }

    /**
     * 写入数据到目标数据库
     */
    async writeToTarget(targetType, targetConfig, data, clearExisting = false) {
        console.log(`📝 写入数据到 ${targetType}...`);

        const { connection } = await this.getConnection(targetType, targetConfig);
        try {
            const sqlModels = this.getSqlModels(connection);
            await connection.sync({ force: clearExisting });

            if (data.users.length > 0) await sqlModels.User.bulkCreate(data.users, { ignoreDuplicates: true });
            if (data.works.length > 0) await sqlModels.Work.bulkCreate(data.works, { ignoreDuplicates: true });
            if (data.posts.length > 0) await sqlModels.Post.bulkCreate(data.posts, { ignoreDuplicates: true });
            if (data.comments.length > 0) await sqlModels.Comment.bulkCreate(data.comments, { ignoreDuplicates: true });
            if (data.notifications.length > 0) await sqlModels.Notification.bulkCreate(data.notifications, { ignoreDuplicates: true });
            if (data.systemConfigs.length > 0) await sqlModels.SystemConfig.bulkCreate(data.systemConfigs, { ignoreDuplicates: true });
            if (data.banners.length > 0) await sqlModels.Banner.bulkCreate(data.banners, { ignoreDuplicates: true });
            if (data.announcements.length > 0) await sqlModels.Announcement.bulkCreate(data.announcements, { ignoreDuplicates: true });
            if (data.ipBans.length > 0) await sqlModels.IpBan.bulkCreate(data.ipBans, { ignoreDuplicates: true });
            if (data.reports.length > 0) await sqlModels.Report.bulkCreate(data.reports, { ignoreDuplicates: true });
            if (data.studios.length > 0) await sqlModels.Studio.bulkCreate(data.studios, { ignoreDuplicates: true });
            if (data.studioMembers.length > 0) await sqlModels.StudioMember.bulkCreate(data.studioMembers, { ignoreDuplicates: true });
            if (data.studioWorks.length > 0) await sqlModels.StudioWork.bulkCreate(data.studioWorks, { ignoreDuplicates: true });
            if (data.likes.length > 0) await sqlModels.Like.bulkCreate(data.likes, { ignoreDuplicates: true });
            if (data.favorites.length > 0) await sqlModels.Favorite.bulkCreate(data.favorites, { ignoreDuplicates: true });
            if (data.follows.length > 0) await sqlModels.Follow.bulkCreate(data.follows, { ignoreDuplicates: true });
            if (data.captchaStats.length > 0) await sqlModels.CaptchaStats.bulkCreate(data.captchaStats, { ignoreDuplicates: true });
            if (data.operationLogs.length > 0) await sqlModels.OperationLog.bulkCreate(data.operationLogs, { ignoreDuplicates: true });
            if (data.rolePermissions.length > 0) await sqlModels.RolePermission.bulkCreate(data.rolePermissions, { ignoreDuplicates: true });
            if (data.statistics.length > 0) await sqlModels.Statistics.bulkCreate(data.statistics, { ignoreDuplicates: true });
            if (data.sensitiveWords.length > 0) await sqlModels.SensitiveWord.bulkCreate(data.sensitiveWords, { ignoreDuplicates: true });
        } finally {
            await connection.close();
        }

        console.log(`✅ 写入完成!`);
    }

    /**
     * 执行数据库迁移
     * @param {string} sourceType - 源数据库类型 (sqlite/mysql)
     * @param {object} sourceConfig - 源数据库配置
     * @param {string} targetType - 目标数据库类型 (sqlite/mysql)
     * @param {object} targetConfig - 目标数据库配置
     * @param {boolean} clearExisting - 是否清空目标数据库
     */
    async migrate(sourceType, sourceConfig, targetType, targetConfig, clearExisting = false) {
        console.log(`\n🚀 开始数据库迁移: ${sourceType} -> ${targetType}`);
        console.log('=====================================');

        try {
            const data = await this.readFromSource(sourceType, sourceConfig);

            await this.writeToTarget(targetType, targetConfig, data, clearExisting);

            console.log('=====================================');
            console.log('🎉 数据库迁移完成!');

            return {
                success: true,
                message: '数据库迁移成功',
                stats: {
                    users: data.users.length,
                    works: data.works.length,
                    posts: data.posts.length,
                    comments: data.comments.length,
                    notifications: data.notifications.length,
                    systemConfigs: data.systemConfigs.length,
                    banners: data.banners.length,
                    announcements: data.announcements.length,
                    ipBans: data.ipBans.length,
                    reports: data.reports.length,
                    studios: data.studios.length,
                    studioMembers: data.studioMembers.length,
                    studioWorks: data.studioWorks.length,
                    likes: data.likes.length,
                    favorites: data.favorites.length,
                    follows: data.follows.length,
                    captchaStats: data.captchaStats.length,
                    operationLogs: data.operationLogs.length,
                    rolePermissions: data.rolePermissions.length,
                    statistics: data.statistics.length,
                    sensitiveWords: data.sensitiveWords.length
                }
            };
        } catch (error) {
            console.error('❌ 数据库迁移失败:', error);
            return {
                success: false,
                message: `数据库迁移失败: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * 获取数据库统计信息
     */
    async getStats(dbType, config) {
        try {
            const data = await this.readFromSource(dbType, config);
            return {
                success: true,
                stats: {
                    users: data.users.length,
                    works: data.works.length,
                    posts: data.posts.length,
                    comments: data.comments.length,
                    notifications: data.notifications.length,
                    systemConfigs: data.systemConfigs.length,
                    banners: data.banners.length,
                    announcements: data.announcements.length,
                    ipBans: data.ipBans.length,
                    reports: data.reports.length,
                    studios: data.studios.length,
                    studioMembers: data.studioMembers.length,
                    studioWorks: data.studioWorks.length,
                    likes: data.likes.length,
                    favorites: data.favorites.length,
                    follows: data.follows.length,
                    captchaStats: data.captchaStats.length,
                    operationLogs: data.operationLogs.length,
                    rolePermissions: data.rolePermissions.length,
                    statistics: data.statistics.length,
                    sensitiveWords: data.sensitiveWords.length
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
}

module.exports = new DatabaseMigration();
