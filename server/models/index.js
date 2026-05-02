/**
 * 数据库模型定义
 * 使用Sequelize ORM，支持SQLite和MySQL
 */

require('dotenv').config();

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

console.log('📦 加载Sequelize模型');

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
    gender: { type: DataTypes.ENUM('m', 'f', 'unknown'), defaultValue: 'unknown' },
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    experience: { type: DataTypes.INTEGER, defaultValue: 0 },
    follower_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    following_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    work_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    codemao_token: { type: DataTypes.TEXT },
    role: { type: DataTypes.ENUM('user', 'reviewer', 'moderator', 'admin', 'superadmin'), defaultValue: 'user' },
    status: { type: DataTypes.ENUM('active', 'disabled'), defaultValue: 'active' },
    is_active_dalao: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'users', timestamps: false });

const Work = sequelize.define('Work', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codemao_work_id: { type: DataTypes.STRING(50), unique: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    preview: { type: DataTypes.STRING(500) },
    type: { type: DataTypes.STRING(50) },
    ide_type: { type: DataTypes.STRING(50) },
    work_url: { type: DataTypes.STRING(500) },
    user_id: { type: DataTypes.INTEGER },
    codemao_author_id: { type: DataTypes.STRING(50) },
    codemao_author_name: { type: DataTypes.STRING(100) },
    view_times: { type: DataTypes.INTEGER, defaultValue: 0 },
    praise_times: { type: DataTypes.INTEGER, defaultValue: 0 },
    collection_times: { type: DataTypes.INTEGER, defaultValue: 0 },
    comment_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM('pending', 'published', 'rejected', 'deleted'), defaultValue: 'published' },
    is_featured: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'works', timestamps: false });

const Comment = sequelize.define('Comment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    work_id: { type: DataTypes.INTEGER },
    post_id: { type: DataTypes.INTEGER },
    parent_id: { type: DataTypes.INTEGER },
    reply_to_user_id: { type: DataTypes.INTEGER },
    like_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM('active', 'hidden', 'deleted'), defaultValue: 'active' },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'comments', timestamps: false });

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
    status: { type: DataTypes.ENUM('active', 'published', 'draft', 'hidden', 'deleted'), defaultValue: 'published' },
    tags: { type: DataTypes.TEXT, get() { const val = this.getDataValue('tags'); return val ? JSON.parse(val) : null; }, set(val) { this.setDataValue('tags', val ? JSON.stringify(val) : null); } },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'posts', timestamps: false });

const Studio = sequelize.define('Studio', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT },
    cover: { type: DataTypes.STRING(500) },
    cover_url: { type: DataTypes.STRING(500) },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    vice_owner_id: { type: DataTypes.INTEGER },
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
    role: { type: DataTypes.ENUM('owner', 'vice_owner', 'admin', 'member'), defaultValue: 'member' },
    status: { type: DataTypes.ENUM('active', 'pending', 'rejected'), defaultValue: 'active' },
    joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'studio_members', timestamps: false });

const StudioWork = sequelize.define('StudioWork', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    studio_id: { type: DataTypes.INTEGER, allowNull: false },
    work_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    score: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
    reviewed_by: { type: DataTypes.INTEGER },
    reviewed_at: { type: DataTypes.DATE },
    added_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'studio_works', timestamps: false });

const Report = sequelize.define('Report', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: { type: DataTypes.STRING(20), allowNull: false },
    target_id: { type: DataTypes.INTEGER, allowNull: false },
    reporter_id: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
    handler_id: { type: DataTypes.INTEGER },
    handle_note: { type: DataTypes.TEXT },
    ai_result: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'reports', timestamps: false });

const Like = sequelize.define('Like', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    work_id: { type: DataTypes.INTEGER },
    post_id: { type: DataTypes.INTEGER },
    comment_id: { type: DataTypes.INTEGER },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'likes', timestamps: false });

const Favorite = sequelize.define('Favorite', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    work_id: { type: DataTypes.INTEGER },
    post_id: { type: DataTypes.INTEGER },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'favorites', timestamps: false });

const Follow = sequelize.define('Follow', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    follower_id: { type: DataTypes.INTEGER, allowNull: false },
    following_id: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'follows', timestamps: false });

const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    content: { type: DataTypes.TEXT },
    related_id: { type: DataTypes.INTEGER },
    related_type: { type: DataTypes.STRING(50) },
    sender_id: { type: DataTypes.INTEGER },
    is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'notifications', timestamps: false });

const Announcement = sequelize.define('Announcement', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.ENUM('notice', 'update', 'warning'), defaultValue: 'notice' },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'announcements', timestamps: false });

const Banner = sequelize.define('Banner', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    image_url: { type: DataTypes.STRING(500), allowNull: false },
    link_url: { type: DataTypes.STRING(500) },
    sort: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'banners', timestamps: false });

const IpBan = sequelize.define('IpBan', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ip: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    reason: { type: DataTypes.STRING(500) },
    banned_by: { type: DataTypes.INTEGER },
    expires_at: { type: DataTypes.DATE },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'ip_bans', timestamps: false });

const CaptchaStats = sequelize.define('CaptchaStats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: { type: DataTypes.STRING(20), allowNull: false },
    scene: { type: DataTypes.STRING(50) },
    action: { type: DataTypes.STRING(20) },
    ip: { type: DataTypes.STRING(50), allowNull: false },
    user_agent: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'captcha_stats', timestamps: false });

const SystemConfig = sequelize.define('SystemConfig', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    config_key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    config_value: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'system_configs', timestamps: false });

const OperationLog = sequelize.define('OperationLog', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    action: { type: DataTypes.STRING(100), allowNull: false },
    target_type: { type: DataTypes.STRING(50) },
    target_id: { type: DataTypes.INTEGER },
    details: { type: DataTypes.TEXT },
    ip_address: { type: DataTypes.STRING(50) },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'operation_logs', timestamps: false });

const RolePermission = sequelize.define('RolePermission', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    role: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(100) },
    level: { type: DataTypes.INTEGER, defaultValue: 0 },
    permissions: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'role_permissions', timestamps: false });

const Statistics = sequelize.define('Statistics', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    stat_key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    stat_value: { type: DataTypes.BIGINT, defaultValue: 0 },
    stat_date: { type: DataTypes.DATE },
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

User.hasMany(Work, { foreignKey: 'user_id', as: 'works' });
Work.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
User.hasMany(Post, { foreignKey: 'user_id', as: 'posts' });
Post.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
User.hasMany(Comment, { foreignKey: 'user_id', as: 'comments' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Comment.belongsTo(Work, { foreignKey: 'work_id', as: 'work' });
Work.hasMany(Comment, { foreignKey: 'work_id', as: 'comments' });
Comment.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
Post.hasMany(Comment, { foreignKey: 'post_id', as: 'comments' });
User.hasMany(Studio, { foreignKey: 'owner_id', as: 'owned_studios' });
Studio.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
StudioMember.belongsTo(Studio, { foreignKey: 'studio_id', as: 'studio' });
StudioMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Studio.hasMany(StudioMember, { foreignKey: 'studio_id', as: 'members' });
StudioWork.belongsTo(Studio, { foreignKey: 'studio_id', as: 'studio' });
StudioWork.belongsTo(Work, { foreignKey: 'work_id', as: 'work' });
StudioWork.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Report.belongsTo(User, { foreignKey: 'reporter_id', as: 'reporter' });
Report.belongsTo(User, { foreignKey: 'handler_id', as: 'handler' });
User.hasMany(Report, { foreignKey: 'reporter_id', as: 'reports' });
User.hasMany(Report, { foreignKey: 'handler_id', as: 'handled_reports' });
Favorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Favorite.belongsTo(Work, { foreignKey: 'work_id', as: 'work' });
Favorite.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
User.hasMany(Favorite, { foreignKey: 'user_id', as: 'favorites' });
Work.hasMany(Favorite, { foreignKey: 'work_id', as: 'favorites' });
Post.hasMany(Favorite, { foreignKey: 'post_id', as: 'favorites' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Notification.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
OperationLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(OperationLog, { foreignKey: 'user_id', as: 'operation_logs' });

Like.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Like.belongsTo(Work, { foreignKey: 'work_id', as: 'work' });
Like.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
Like.belongsTo(Comment, { foreignKey: 'comment_id', as: 'comment' });
User.hasMany(Like, { foreignKey: 'user_id', as: 'likes' });
Work.hasMany(Like, { foreignKey: 'work_id', as: 'likes' });
Post.hasMany(Like, { foreignKey: 'post_id', as: 'likes' });
Comment.hasMany(Like, { foreignKey: 'comment_id', as: 'likes' });

Follow.belongsTo(User, { foreignKey: 'follower_id', as: 'follower' });
Follow.belongsTo(User, { foreignKey: 'following_id', as: 'following' });
User.hasMany(Follow, { foreignKey: 'follower_id', as: 'following_list' });
User.hasMany(Follow, { foreignKey: 'following_id', as: 'follower_list' });

Comment.hasMany(Comment, { foreignKey: 'parent_id', as: 'replies' });
Comment.belongsTo(Comment, { foreignKey: 'parent_id', as: 'parent' });
Comment.belongsTo(User, { foreignKey: 'reply_to_user_id', as: 'reply_to_user' });

module.exports = {
    sequelize,
    User, Work, Comment, Post, Studio, StudioMember, StudioWork,
    Report, Like, Favorite, Follow, Notification, Announcement, Banner, IpBan, CaptchaStats,
    SystemConfig, OperationLog, RolePermission, Statistics, SensitiveWord
};
