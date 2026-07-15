# 编程狗即时通讯系统设计方案

状态：规划中  
版本：v0.2
目标：在不破坏现有社区系统的前提下，提供可独立部署、可横向扩容、支持私聊和群聊的完整即时通讯系统。

## 1. 已确定的设计原则

1. IM 在当前仓库的 `im-system/` 内独立开发，拥有独立前端、后端和管理后台。
2. 编程狗主站只增加可配置的 IM 跳转入口，不把聊天业务代码混入现有客户端。
3. IM 完整复用编程狗账号体系，用户从主站进入时不需要再次输入账号密码。
4. 生产环境使用 MySQL 保存持久消息，Redis 保存在线状态、短期去重、跨节点事件和限流状态。
5. SQLite 只允许本地开发和低负载体验环境，不作为高并发 IM 的生产数据库。
6. WebSocket 网关无状态化，可通过增加实例横向扩容。
7. 每条消息先可靠持久化，再向发送者确认成功并向接收者推送。
8. 客户端使用游标和会话序号补拉，断线重连不丢消息、不重复展示消息。
9. 第一阶段不引入 Kafka；保留事件总线抽象，规模增长后可从 Redis Streams 迁移到 NATS JetStream 或 Kafka。

## 2. 暂定产品决策

以下是当前产品决策：

- 陌生人私聊：允许发送一条会话申请；接收者同意前不能连续发送消息。
- 所有群默认统一限制 100 人。
- 编程狗 `admin`、`superadmin` 可在独立 IM 后台为指定群设置例外上限；修改必须完整审计。
- 不开发语音消息、实时语音通话或视频通话。
- 单条文本消息最大 10,000 字符。
- 图片最大 20 MB，普通文件最大 100 MB，具体值可由后台配置。

## 3. 服务边界

```text
编程狗 Vue 客户端 ── 跳转/SSO ──> 独立 IM Vue 客户端
                                      ├─ IM HTTP API
                                      ├─ IM WebSocket Gateway
                                      └─ 独立 IM 管理后台
                                      │
                       ┌──────────────┼──────────────┐
                       │              │              │
                    MySQL           Redis       Object Storage
                    持久消息      在线/事件/限流       图片/文件
```

规划目录（全部位于当前项目的一个独立文件夹内）：

```text
im-system/
  apps/
    web/                 独立科幻 IM 用户前端
    admin/               独立 IM 管理后台
    server/              HTTP API、WebSocket Gateway、Worker
  packages/
    protocol/            共享事件类型、错误码、校验规则
    ui/                  共享组件和主题变量
    config/              构建和运行配置
  migrations/            IM 数据库全量迁移
  tests/
    integration/
    load/
    security/
  docker-compose.yml     单独部署入口
  Dockerfile
  .env.example
  README.md
```

## 4. 部署模式

### 4.1 一体部署

适合首发和中小规模站点：

```text
reverse-proxy
  /api/*    -> codedog-server
  /im/api/* -> im-server
  /im/ws    -> im-server WebSocket
```

根 Compose 可引用 `im-system` 中的服务，一起运行社区、IM 前端、IM 后端、MySQL 和 Redis。IM 不与社区服务共享进程，后续拆分不需要重写代码。

### 4.2 独立部署

适合扩容：

- `https://54188.xyz/api`：社区 API。
- `https://im-api.54188.xyz`：IM HTTP API。
- `wss://im.54188.xyz/ws`：IM WebSocket。
- 多个 IM Gateway 通过负载均衡对外服务，不依赖连接粘性。

两种模式使用相同代码和协议，只改变环境变量与反向代理配置。编程狗通过 `IM_PUBLIC_URL` 控制入口地址。

## 5. 身份认证

IM 支持完整的编程狗账号体系，但不共享浏览器 Cookie，也不让 IM 服务读取或修改社区密码。主站入口使用短期单点登录 Ticket：

1. 用户点击编程狗的“即时通讯”入口。
2. 编程狗请求社区接口 `POST /api/im/sso-ticket`。
3. 社区服务检查登录、用户状态、角色、`token_version` 和封禁状态。
4. 社区服务签发 60 秒有效、只能兑换一次的 IM SSO Ticket。
5. 浏览器跳转到 `${IM_PUBLIC_URL}/sso?ticket=...`。
6. IM 前端立即用 Ticket 换取自身的 HttpOnly 会话 Cookie，并清除地址栏中的 Ticket。
7. WebSocket 使用 IM 会话及一次性连接 nonce 完成握手。

Ticket 至少包含：`user_id`、`token_version`、`role`、`jti`、`iat`、`exp`、`aud=im`。单次使用状态写入 Redis，防止重放。

用户被封禁、登出全部设备或密码被重置时，社区服务向 IM 发布 `user.session.revoked`，所有节点立即断开该用户连接。

账号同步规则：

- 社区 `users.id` 是 IM 的唯一外部账号标识，不能使用昵称或编程猫 ID 关联账号。
- 昵称、头像等资料通过带签名的内部 API 和事件同步，社区数据始终是账号真相来源。
- 用户禁用、全端登出、密码重置和角色变化必须实时通知 IM，并有定期对账兜底。
- IM 只保存必要的用户资料缓存，不保存密码、编程猫令牌或社区登录 Cookie。
- 社区暂时不可用时，已有短期 IM 会话可继续；新登录及角色敏感操作必须失败关闭。
- 独立 IM 后台使用自己的细粒度 RBAC，但管理员身份的根来源仍是编程狗角色系统。

## 6. 核心数据模型

### 6.1 会话与成员

`im_conversations`

- `id`：雪花 ID 或 UUIDv7。
- `type`：`direct | group`。
- `direct_key`：私聊双方排序后的唯一键，群聊为空。
- `last_sequence`：会话内最新序号。
- `last_message_id`。
- `created_at`、`updated_at`。

`im_conversation_members`

- `conversation_id`、`user_id` 联合唯一。
- `role`：`owner | admin | member`。
- `state`：`active | pending | left | removed | banned`。
- `last_read_sequence`、`last_delivered_sequence`。
- `mute_until`、`is_pinned`、`is_hidden`。
- `joined_at`、`left_at`。

### 6.2 消息

`im_messages`

- `id`：全局唯一 ID。
- `conversation_id`。
- `sequence`：会话内严格递增。
- `sender_id`。
- `client_message_id`：客户端重试幂等键。
- `type`：`text | image | file | system`。
- `content`：文本或结构化 JSON。
- `reply_to_message_id`。
- `status`：`active | edited | recalled | deleted | blocked`。
- `edited_at`、`recalled_at`、`created_at`。

必要索引：

- `UNIQUE(conversation_id, sequence)`。
- `UNIQUE(sender_id, client_message_id)`。
- `INDEX(conversation_id, created_at)`。
- `INDEX(sender_id, created_at)`。

### 6.3 群聊

- `im_groups`：群资料、群主、成员上限、全员禁言、加入方式；`member_limit` 默认 100。
- `im_group_join_requests`：申请状态和审核信息。
- `im_group_invites`：邀请人、邀请对象、过期时间。
- `im_group_member_bans`：群黑名单和原因。
- `im_group_audit_logs`：管理员操作日志。

群人数例外规则：

- 普通用户不能提交或修改超过 100 的人数上限。
- 只有编程狗 `admin`、`superadmin` 能在独立后台设置群容量例外。
- 后端必须重新校验管理员角色，不能只依赖前端隐藏按钮。
- 修改必须填写原因，并记录操作者、群、原值、新值、时间和来源 IP。
- 设置系统绝对上限 `IM_GROUP_HARD_LIMIT`，避免管理员误操作制造超大热点群。

### 6.4 附件与安全

- `im_attachments`：对象存储 key、类型、大小、hash、审核状态。
- `im_blocks`：用户拉黑关系。
- `im_reports`：消息/群/用户举报。
- `im_moderation_logs`：自动和人工审核记录。
- `im_device_sessions`：设备连接和最后活跃时间。

## 7. 消息可靠性协议

### 7.1 发送流程

```text
client message.send(client_message_id)
  -> 鉴权和会话成员检查
  -> 限流、拉黑、禁言和内容审核
  -> 数据库事务分配 sequence 并写入消息
  -> server message.ack(message_id, sequence)
  -> 跨节点广播 message.created
  -> 在线设备接收 message.new
  -> 接收方上报 message.delivered / conversation.read
```

客户端在收到 `message.ack` 前显示“发送中”。超时可以使用相同 `client_message_id` 重试，服务端必须返回同一条消息，不能重复落库。

### 7.2 顺序和补偿

- 顺序以服务端 `sequence` 为准，不以客户端时间为准。
- 客户端记录每个会话最后连续收到的 sequence。
- 发现序号跳跃或重连后调用 `GET /conversations/:id/messages?after_sequence=N`。
- WebSocket 只负责实时性，HTTP 补拉负责最终一致性。
- 已读状态只保存最大连续 `last_read_sequence`，避免逐消息回执造成写放大。

### 7.3 事件信封

```json
{
  "version": 1,
  "event": "message.send",
  "request_id": "uuidv7",
  "timestamp": 1784100000000,
  "data": {}
}
```

首期事件：`auth`、`auth.ok`、`ping`、`pong`、`message.send`、`message.ack`、`message.new`、`message.error`、`message.delivered`、`conversation.read`、`typing.start`、`typing.stop`、`presence.changed`、`conversation.updated`、`member.updated`、`session.revoked`。

## 8. 高并发策略

- Gateway 不保存业务真相，连接状态进入 Redis，并设置心跳 TTL。
- 一个用户允许多个设备连接，每个连接使用独立 connection id。
- 跨实例推送首期使用 Redis Streams 消费组，不使用可能丢事件的裸 Pub/Sub 作为唯一通道。
- 热点群采用批次 fan-out；不为每个离线成员预写一条消息副本。
- 未读数由 `last_sequence - last_read_sequence` 计算，并通过缓存加速。
- 历史消息使用 sequence 游标分页，禁止 `OFFSET 100000` 类查询。
- 图片和文件绕过 Node 进程上传，客户端使用短期签名 URL 直传对象存储。
- 限流至少覆盖 IP、用户、连接、会话和群维度。
- Gateway 设置单连接帧大小、消息频率、待发送队列和背压上限，慢连接超过阈值主动断开并要求补拉。

初期容量目标（需要压测证明，不作为未经验证的承诺）：

- 单 Gateway 节点 10,000 长连接目标。
- 普通消息 P95 ACK 小于 200 ms（同地域、非文件消息）。
- 断线恢复不丢消息，重复展示率为 0。
- 多节点扩容时连接数和吞吐近似线性增长。

## 9. 功能范围

### 私聊

- 私聊申请、拉黑、陌生人权限。
- 文本、图片、文件和代码卡片。
- 回复、转发、编辑、撤回、表情回应。
- 已发送、已送达、已读、输入状态和在线状态。
- 会话置顶、免打扰、隐藏、搜索。

### 群聊

- 建群、解散、退出、转让群主。
- 群主/管理员/成员权限。
- 邀请、申请、审核、群二维码和限时邀请链接。
- 群公告、群文件、群相册、群搜索。
- @成员、@全体成员、全员禁言、单人禁言、踢人和黑名单。
- 群管理日志、欢迎语和群消息已读人数。

### 管理后台

- IM 总开关和容量配置。
- 消息频率、文件大小、群人数配置。
- 举报审核和消息处置。
- 用户强制下线、群封禁、危险文件处置。
- 在线人数、连接数、消息吞吐、延迟、错误率和队列积压数据大屏。
- 后台是独立应用，默认仅编程狗 `admin`、`superadmin` 可以进入。
- 后台权限拆分为只读审计、举报处理、用户处置、群管理、群容量例外和系统配置。

## 10. 科幻视觉规范

- 主题：星际通讯终端；深蓝黑玻璃面板，黄色延续编程狗品牌，青蓝表示在线和实时状态。
- 桌面端：会话列表、消息区、资料/成员区三栏布局。
- 移动端：会话与聊天单栏切换，资料使用抽屉。
- 未读状态使用低强度脉冲光点，不使用持续高耗能动画。
- 支持亮色与深色主题、减少动态效果和低性能模式。
- 消息气泡保留清晰对比度，科幻装饰不影响长文本、代码和文件可读性。
- 所有关键操作必须具备键盘焦点、屏幕阅读器标签和足够点击区域。

## 11. 分阶段实施与验收

### M0：协议与基础设施

- 在 `im-system/` 建立用户前端、独立后台、服务端、共享协议、迁移和测试骨架。
- 增加 Redis、MySQL、健康检查、独立 Compose，以及根 Compose 的可选集成配置。
- 实现 SSO Ticket、账号资料同步、状态撤销、WebSocket 鉴权、事件版本化和错误码。
- 编程狗增加由 `IM_PUBLIC_URL` 控制的跳转入口，不耦合 IM 页面代码。
- 验收：一体和独立部署均能启动；伪造、过期、重放 Ticket 被拒绝；禁用账号立即断线；主站入口可完成无感登录。

### M1：可靠私聊

- 私聊会话、文本消息、ACK、未读、已读、补拉、重连和多设备同步。
- 验收：重复发送不重复落库；随机断网恢复后消息连续且有序。

### M2：完整群聊

- 群资料、成员角色、邀请申请、禁言、踢人、公告和管理日志。
- 验收：所有群操作具备服务端权限校验和审计记录。

### M3：富媒体和搜索

- 图片、文件、回复、编辑、撤回、回应和历史搜索。
- 验收：附件直传、类型校验、hash 校验、访问授权和过期签名可用。

### M4：安全与管理后台

- 敏感词、举报、限流、封禁联动、监控和运营配置。
- 验收：用户封禁后现有连接立即断开；举报处置全程可追溯。

### M5：性能与故障演练

- 多节点压测、断线风暴、Redis 重启、MySQL 短暂不可用、慢客户端和积压恢复测试。
- 验收数据必须记录测试硬件、连接数、消息大小、吞吐、P50/P95/P99、错误率和资源占用。

## 12. 不在首期范围

- 语音消息、实时音视频通话和屏幕共享。
- 端到端加密群聊。
- Kafka 和跨地域多活。
- 超大群直播式聊天室。

这些能力不能通过普通消息功能顺带实现，需要后续独立设计。

## 13. 开发前必须确认

1. 陌生人消息采用“会话申请”还是“仅互关可私聊”。
2. 已确认所有群默认统一限制 100 人，编程狗管理员可通过独立后台设置有审计记录的例外。
3. 已确认不开发语音消息和音视频通话。
4. 对象存储选型：本机磁盘、S3 兼容服务或其他云存储。
5. 生产环境是否允许新增 Redis 和 MySQL；若当前仍使用 SQLite，IM 上线前必须迁移。
6. 群容量例外是否只允许 `admin`、`superadmin`，还是 `moderator` 也能申请或执行。
