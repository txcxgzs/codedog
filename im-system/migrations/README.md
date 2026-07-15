# IM 数据库迁移

当前最新迁移 `008_im_report_actions` 为举报记录增加处置动作字段。启动 IM 服务时会自动、幂等执行；已有举报和聊天数据不会被清空。

生产启动时 `apps/server/src/database.js` 会先连接 MySQL，再读取 `im_schema_migrations`。

- `001_initial_im_schema` 创建会话、成员、消息、群资料和管理员审计表。
- `002_image_host_metadata` 创建仅保存现有图床 URL 和校验元数据的图片表。
- `003_remove_read_receipts` 按产品决定移除已读位置字段；系统不提供已读回执。
- `004_im_reports` 创建消息举报表，并禁止同一用户重复举报同一消息。
- 迁移成功后才记录版本；失败时服务拒绝启动。
- 后续迁移必须使用递增版本，禁止使用 `sync({ alter: true })` 或启动时删除/重建表。
- 更新工具会先备份 `.env` 与 SSO 密钥，并在重新构建前执行检查。

MySQL 数据本身由 Docker 命名卷保存。正式升级前，工具箱的数据库备份功能将在下一阶段接入 `mysqldump`，在此之前生产更新不得跳过人工数据库备份。
