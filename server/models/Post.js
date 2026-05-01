/**
 * 社区帖子模型
 */

module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define('Post', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '标题'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '内容'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '作者ID'
    },
    category: {
      type: DataTypes.STRING(50),
      defaultValue: 'discussion',
      comment: '分类：discussion, question, share, tutorial'
    },
    tags: {
      type: DataTypes.STRING(500),
      comment: '标签，逗号分隔'
    },
    cover: {
      type: DataTypes.STRING(500),
      comment: '封面图'
    },
    view_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '浏览数'
    },
    like_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '点赞数'
    },
    comment_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '评论数'
    },
    is_top: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否置顶'
    },
    is_essence: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否精华'
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
    tableName: 'posts',
    timestamps: false
  });

  return Post;
};
