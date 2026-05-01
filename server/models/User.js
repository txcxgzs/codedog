/**
 * 用户模型
 * 存储用户基本信息
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '用户ID'
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: '用户名'
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: '邮箱地址'
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: '密码（bcrypt加密）'
    },
    nickname: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '昵称'
    },
    avatar: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: '/default-avatar.png',
        comment: '头像URL'
    },
    bio: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '个人简介'
    },
    role: {
        type: DataTypes.ENUM('user', 'reviewer', 'moderator', 'admin', 'superadmin'),
        allowNull: false,
        defaultValue: 'user',
        comment: '用户角色'
    },
    status: {
        type: DataTypes.ENUM('active', 'banned'),
        allowNull: false,
        defaultValue: 'active',
        comment: '账户状态'
    },
    level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '用户等级'
    },
    experience: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '经验值'
    },
    codemao_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '编程猫用户ID'
    },
    codemao_token: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '编程猫登录Token'
    },
    codemao_refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '编程猫刷新Token'
    },
    last_login_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '最后登录时间'
    },
    last_login_ip: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '最后登录IP'
    },
    is_active_dalao: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '是否为活跃大佬'
    }
}, {
    tableName: 'users',
    comment: '用户表'
});

module.exports = User;
