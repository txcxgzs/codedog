/**
 * 收藏模型
 */

module.exports = (sequelize, DataTypes) => {
  const Favorite = sequelize.define('Favorite', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '用户ID'
    },
    work_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '作品ID'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'favorites',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'work_id']
      }
    ]
  });

  return Favorite;
};
