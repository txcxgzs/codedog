/**
 * 数据库模型定义
 * 使用Sequelize ORM，支持SQLite和MySQL
 *
 * 修复说明（H16/M3-M10/M21-M25/L8）：
 * - 所有模型改为 timestamps:true + underscored:true，由 Sequelize 自动管理 created_at/updated_at
 * - Work.user_id 改为 allowNull:false（M3）
 * - StudioMember/StudioWork 补复合唯一索引（M4/M5）
 * - Studio/StudioWork/Report/SensitiveWord.status 改为 ENUM（M7）
 * - Follow 加 beforeCreate hook 防止自关注（M8）
 * - Comment 自引用加 onDelete:'SET NULL'（M10）
 * - 高频查询字段补索引（M21/M22）
 * - Post.tags getter 返回 [] 而非 null（M24）
 * - RolePermission.permissions 加 JSON get/set（M25）
 * - User.codemao_token 标注 TODO 待加密（L8）
 */

require('dotenv').config();

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

console.log('📦 加载Sequelize模型');

// H16: 统一 timestamps 选项，供所有模型复用，由 Sequelize 自动维护 created_at/updated_at
const TIMESTAMP_OPTS = {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
};

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
    // L8 TODO: codemao_token 当前明文存储，后续需引入密钥管理（如 AES-256-GCM）加密后再落库
    codemao_token: { type: DataTypes.TEXT },
    role: { type: DataTypes.ENUM('user', 'reviewer', 'moderator', 'admin', 'superadmin'), defaultValue: 'user' },
    status: { type: DataTypes.ENUM('active', 'disabled'), defaultValue: 'active' },
    token_version: { type: DataTypes.INTEGER, defaultValue: 0 },
    // 密码修改时间戳，adminController 重置密码时更新此字段，用于强制旧 token 失效等场景
    password_changed_at: { type: DataTypes.DATE, allowNull: true },
    is_active_dalao: { type: DataTypes.BOOLEAN, defaultValue: false }
}, Object.assign({ tableName: 'users' }, TIMESTAMP_OPTS));

const Work = sequelize.define('Work', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codemao_work_id: { type: DataTypes.STRING(50), unique: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    preview: { type: DataTypes.STRING(500) },
    type: { type: DataTypes.STRING(50) },
    ide_type: { type: DataTypes.STRING(50), defaultValue: 'KITTEN' },
    work_url: { type: DataTypes.STRING(500) },
    // M3: user_id 必填，作品必须归属某个用户
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    codemao_author_id: { type: DataTypes.STRING(50) },
    codemao_author_name: { type: DataTypes.STRING(100) },
    view_times: { type: DataTypes.INTEGER, defaultValue: 0 },
    praise_times: { type: DataTypes.INTEGER, defaultValue: 0 },
    collection_times: { type: DataTypes.INTEGER, defaultValue: 0 },
    comment_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM('pending', 'published', 'rejected', 'deleted'), defaultValue: 'published' },
    is_featured: { type: DataTypes.BOOLEAN, defaultValue: false }
}, Object.assign({
    tableName: 'works',
    // M21: 高频查询字段索引（status/user_id/created_at）
    indexes: [
        { fields: ['status'] },
        { fields: ['user_id'] },
        { fields: ['created_at'] }
    ]
}, TIMESTAMP_OPTS));

const Comment = sequelize.define('Comment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    work_id: { type: DataTypes.INTEGER },
    post_id: { type: DataTypes.INTEGER },
    parent_id: { type: DataTypes.INTEGER },
    reply_to_user_id: { type: DataTypes.INTEGER },
    like_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM('active', 'hidden', 'deleted'), defaultValue: 'active' }
}, Object.assign({
    tableName: 'comments',
    // M21: 评论按 work_id/post_id/status/parent_id 高频查询
    indexes: [
        { fields: ['work_id'] },
        { fields: ['post_id'] },
        { fields: ['status'] },
        { fields: ['parent_id'] }
    ]
}, TIMESTAMP_OPTS));

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
    // 中·绕过隐藏: 区分 AI 隐藏 vs 管理员手动隐藏。
    // 'ai_review' = AI 审核触发自动隐藏,编辑后审核通过可自动恢复 published;
    // 'manual' 或 null  = 管理员手动隐藏,用户编辑不能绕过
    hidden_reason: { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
    // M6: status ENUM 不含 active（app.js 启动时已迁移 active→published）
    status: { type: DataTypes.ENUM('published', 'draft', 'hidden', 'deleted'), defaultValue: 'published' },
    tags: {
        type: DataTypes.TEXT,
        // M24: getter 统一返回数组，无值时返回 [] 而非 null
        get() {
            const val = this.getDataValue('tags');
            if (!val) return [];
            try {
                return JSON.parse(val);
            } catch (e) {
                console.error('解析tags JSON失败:', e);
                return [];
            }
        },
        set(val) {
            this.setDataValue('tags', val ? JSON.stringify(val) : null);
        }
    }
}, Object.assign({
    tableName: 'posts',
    // M21: 帖子按 status/user_id/category 高频查询
    indexes: [
        { fields: ['status'] },
        { fields: ['user_id'] },
        { fields: ['category'] }
    ]
}, TIMESTAMP_OPTS));

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
    // M7: status 改为 ENUM，覆盖 controller 实际使用的 active/pending/banned，预留 dissolved
    status: { type: DataTypes.ENUM('active', 'pending', 'dissolved', 'banned'), defaultValue: 'active' },
    // 修复: owner_claim 用于数据库级"每人一个工作室"并发保护
    // 当 status != 'banned' 时等于 owner_id,banned 时为 NULL
    // 唯一索引允许多个 NULL,因此被封禁的工作室不会阻止用户创建新工作室
    owner_claim: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null }
}, Object.assign({ tableName: 'studios', indexes: [
    { name: 'owner_claim_unique', unique: true, fields: ['owner_claim'] }
] }, TIMESTAMP_OPTS));

const StudioMember = sequelize.define('StudioMember', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    studio_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.ENUM('owner', 'vice_owner', 'admin', 'member'), defaultValue: 'member' },
    status: { type: DataTypes.ENUM('active', 'pending', 'rejected'), defaultValue: 'active' },
    joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, Object.assign({
    tableName: 'studio_members',
    // M4: (studio_id, user_id) 复合唯一索引，防止同一用户重复加入同一工作室
    // 注意：旧库若已存在重复数据，SQLite sync 不会强制检查，需另行去重
    indexes: [
        { unique: true, fields: ['studio_id', 'user_id'], name: 'unique_studio_member' }
    ]
}, TIMESTAMP_OPTS));

const StudioWork = sequelize.define('StudioWork', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    studio_id: { type: DataTypes.INTEGER, allowNull: false },
    work_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    score: { type: DataTypes.INTEGER, defaultValue: 0 },
    // M7: status 改为 ENUM，覆盖 controller 实际使用的 pending/approved/rejected/down
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'down'), defaultValue: 'pending' },
    reviewed_by: { type: DataTypes.INTEGER },
    reviewed_at: { type: DataTypes.DATE },
    added_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, Object.assign({
    tableName: 'studio_works',
    // M5: (studio_id, work_id) 复合唯一索引，防止同一作品重复加入同一工作室
    indexes: [
        { unique: true, fields: ['studio_id', 'work_id'], name: 'unique_studio_work' }
    ]
}, TIMESTAMP_OPTS));

const Report = sequelize.define('Report', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: { type: DataTypes.STRING(20), allowNull: false },
    // M9: target_id 为多态外键（可指向 Work/Comment/Post），故不建数据库级 FK 约束
    // 删除目标对象时需由 controller 层同步清理 Report（已在 controller 修复）
    target_id: { type: DataTypes.INTEGER, allowNull: false },
    reporter_id: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    // M7: status 改为 ENUM，覆盖 controller 实际使用的 pending/resolved/rejected，预留 processing
    status: { type: DataTypes.ENUM('pending', 'processing', 'resolved', 'rejected'), defaultValue: 'pending' },
    handler_id: { type: DataTypes.INTEGER },
    handle_note: { type: DataTypes.TEXT },
    ai_result: { type: DataTypes.TEXT }
}, Object.assign({
    tableName: 'reports',
    // M21: 举报按 status/reporter_id 高频查询
    indexes: [
        { fields: ['status'] },
        { fields: ['reporter_id'] }
    ]
}, TIMESTAMP_OPTS));

const Like = sequelize.define('Like', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    work_id: { type: DataTypes.INTEGER },
    post_id: { type: DataTypes.INTEGER },
    comment_id: { type: DataTypes.INTEGER }
}, Object.assign({
    tableName: 'likes',
    validate: {
        hasTarget() {
            const targets = [this.work_id, this.post_id, this.comment_id].filter(Boolean);
            if (targets.length !== 1) {
                throw new Error('点赞记录必须且只能关联一个目标');
            }
        }
    },
    indexes: [
        { unique: true, fields: ['user_id', 'work_id'], name: 'unique_like_user_work' },
        { unique: true, fields: ['user_id', 'post_id'], name: 'unique_like_user_post' },
        { unique: true, fields: ['user_id', 'comment_id'], name: 'unique_like_user_comment' },
        // M22: 反向查询索引（按 work_id/post_id/comment_id 查点赞列表）
        { fields: ['work_id'] },
        { fields: ['post_id'] },
        { fields: ['comment_id'] }
    ]
}, TIMESTAMP_OPTS));

const Favorite = sequelize.define('Favorite', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    work_id: { type: DataTypes.INTEGER },
    post_id: { type: DataTypes.INTEGER }
}, Object.assign({
    tableName: 'favorites',
    validate: {
        hasTarget() {
            const targets = [this.work_id, this.post_id].filter(Boolean);
            if (targets.length !== 1) {
                throw new Error('收藏记录必须且只能关联一个目标');
            }
        }
    },
    indexes: [
        { unique: true, fields: ['user_id', 'work_id'], name: 'unique_favorite_user_work' },
        { unique: true, fields: ['user_id', 'post_id'], name: 'unique_favorite_user_post' },
        // M22: 反向查询索引（按 work_id/post_id 查收藏列表）
        { fields: ['work_id'] },
        { fields: ['post_id'] }
    ]
}, TIMESTAMP_OPTS));

const Follow = sequelize.define('Follow', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    follower_id: { type: DataTypes.INTEGER, allowNull: false },
    following_id: { type: DataTypes.INTEGER, allowNull: false }
}, Object.assign({
    tableName: 'follows',
    indexes: [
        { unique: true, fields: ['follower_id', 'following_id'], name: 'unique_follow_pair' },
        // M22: 反向查询索引（按 following_id 查"谁关注了我"）
        { fields: ['following_id'] }
    ]
}, TIMESTAMP_OPTS));

// M8: Follow 模型级校验，禁止自关注（follower_id === following_id）
Follow.addHook('beforeCreate', async (follow, options) => {
    if (follow.follower_id === follow.following_id) {
        throw new Error('不能关注自己');
    }
});

const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    content: { type: DataTypes.TEXT },
    related_id: { type: DataTypes.INTEGER },
    related_type: { type: DataTypes.STRING(50) },
    sender_id: { type: DataTypes.INTEGER },
    is_read: { type: DataTypes.BOOLEAN, defaultValue: false }
}, Object.assign({
    tableName: 'notifications',
    // M21: 通知按 user_id/is_read 高频查询
    indexes: [
        { fields: ['user_id'] },
        { fields: ['is_read'] }
    ]
}, TIMESTAMP_OPTS));

const Announcement = sequelize.define('Announcement', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.ENUM('notice', 'update', 'warning'), defaultValue: 'notice' },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, Object.assign({ tableName: 'announcements' }, TIMESTAMP_OPTS));

const Banner = sequelize.define('Banner', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    image_url: { type: DataTypes.STRING(500), allowNull: false },
    link_url: { type: DataTypes.STRING(500) },
    sort: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    // 来源标识：'codemao' 表示编程猫爬取，'manual' 或 null 表示手工创建
    // 用于爬取轮播图时只清理爬取来源数据，避免误删手工创建的轮播图
    source: { type: DataTypes.STRING(20), allowNull: true, defaultValue: null }
}, Object.assign({ tableName: 'banners' }, TIMESTAMP_OPTS));

const IpBan = sequelize.define('IpBan', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ip: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    reason: { type: DataTypes.STRING(500) },
    banned_by: { type: DataTypes.INTEGER },
    expires_at: { type: DataTypes.DATE }
}, Object.assign({
    tableName: 'ip_bans',
    // M21: IP 封禁按 expires_at 查询过期记录
    indexes: [
        { fields: ['expires_at'] }
    ]
}, TIMESTAMP_OPTS));

const CaptchaStats = sequelize.define('CaptchaStats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: { type: DataTypes.STRING(20), allowNull: false },
    scene: { type: DataTypes.STRING(50) },
    action: { type: DataTypes.STRING(20) },
    ip: { type: DataTypes.STRING(50), allowNull: false },
    user_agent: { type: DataTypes.TEXT }
}, Object.assign({
    tableName: 'captcha_stats',
    // M21: 验证码统计按 created_at 查询（如按天聚合）
    indexes: [
        { fields: ['created_at'] }
    ]
}, TIMESTAMP_OPTS));

const SystemConfig = sequelize.define('SystemConfig', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    config_key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    config_value: { type: DataTypes.TEXT }
}, Object.assign({ tableName: 'system_configs' }, TIMESTAMP_OPTS));

const OperationLog = sequelize.define('OperationLog', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    action: { type: DataTypes.STRING(100), allowNull: false },
    target_type: { type: DataTypes.STRING(50) },
    target_id: { type: DataTypes.INTEGER },
    details: { type: DataTypes.TEXT },
    ip_address: { type: DataTypes.STRING(50) },
    user_agent: { type: DataTypes.TEXT }
}, Object.assign({
    tableName: 'operation_logs',
    // M21: 操作日志按 user_id/created_at 高频查询
    indexes: [
        { fields: ['user_id'] },
        { fields: ['created_at'] }
    ]
}, TIMESTAMP_OPTS));

const RolePermission = sequelize.define('RolePermission', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    role: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(100) },
    level: { type: DataTypes.INTEGER, defaultValue: 0 },
    // M25: permissions 加 JSON get/set，自动序列化/反序列化
    permissions: {
        type: DataTypes.TEXT,
        get() {
            const v = this.getDataValue('permissions');
            // getter 自动把存储的 JSON 字符串解析成数组返回；空值返回空数组
            // （默认值用 [] 而非 {}，因为上层用 .includes 数组方法）
            // 修复双重 JSON.parse bug：getter 始终返回数组，业务层禁止再次 parse
            if (!v) return [];
            if (Array.isArray(v)) return v;
            try {
                const parsed = JSON.parse(v);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                console.error('RolePermission.permissions JSON.parse 失败，回退为空数组:', e.message);
                return [];
            }
        },
        set(v) {
            // setter 把传入的数组序列化为 JSON 字符串存储；空值兜底为空数组
            this.setDataValue('permissions', JSON.stringify(v || []));
        }
    }
}, Object.assign({ tableName: 'role_permissions' }, TIMESTAMP_OPTS));

const Statistics = sequelize.define('Statistics', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    stat_key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    stat_value: { type: DataTypes.BIGINT, defaultValue: 0 },
    stat_date: { type: DataTypes.DATE }
}, Object.assign({ tableName: 'statistics' }, TIMESTAMP_OPTS));

const SensitiveWord = sequelize.define('SensitiveWord', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    word: { type: DataTypes.STRING(200), allowNull: false },
    category: { type: DataTypes.STRING(50) },
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    replacement: { type: DataTypes.STRING(200) },
    // M7: status 改为 ENUM，覆盖 controller 实际使用的 active，预留 disabled
    status: { type: DataTypes.ENUM('active', 'disabled'), defaultValue: 'active' }
}, Object.assign({ tableName: 'sensitive_words' }, TIMESTAMP_OPTS));

User.hasMany(Work, { foreignKey: 'user_id', as: 'works' });
Work.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
User.hasMany(Post, { foreignKey: 'user_id', as: 'posts' });
Post.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
User.hasMany(Comment, { foreignKey: 'user_id', as: 'comments' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Comment.belongsTo(User, { foreignKey: 'reply_to_user_id', as: 'reply_to_user' });
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
// M9: 以下四条为多态关联，target_id 可指向不同表，故 constraints:false 不建 FK
// 删除目标对象时需 controller 层同步清理 Report
Report.belongsTo(Work, { foreignKey: 'target_id', as: 'work', constraints: false });
Report.belongsTo(Comment, { foreignKey: 'target_id', as: 'comment', constraints: false });
Report.belongsTo(Post, { foreignKey: 'target_id', as: 'post', constraints: false });
// P3-10: type='user' 举报的目标用户，target_id 指向 User 本地主键；polymorphic 故 constraints:false
Report.belongsTo(User, { foreignKey: 'target_id', as: 'targetUser', constraints: false });
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

// M10: 自引用关联加 onDelete:'SET NULL'，父评论删除时子评论 parent_id 置空（保留子评论）
// 注意：SQLite 需开启外键支持（PRAGMA foreign_keys=ON），由 database.js 配置
Comment.hasMany(Comment, { foreignKey: 'parent_id', as: 'replies', onDelete: 'SET NULL' });
Comment.belongsTo(Comment, { foreignKey: 'parent_id', as: 'parent' });

module.exports = {
    sequelize,
    User, Work, Comment, Post, Studio, StudioMember, StudioWork,
    Report, Like, Favorite, Follow, Notification, Announcement, Banner, IpBan, CaptchaStats,
    SystemConfig, OperationLog, RolePermission, Statistics, SensitiveWord
};
