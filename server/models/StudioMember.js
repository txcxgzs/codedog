/**
 * 工作室成员模型
 */

module.exports = (sequelize, DataTypes) => {
  const StudioMember = sequelize.define('StudioMember', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    studio_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '工作室ID'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '用户ID'
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'member'),
      defaultValue: 'member',
      comment: '角色：创建者、管理员、成员'
    },
    status: {
      type: DataTypes.ENUM('active', 'pending', 'rejected'),
      defaultValue: 'active',
      comment: '状态'
    },
    joined_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: '加入时间'
    }
  }, {
    tableName: 'studio_members',
    timestamps: false
  });

  return StudioMember;
};
