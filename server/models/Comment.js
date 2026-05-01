/**
 * 评论模型
 */

module.exports = (sequelize, DataTypes) => {
  const Comment = sequelize.define('Comment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '评论内容'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '评论者ID'
    },
    work_id: {
      type: DataTypes.INTEGER,
      comment: '作品ID'
    },
    post_id: {
      type: DataTypes.INTEGER,
      comment: '帖子ID'
    },
    parent_id: {
      type: DataTypes.INTEGER,
      comment: '父评论ID（回复评论时）'
    },
    reply_to_user_id: {
      type: DataTypes.INTEGER,
      comment: '回复的用户ID'
    },
    like_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '点赞数'
    },
    status: {
      type: DataTypes.ENUM('active', 'hidden', 'deleted'),
      defaultValue: 'active',
      comment: '状态'
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
    tableName: 'comments',
    timestamps: false
  });

  return Comment;
};
