module.exports = (sequelize, DataTypes) => {
  const StudioWork = sequelize.define('StudioWork', {
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
    work_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '作品ID'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '投稿用户ID'
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending',
      comment: '状态'
    },
    score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '积分'
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      comment: '审核人ID'
    },
    reviewed_at: {
      type: DataTypes.DATE,
      comment: '审核时间'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'studio_works',
    timestamps: false
  });

  return StudioWork;
};
