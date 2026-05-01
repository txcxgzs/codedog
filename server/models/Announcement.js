/**
 * 公告模型
 * 存储社区公告信息
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Announcement = sequelize.define('Announcement', {
    // 公告ID（主键，自增）
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '公告ID'
    },
    // 公告标题
    title: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: '公告标题'
    },
    // 公告内容
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: '公告内容'
    },
    // 公告类型：notice-通知，event-活动，update-更新
    type: {
        type: DataTypes.ENUM('notice', 'event', 'update'),
        allowNull: false,
        defaultValue: 'notice',
        comment: '公告类型'
    },
    // 是否置顶
    is_pinned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '是否置顶'
    },
    // 是否显示
    is_visible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: '是否显示'
    },
    // 发布者ID
    author_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '发布者ID'
    }
}, {
    tableName: 'announcements',
    comment: '公告表'
});

module.exports = Announcement;
