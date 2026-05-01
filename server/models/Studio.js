module.exports = (sequelize, DataTypes) => {
  const Studio = sequelize.define('Studio', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '工作室名称'
    },
    description: {
      type: DataTypes.TEXT,
      comment: '工作室简介'
    },
    cover: {
      type: DataTypes.STRING(500),
      comment: '封面图'
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '创建者ID'
    },
    vice_owner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '副市长ID'
    },
    member_count: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: '成员数量'
    },
    work_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '作品数量'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'banned'),
      defaultValue: 'active',
      comment: '状态'
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '是否公开'
    },
    join_type: {
      type: DataTypes.ENUM('free', 'apply', 'invite'),
      defaultValue: 'apply',
      comment: '加入方式'
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: '等级 1-10'
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '积分'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'studios',
    timestamps: false
  });

  return Studio;
};
