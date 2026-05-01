/**
 * 统计数据模型
 * 存储网站访问统计信息
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Statistics = sequelize.define('Statistics', {
    // 统计ID（主键，自增）
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '统计ID'
    },
    // 统计日期
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true,
        comment: '统计日期'
    },
    // 访问量（PV）
    page_views: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '页面访问量'
    },
    // 独立访客数（UV）
    unique_visitors: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '独立访客数'
    },
    // 新注册用户数
    new_users: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '新注册用户数'
    },
    // 新发布作品数
    new_works: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '新发布作品数'
    }
}, {
    tableName: 'statistics',
    comment: '统计表'
});

module.exports = Statistics;
