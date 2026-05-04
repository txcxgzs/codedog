/**
 * 轮播图模型
 * 存储首页轮播图信息
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Banner = sequelize.define('Banner', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    image_url: { type: DataTypes.STRING(500), allowNull: false },
    link_url: { type: DataTypes.STRING(500) },
    sort: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'banners', timestamps: false });

module.exports = Banner;
