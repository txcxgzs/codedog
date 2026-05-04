/**
 * 工作室作品模型
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StudioWork = sequelize.define('StudioWork', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    studio_id: { type: DataTypes.INTEGER, allowNull: false },
    work_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    score: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
    reviewed_by: { type: DataTypes.INTEGER },
    reviewed_at: { type: DataTypes.DATE },
    added_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'studio_works', timestamps: false });

module.exports = StudioWork;
