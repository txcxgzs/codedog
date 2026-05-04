/**
 * 工作室模型
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Studio = sequelize.define('Studio', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT },
    cover: { type: DataTypes.STRING(500) },
    cover_url: { type: DataTypes.STRING(500) },
    owner_id: { type: DataTypes.INTEGER, allowNull: false },
    vice_owner_id: { type: DataTypes.INTEGER },
    member_count: { type: DataTypes.INTEGER, defaultValue: 1 },
    work_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_score: { type: DataTypes.INTEGER, defaultValue: 0 },
    points: { type: DataTypes.INTEGER, defaultValue: 0 },
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    is_public: { type: DataTypes.BOOLEAN, defaultValue: true },
    join_type: { type: DataTypes.STRING(20), defaultValue: 'public' },
    status: { type: DataTypes.STRING(20), defaultValue: 'active' },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'studios', timestamps: false });

module.exports = Studio;
