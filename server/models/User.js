/**
 * 用户模型
 * 存储用户基本信息
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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

module.exports = User;
