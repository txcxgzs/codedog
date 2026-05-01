/**
 * 轮播图模型
 * 存储首页轮播图信息
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Banner = sequelize.define('Banner', {
    // 轮播图ID（主键，自增）
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '轮播图ID'
    },
    // 标题
    title: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: '轮播图标题'
    },
    // 图片URL
    image_url: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: '图片URL'
    },
    // 跳转链接
    link_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: '点击跳转链接'
    },
    // 排序（数字越小越靠前）
    sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '排序顺序'
    },
    // 是否显示
    is_visible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: '是否显示'
    }
}, {
    tableName: 'banners',
    comment: '轮播图表'
});

module.exports = Banner;
