/**
 * 作品模型
 * 存储用户发布的作品信息
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Work = sequelize.define('Work', {
    // 作品ID（主键，自增）
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '作品ID'
    },
    // 编程猫作品ID
    codemao_work_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        comment: '编程猫作品ID'
    },
    // 作品名称
    name: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: '作品名称'
    },
    // 作品描述
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '作品描述'
    },
    // 作品预览图URL
    preview: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: '作品预览图URL'
    },
    // 作品类型
    type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '作品类型（如：游戏、动画等）'
    },
    // 作品IDE类型（KITTEN等）
    ide_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'IDE类型'
    },
    // 作品播放地址
    work_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: '作品播放地址'
    },
    // 发布者ID（外键关联用户表）
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '发布者ID'
    },
    // 编程猫作者ID
    codemao_author_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '编程猫作者ID'
    },
    // 编程猫作者昵称
    codemao_author_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '编程猫作者昵称'
    },
    // 点赞数
    praise_times: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '点赞数'
    },
    // 收藏数
    collection_times: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '收藏数'
    },
    // 浏览数
    view_times: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '浏览数'
    },
    // 作品状态：pending-待审核，published-已发布，rejected-已拒绝，deleted-已删除
    status: {
        type: DataTypes.ENUM('pending', 'published', 'rejected', 'deleted'),
        allowNull: false,
        defaultValue: 'published',
        comment: '作品状态'
    },
    // 是否推荐到首页
    is_featured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '是否推荐到首页'
    },
    // 拒绝原因
    reject_reason: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: '拒绝原因'
    }
}, {
    tableName: 'works',
    comment: '作品表'
});

module.exports = Work;
