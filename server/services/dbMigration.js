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
            // 安全处理 SQLite 数据库路径，防止路径遍历
            let dbPath = config.path;
            if (dbPath) {
                // 移除路径中的危险字符和模式
                dbPath = dbPath.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
                // 确保路径不在服务器根目录之外
                if (path.isAbsolute(dbPath)) {
                    throw new Error('不支持绝对路径，仅允许相对路径在服务器指定目录内');
                }
            }
            // 默认使用安全路径
            if (!dbPath) {
                dbPath = path.join(__dirname, '../migration_temp.sqlite');
            } else {
                dbPath = path.join(__dirname, '../', dbPath);
            }
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
            codemao_user_id: { type: DataTypes.STRING, unique: true },
            codemao_id: DataTypes.STRING,
            username: { type: DataTypes.STRING, allowNull: false, unique: true },
            email: { type: DataTypes.STRING, allowNull: false, unique: true },
            password: { type: DataTypes.STRING, allowNull: false },
            nickname: DataTypes.STRING,
            avatar: DataTypes.STRING,
            bio: DataTypes.TEXT,
            doing: DataTypes.STRING,
            role: { type: DataTypes.STRING, defaultValue: 'user' },
            status: { type: DataTypes.STRING, defaultValue: 'active' },
            level: { type: DataTypes.INTEGER, defaultValue: 1 },
            follower_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            following_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            work_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            codemao_token: DataTypes.TEXT,
            last_login_at: DataTypes.DATE,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'users', timestamps: false });

        const Work = sequelize.define('Work', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            codemao_work_id: { type: DataTypes.STRING, unique: true },
            name: { type: DataTypes.STRING, allowNull: false },
            description: DataTypes.TEXT,
            preview: DataTypes.STRING,
            type: DataTypes.STRING,
            ide_type: DataTypes.STRING,
            work_url: DataTypes.STRING,
            user_id: DataTypes.INTEGER,
            codemao_author_id: DataTypes.STRING,
            codemao_author_name: DataTypes.STRING,
            view_times: { type: DataTypes.INTEGER, defaultValue: 0 },
            praise_times: { type: DataTypes.INTEGER, defaultValue: 0 },
            collection_times: { type: DataTypes.INTEGER, defaultValue: 0 },
            comment_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            is_featured: { type: DataTypes.BOOLEAN, defaultValue: false },
            status: { type: DataTypes.STRING, defaultValue: 'published' },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'works', timestamps: false });

        const Comment = sequelize.define('Comment', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            content: { type: DataTypes.TEXT, allowNull: false },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            work_id: DataTypes.INTEGER,
            post_id: DataTypes.INTEGER,
            parent_id: DataTypes.INTEGER,
            like_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            status: { type: DataTypes.STRING, defaultValue: 'normal' },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'comments', timestamps: false });

        const Notification = sequelize.define('Notification', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            type: { type: DataTypes.STRING, allowNull: false },
            title: DataTypes.STRING,
            content: DataTypes.TEXT,
            related_id: DataTypes.INTEGER,
            related_type: DataTypes.STRING,
            sender_id: DataTypes.INTEGER,
            is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'notifications', timestamps: false });

        const SystemConfig = sequelize.define('SystemConfig', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            config_key: { type: DataTypes.STRING, allowNull: false, unique: true },
            config_value: DataTypes.TEXT,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'system_configs', timestamps: false });

        const Banner = sequelize.define('Banner', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            title: { type: DataTypes.STRING, allowNull: false },
            image_url: { type: DataTypes.STRING, allowNull: false },
            link_url: DataTypes.STRING,
            sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
            status: { type: DataTypes.STRING, defaultValue: 'active' },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'banners', timestamps: false });

        const Announcement = sequelize.define('Announcement', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            title: { type: DataTypes.STRING, allowNull: false },
            content: { type: DataTypes.TEXT, allowNull: false },
            type: { type: DataTypes.STRING, defaultValue: 'normal' },
            status: { type: DataTypes.STRING, defaultValue: 'published' },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'announcements', timestamps: false });

        const IpBan = sequelize.define('IpBan', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            ip: { type: DataTypes.STRING, allowNull: false, unique: true },
            reason: DataTypes.STRING,
            banned_by: DataTypes.INTEGER,
            expires_at: DataTypes.DATE,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'ip_bans', timestamps: false });

        const Report = sequelize.define('Report', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            reporter_id: { type: DataTypes.INTEGER, allowNull: false },
            reported_user_id: DataTypes.INTEGER,
            reported_work_id: DataTypes.INTEGER,
            reported_comment_id: DataTypes.INTEGER,
            type: { type: DataTypes.STRING, allowNull: false },
            reason: DataTypes.TEXT,
            status: { type: DataTypes.STRING, defaultValue: 'pending' },
            handled_by: DataTypes.INTEGER,
            handle_result: DataTypes.TEXT,
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'reports', timestamps: false });

        const Studio = sequelize.define('Studio', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            name: { type: DataTypes.STRING, allowNull: false },
            description: DataTypes.TEXT,
            logo: DataTypes.STRING,
            cover: DataTypes.STRING,
            owner_id: { type: DataTypes.INTEGER, allowNull: false },
            member_count: { type: DataTypes.INTEGER, defaultValue: 1 },
            work_count: { type: DataTypes.INTEGER, defaultValue: 0 },
            status: { type: DataTypes.STRING, defaultValue: 'active' },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'studios', timestamps: false });

        const StudioMember = sequelize.define('StudioMember', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            studio_id: { type: DataTypes.INTEGER, allowNull: false },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            role: { type: DataTypes.STRING, defaultValue: 'member' },
            status: { type: DataTypes.STRING, defaultValue: 'active' },
            joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'studio_members', timestamps: false });

        const Favorite = sequelize.define('Favorite', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            work_id: { type: DataTypes.INTEGER, allowNull: false },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'favorites', timestamps: false });

        const Follow = sequelize.define('Follow', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            follower_id: { type: DataTypes.INTEGER, allowNull: false },
            following_id: { type: DataTypes.INTEGER, allowNull: false },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        }, { tableName: 'follows', timestamps: false });

        return {
            User, Work, Comment, Notification, SystemConfig,
            Banner, Announcement, IpBan, Report, Studio,
            StudioMember, Favorite, Follow
        };
    }

    /**
     * 从源数据库读取数据
     */
    async readFromSource(sourceType, sourceConfig, models) {
        console.log(`📖 从 ${sourceType} 读取数据...`);
        const data = {};

        const { connection } = await this.getConnection(sourceType, sourceConfig);
        const sqlModels = this.getSqlModels(connection);
        await connection.sync();

        data.users = await sqlModels.User.findAll({ raw: true });
        data.works = await sqlModels.Work.findAll({ raw: true });
        data.comments = await sqlModels.Comment.findAll({ raw: true });
        data.notifications = await sqlModels.Notification.findAll({ raw: true });
        data.systemConfigs = await sqlModels.SystemConfig.findAll({ raw: true });
        data.banners = await sqlModels.Banner.findAll({ raw: true });
        data.announcements = await sqlModels.Announcement.findAll({ raw: true });
        data.ipBans = await sqlModels.IpBan.findAll({ raw: true });
        data.reports = await sqlModels.Report.findAll({ raw: true });
        data.studios = await sqlModels.Studio.findAll({ raw: true });
        data.studioMembers = await sqlModels.StudioMember.findAll({ raw: true });
        data.favorites = await sqlModels.Favorite.findAll({ raw: true });
        data.follows = await sqlModels.Follow.findAll({ raw: true });

        await connection.close();

        console.log(`✅ 读取完成: 用户 ${data.users.length}, 作品 ${data.works.length}, 评论 ${data.comments.length}`);
        return data;
    }

    /**
     * 写入数据到目标数据库
     */
    async writeToTarget(targetType, targetConfig, data, clearExisting = false) {
        console.log(`📝 写入数据到 ${targetType}...`);

        const { connection } = await this.getConnection(targetType, targetConfig);
        const sqlModels = this.getSqlModels(connection);
        await connection.sync({ force: clearExisting });

        if (data.users.length > 0) await sqlModels.User.bulkCreate(data.users, { ignoreDuplicates: true });
        if (data.works.length > 0) await sqlModels.Work.bulkCreate(data.works, { ignoreDuplicates: true });
        if (data.comments.length > 0) await sqlModels.Comment.bulkCreate(data.comments, { ignoreDuplicates: true });
        if (data.notifications.length > 0) await sqlModels.Notification.bulkCreate(data.notifications, { ignoreDuplicates: true });
        if (data.systemConfigs.length > 0) await sqlModels.SystemConfig.bulkCreate(data.systemConfigs, { ignoreDuplicates: true });
        if (data.banners.length > 0) await sqlModels.Banner.bulkCreate(data.banners, { ignoreDuplicates: true });
        if (data.announcements.length > 0) await sqlModels.Announcement.bulkCreate(data.announcements, { ignoreDuplicates: true });
        if (data.ipBans.length > 0) await sqlModels.IpBan.bulkCreate(data.ipBans, { ignoreDuplicates: true });
        if (data.reports.length > 0) await sqlModels.Report.bulkCreate(data.reports, { ignoreDuplicates: true });
        if (data.studios.length > 0) await sqlModels.Studio.bulkCreate(data.studios, { ignoreDuplicates: true });
        if (data.studioMembers.length > 0) await sqlModels.StudioMember.bulkCreate(data.studioMembers, { ignoreDuplicates: true });
        if (data.favorites.length > 0) await sqlModels.Favorite.bulkCreate(data.favorites, { ignoreDuplicates: true });
        if (data.follows.length > 0) await sqlModels.Follow.bulkCreate(data.follows, { ignoreDuplicates: true });

        await connection.close();

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
                    comments: data.comments.length,
                    notifications: data.notifications.length,
                    systemConfigs: data.systemConfigs.length,
                    banners: data.banners.length,
                    announcements: data.announcements.length,
                    ipBans: data.ipBans.length,
                    reports: data.reports.length,
                    studios: data.studios.length,
                    studioMembers: data.studioMembers.length,
                    favorites: data.favorites.length,
                    follows: data.follows.length
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
                    comments: data.comments.length,
                    notifications: data.notifications.length,
                    systemConfigs: data.systemConfigs.length,
                    banners: data.banners.length,
                    announcements: data.announcements.length,
                    ipBans: data.ipBans.length,
                    reports: data.reports.length,
                    studios: data.studios.length,
                    studioMembers: data.studioMembers.length,
                    favorites: data.favorites.length,
                    follows: data.follows.length
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
