/**
 * 社区帖子模型
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Post = sequelize.define('Post', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    view_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    like_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    comment_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_top: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_essence: { type: DataTypes.BOOLEAN, defaultValue: false },
    category: { type: DataTypes.STRING(50), defaultValue: 'discussion' },
    cover: { type: DataTypes.STRING(500) },
    status: { type: DataTypes.ENUM('active', 'published', 'draft', 'hidden', 'deleted'), defaultValue: 'published' },
    tags: { type: DataTypes.TEXT, get() { const val = this.getDataValue('tags'); return val ? JSON.parse(val) : null; }, set(val) { this.setDataValue('tags', val ? JSON.stringify(val) : null); } },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'posts', timestamps: false });

module.exports = Post;
