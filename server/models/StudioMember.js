/**
 * 工作室成员模型
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StudioMember = sequelize.define('StudioMember', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    studio_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.ENUM('owner', 'vice_owner', 'admin', 'member'), defaultValue: 'member' },
    status: { type: DataTypes.ENUM('active', 'pending', 'rejected'), defaultValue: 'active' },
    joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'studio_members', timestamps: false });

module.exports = StudioMember;
