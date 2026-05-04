/**
 * 验证码统计模型
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CaptchaStats = sequelize.define('CaptchaStats', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type: {
        type: DataTypes.ENUM('geetest', 'hcaptcha'),
        allowNull: false,
        comment: '验证码类型'
    },
    scene: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '验证场景'
    },
    action: {
        type: DataTypes.ENUM('show', 'pass', 'block'),
        allowNull: false,
        comment: '动作: show展示, pass通过, block拦截'
    },
    ip: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IP地址'
    },
    user_agent: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: '用户代理'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'captcha_stats',
    timestamps: false,
    indexes: [
        { fields: ['type'] },
        { fields: ['scene'] },
        { fields: ['action'] },
        { fields: ['created_at'] }
    ]
});

module.exports = CaptchaStats;
