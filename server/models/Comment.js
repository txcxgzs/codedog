/**
 * 评论模型
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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

module.exports = Comment;
