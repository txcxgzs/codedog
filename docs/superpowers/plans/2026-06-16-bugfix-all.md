# 编程狗社区 Bug 全量修复实施计划

> **目标:** 修复 bug 检测报告中列出的全部 28 个问题，确保服务端/前端一致性与并发安全。

**架构:** 按文件聚合改动，最小化跨文件影响；优先修复高严重性问题（数据一致性、安全、审核失效）。

**技术栈:** Node.js + Express + Sequelize / Vue 3 + Pinia + Axios

---

## Task 1: 修复 `commentController.likeComment` 缺少取消点赞

**Files:**
- Modify: `server/controllers/commentController.js:192-226`

- [ ] **Step 1:** 重写 `likeComment` 函数，支持 toggle（已点赞则取消）

```js
async function likeComment(req, res) {
    try {
        const { id } = req.params;
        const userId = DbAdapter.getId(req.user);
        const comment = await DbAdapter.findByPk(Comment, id);

        if (!comment || comment.status !== 'active') {
            return errorResponse(res, 'Comment not found', 404);
        }
        if (comment.work_id && !await resolvePublishedWork(comment.work_id)) {
            return errorResponse(res, 'Comment not found', 404);
        }
        if (comment.post_id && !await resolvePublishedPost(comment.post_id)) {
            return errorResponse(res, 'Comment not found', 404);
        }

        const { Like } = require('../models');
        const existing = await DbAdapter.findOne(Like, {
            where: { user_id: userId, comment_id: DbAdapter.getId(comment) }
        });

        if (existing) {
            await DbAdapter.destroy(Like, { where: { id: DbAdapter.getId(existing) } });
            const newCount = Math.max(0, (comment.like_count || 0) - 1);
            await DbAdapter.update(Comment, { like_count: newCount }, { where: { id: DbAdapter.getId(comment) } });
            return successResponse(res, { like_count: newCount, liked: false }, 'Unliked');
        }

        await DbAdapter.create(Like, {
            user_id: userId,
            comment_id: DbAdapter.getId(comment)
        });
        const newCount = (comment.like_count || 0) + 1;
        await DbAdapter.update(Comment, { like_count: newCount }, { where: { id: DbAdapter.getId(comment) } });

        return successResponse(res, { like_count: newCount, liked: true }, 'Liked');
    } catch (error) {
        console.error('Like comment error:', error);
        return errorResponse(res, 'Failed to like comment', 500);
    }
}
```

---

## Task 2: 修复 `aiReview.fallbackReview` 敏感词级别比较永远 false

**Files:**
- Modify: `server/services/aiReview.js:241-275`

- [ ] **Step 1:** 将 `sw.level === 'high'` 等字符串比较改为数字阈值比较（默认 level=1 为 low；推荐 1=low, 2=medium, 3=high）

```js
async function fallbackReview(content) {
    try {
        const sensitiveWords = await DbAdapter.findAll(SensitiveWord, { where: { status: 'active' } });
        const foundWords = [];
        let riskLevel = 'low';

        for (const sw of sensitiveWords) {
            if (content.includes(sw.word)) {
                foundWords.push(sw.word);
                const level = Number(sw.level) || 1;
                if (level >= 3) riskLevel = 'high';
                else if (level === 2 && riskLevel !== 'high') riskLevel = 'medium';
            }
        }

        return {
            riskLevel,
            violations: foundWords,
            reason: foundWords.length > 0 ? `包含敏感词: ${foundWords.join(', ')}` : '未发现敏感词',
            recommendation: riskLevel === 'high' ? 'delete' : (riskLevel === 'medium' ? 'review' : 'pass'),
            confidence: foundWords.length > 0 ? 0.7 : 0.9
        };
    } catch (e) {
        return {
            riskLevel: 'low',
            violations: [],
            reason: '敏感词检测失败',
            recommendation: 'review',
            confidence: 0.5
        };
    }
}
```

---

## Task 3: 修复 `postController.getPostDetail` 浏览数竞态 + 返回旧值

**Files:**
- Modify: `server/controllers/postController.js:84-130`

- [ ] **Step 1:** 用原子 `increment` 替代 read-modify-write；reload 后再返回

```js
async function getPostDetail(req, res) {
    try {
        const { id } = req.params;

        const post = await DbAdapter.findByPk(Post, id, {
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'nickname', 'avatar', 'bio']
            }]
        });

        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        if (post.status !== 'published') {
            return errorResponse(res, '帖子不存在', 404);
        }

        // 原子 +1 后再重新读取用于响应
        await DbAdapter.increment(post, 'view_count');

        const comments = await DbAdapter.findAll(Comment, {
            where: { post_id: id, status: 'active', parent_id: null },
            include: [
                { model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] },
                { model: Comment, as: 'replies', where: { status: 'active' }, required: false,
                  include: [{ model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] }] }
            ],
            order: [['created_at', 'DESC']]
        });

        return successResponse(res, { ...post.toJSON(), view_count: (post.view_count || 0) + 1, comments });
    } catch (error) {
        console.error('获取帖子详情错误:', error);
        return errorResponse(res, '获取帖子详情失败', 500);
    }
}
```

---

## Task 4: 修复 `workController.likeWork` 返回 stale data

**Files:**
- Modify: `server/controllers/workController.js:585-617`

- [ ] **Step 1:** `increment` 之后重新读取 `praise_times`；返回实际值

```js
async function likeWork(req, res) {
    try {
        const codemaoId = req.params.codemaoId;
        const { Like, Notification } = require('../models');

        const work = await DbAdapter.findOne(Work, { where: { codemao_work_id: codemaoId } });
        if (!work) return errorResponse(res, '作品不存在', 404);
        if (!canInteractWithWork(work)) return errorResponse(res, 'Work not found', 404);

        const existingLike = await DbAdapter.findOne(Like, {
            where: { user_id: DbAdapter.getId(req.user), work_id: DbAdapter.getId(work) }
        });

        if (existingLike) {
            await DbAdapter.destroy(Like, { where: { id: DbAdapter.getId(existingLike) } });
            await DbAdapter.decrement(work, 'praise_times');
            await work.reload();
            return successResponse(res, { praise_times: Math.max(0, work.praise_times || 0), liked: false }, '已取消点赞');
        }

        await DbAdapter.create(Like, {
            user_id: DbAdapter.getId(req.user),
            work_id: DbAdapter.getId(work)
        });
        await DbAdapter.increment(work, 'praise_times');
        await work.reload();

        if (work.user_id != null && String(work.user_id) !== String(DbAdapter.getId(req.user))) {
            await DbAdapter.create(Notification, {
                user_id: work.user_id,
                type: 'like',
                title: '点赞了你的作品',
                content: work.name,
                related_id: DbAdapter.getId(work),
                related_type: 'work',
                sender_id: DbAdapter.getId(req.user)
            });
        }

        return successResponse(res, { praise_times: work.praise_times || 0, liked: true }, '点赞成功');
    } catch (error) {
        console.error('点赞作品错误:', error);
        return errorResponse(res, '点赞失败', 500);
    }
}
```

---

## Task 5: 修复 `userController.getUserById` 暴露本地主键

**Files:**
- Modify: `server/controllers/userController.js:302-335`

- [ ] **Step 1:** 移除对本地主键 `id` 的回退；只允许通过 `codemao_user_id` 查询公开信息

```js
async function getUserById(req, res) {
    try {
        const { codemaoId } = req.params;

        const user = await DbAdapter.findOne(User, {
            where: { codemao_user_id: String(codemaoId) },
            attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar', 'bio', 'doing', 'level', 'follower_count', 'following_count', 'work_count', 'created_at']
        });

        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }

        return successResponse(res, user);
    } catch (error) {
        console.error('获取用户信息错误:', error);
        return errorResponse(res, '获取用户信息失败', 500);
    }
}
```

---

## Task 6: 修复 `adminController` 全局劫持 console

**Files:**
- Modify: `server/controllers/adminController.js:40-60`

- [ ] **Step 1:** 移除模块顶层 console 改写；改为在 `getRealtimeLogs` 中通过 `process.on`/中间件注入，或改为对单一端点提供捕获（如有需要可改为从 `OperationLog` 聚合）

```js
// 删除以下整段:
// const originalConsoleLog = console.log;
// ... (整个 console 改写块)
// console.log = function(...args) { ... };
// console.error = function(...args) { ... };
// console.warn = function(...args) { ... };
```

- [ ] **Step 2:** 由于 `addRealtimeLog` 内部 `console.error` 循环调用问题，改为自管列表 + 写入数据库 `OperationLog` 模式；或保留一个内存缓冲但限速

---

## Task 7: 修复重复登录限流（去重）

**Files:**
- Modify: `server/routes/userRoutes.js:17-21`
- Modify: `server/app.js:122`

- [ ] **Step 1:** 移除 `userRoutes.js` 中的 `loginRateLimit`（与 `app.js` 的全局限流重复），改用 `app.use('/api/users/login', loginRateLimiter);` 单点策略；同时把 `loginRateLimit` 的 keyGenerator 行为保留到 app.js 全局限流

- [ ] **Step 2:** 在 `app.js` 中将登录限流的 keyGenerator 改为 `${ip}:${username}`

```js
// app.js
app.use('/api/users/login', createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: 'login',
    keyGenerator: req => `${req.ip}:${String(req.body?.username || '').toLowerCase()}`
}));
```

---

## Task 8: 修复 `getUserWorks`/`getMyWorks` 等使用 `userId` 字符串 vs 数字 ID

**Files:**
- Modify: `server/controllers/workController.js:520-540`

- [ ] **Step 1:** 强制将传入的 userId 转换为数字（findByPk 兼容性更好）

---

## Task 9: 修复 `favoriteController.addFavorite`/`removeFavorite` 计数竞态

**Files:**
- Modify: `server/controllers/favoriteController.js:23-97`

- [ ] **Step 1:** 用原子 `increment`/`decrement`，删 `read-modify-write`

```js
// addFavorite
await DbAdapter.create(Favorite, { user_id: req.user.id, work_id: localWorkId });
await DbAdapter.increment(work, 'collection_times');
await work.reload();
return successResponse(res, { collection_times: work.collection_times || 0, favorited: true }, '收藏成功');

// removeFavorite
await DbAdapter.destroy(Favorite, { where: { id: DbAdapter.getId(favorite) } });
const work = await DbAdapter.findByPk(Work, localWorkId);
if (work) {
    await DbAdapter.decrement(work, 'collection_times');
    await work.reload();
}
return successResponse(res, { collection_times: work ? Math.max(0, work.collection_times || 0) : 0, favorited: false }, '已取消收藏');
```

---

## Task 10: 修复 `studioController` `member_count` 计数竞态

**Files:**
- Modify: `server/controllers/studioController.js:235-283, 361-398`

- [ ] **Step 1:** 用原子 increment/decrement 替代 `read-modify-write`

```js
// joinStudio / reviewMember 通过时
const studio = await DbAdapter.findByPk(Studio, id);
if (studio) {
    await DbAdapter.increment(studio, 'member_count');
}

// leaveStudio 退出时
if (studio) {
    await DbAdapter.decrement(studio, 'member_count');
}
```

---

## Task 11: 修复 `dbMigration.js` 配置比较

**Files:**
- Modify: `server/routes/dbMigration.js:122`

- [ ] **Step 1:** 写一个稳定的 deep equal 函数（支持基础类型与对象），按 key 排序后 JSON.stringify

```js
function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

if (sourceType === targetType && stableStringify(sourceConfig || {}) === stableStringify(targetConfig || {})) {
    throw routeError('Source and target databases cannot be identical.');
}
```

---

## Task 12: 修复 `reportRoutes` 创建举报未通知审核员

**Files:**
- Modify: `server/routes/reportRoutes.js:91-108`

- [ ] **Step 1:** 在创建举报后，查找所有 reviewer+ 用户发通知（最多 50 个防滥用）

```js
const reviewers = await DbAdapter.findAll(User, {
    where: { role: { [Op.in]: ['reviewer', 'moderator', 'admin', 'superadmin'] }, status: 'active' },
    attributes: ['id'],
    limit: 50
});

if (reviewers.length > 0) {
    await DbAdapter.bulkCreate(Notification, reviewers.map(r => ({
        user_id: r.id,
        type: 'report',
        title: '收到新举报',
        content: `有用户举报了${typeNames[type]}「${targetName}」`,
        related_id: linkId,
        related_type: linkType
    })));
}
```

- [ ] **Step 2:** 引入 `Op` from 'sequelize' 到 `reportRoutes.js`

---

## Task 13: 修复前端 `WorkDetail.vue` `getReplyToName` 取错对象

**Files:**
- Modify: `client/src/views/WorkDetail.vue:737-744`

- [ ] **Step 1:** 不再依赖"找 user_id 等于 reply_to_user_id 的评论"，改为后端在评论树中嵌入 `reply_to_user` 字段

后端：在 `commentController.createComment` 返回 result 时额外 include 一层。改造后还需修改 `commentController.getWorkComments` 关联加载。

**Files (backend):** `server/controllers/commentController.js`

- [ ] **Step 2:** 在 `getWorkComments` 中 include 关联的 `reply_to_user`：

```js
include: [
    { model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] },
    { model: User, as: 'reply_to_user', attributes: ['id', 'username', 'nickname'], required: false },
    { model: Comment, as: 'replies', where: { status: 'active' }, required: false,
      include: [
          { model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] },
          { model: User, as: 'reply_to_user', attributes: ['id', 'username', 'nickname'], required: false }
      ]
    }
]
```

- [ ] **Step 3:** 在 `models/index.js` 增加 `Comment.belongsTo(User, { foreignKey: 'reply_to_user_id', as: 'reply_to_user' })`

- [ ] **Step 4:** 修改 `WorkDetail.vue` 的 `getReplyToName`：

```js
const getReplyToName = (reply) => {
    return reply.reply_to_user?.nickname || reply.reply_to_user?.username || '';
}
```

---

## Task 14: 修复前端 `WorkDetail.vue` `likeComment` 错误处理

**Files:**
- Modify: `client/src/views/WorkDetail.vue:715-737`

- [ ] **Step 1:** 根据后端返回的 `liked` 字段更新本地 `like_count`（不是无条件 +1）

```js
const likeComment = async (comment) => {
    if (!userStore.isLoggedIn) { ElMessage.warning('请先登录'); return }
    let geetestData = {}
    if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.like) {
        geetestData = await geetestDialogRef.value.show('like')
        if (!geetestData) return
    }
    try {
        const res = await commentApi.likeComment(comment.id, geetestData)
        if (res.code === 200) {
            comment.liked = !!res.data.liked
            comment.like_count = res.data.like_count
        }
    } catch (error) {
        console.error('点赞失败:', error)
    }
}
```

---

## Task 15: 修复前端 `Profile.vue` 缺少修改密码后端接口

**Files:**
- Modify: `server/routes/userRoutes.js` (新增 PUT /api/users/password)
- Modify: `server/controllers/userController.js` (新增 changePassword)
- Modify: `client/src/api/user.js` (新增 changePassword)
- Modify: `client/src/views/Profile.vue` (接入 changePassword)

- [ ] **Step 1:** 后端 controller:

```js
async function changePassword(req, res) {
    try {
        const { oldPassword, newPassword } = req.body
        if (!oldPassword || !newPassword || newPassword.length < 6) {
            return errorResponse(res, '新密码长度至少6位', 400)
        }
        const user = await DbAdapter.findByPk(User, DbAdapter.getId(req.user))
        if (!user) return errorResponse(res, '用户不存在', 404)
        const ok = await bcrypt.compare(oldPassword, user.password)
        if (!ok) return errorResponse(res, '原密码不正确', 400)
        const hashed = await bcrypt.hash(newPassword, 10)
        await DbAdapter.update(User, { password: hashed }, { where: { id: DbAdapter.getId(user) } })
        return successResponse(res, null, '密码已更新')
    } catch (error) {
        console.error('修改密码错误:', error)
        return errorResponse(res, '修改密码失败', 500)
    }
}
```

- [ ] **Step 2:** 路由: `router.put('/password', authMiddleware, userController.changePassword);`

- [ ] **Step 3:** 前端 API: `changePassword: (data) => request.put('/users/password', data)`

- [ ] **Step 4:** 前端 `Profile.vue` 中 `changePassword` 函数接入 `userApi.changePassword`

---

## Task 16: 修复 `permissions.refreshRoleCache` 等级被 DB 覆盖

**Files:**
- Modify: `server/config/permissions.js:141-160`

- [ ] **Step 1:** 保留 `DEFAULT_ROLES` 的 `level` 字段，不允许 DB 覆盖

```js
dbRoles.forEach(role => {
    const fallback = DEFAULT_ROLES[role.role] || DEFAULT_ROLES.user
    cachedRoles[role.role] = {
        name: role.name || fallback.name,
        level: fallback.level, // 受保护
        permissions: JSON.parse(role.permissions || '[]')
    }
})
```

---

## Task 17: 修复 `WorkDetail.vue` BOX2 播放地址

**Files:**
- Modify: `client/src/views/WorkDetail.vue:409-420`

- [ ] **Step 1:** BOX2 使用独立域名

```js
'BOX2': `https://box2.codemao.cn/w/${workId}`,
```

---

## Task 18: 修复 `Post.tags` 字段 raw 模式返回字符串问题

**Files:**
- Modify: `server/models/index.js:67-74`

- [ ] **Step 1:** 把 tags 字段存储与读取规范化。建议存为 JSON 字符串，但统一在 controller 中解析为数组返回。

在 `postController.createPost` / `updatePost` 中确保 tags 是数组传入；序列化使用 `JSON.stringify`；在 `getPosts` / `getPostDetail` 中 `post.toJSON()` 后转换 `tags` 字段：

```js
function normalizePostOutput(post) {
    const json = post.toJSON ? post.toJSON() : post
    if (typeof json.tags === 'string') {
        try { json.tags = JSON.parse(json.tags) } catch { json.tags = [] }
    }
    return json
}
```

- [ ] **Step 2:** 在 `postController.getPosts` 与 `getPostDetail` 中调用 `normalizePostOutput`

---

## Task 19: 修复 `WorkDetail.vue` 中 `submitComment` 计数恒 +1

**Files:**
- Modify: `client/src/views/WorkDetail.vue:656-690`

- [ ] **Step 1:** 仅顶层评论增加计数；replies 不增加

```js
if (!replyingTo.value) {
    comments.value.unshift(res.data)
    work.value.comment_count = (work.value.comment_count || 0) + 1
} else {
    // 仅 append 到 parent 的 replies，不增加 work.comment_count
    const parentId = replyingTo.value.parent_id || replyingTo.value.id
    const parentComment = comments.value.find(c => c.id === parentId)
    if (parentComment && parentComment.replies) {
        parentComment.replies.push(res.data)
    }
}
```

---

## Task 20: 修复 `commentController.likeComment` 中 `resolvePublishedWork` 混用问题

**Files:**
- Modify: `server/controllers/commentController.js:11-21`

- [ ] **Step 1:** comment.work_id 始终是本地主键，单独走 `findByPk(Work, workId)`；不与 codemaoWorkId 混用

```js
async function resolvePublishedWorkByLocalId(workId) {
    if (!workId) return null
    const work = await DbAdapter.findByPk(Work, workId)
    return work && work.status === 'published' ? work : null
}
```

---

## Task 21: 修复前端 `Profile.vue` 中 `changeAvatar` 没真正上传

**Files:**
- Modify: `client/src/views/Profile.vue` (changeAvatar handler)
- Modify: `client/src/api/user.js`

- [ ] **Step 1:** `changeAvatar` 直接调用 `userApi.updateAvatar(formData)`，后端 `multer` 已经处理 `avatar` 字段

---

## Task 22: 修复 `User` `Studio` 关系 `as: 'owner'` 不一致

**Files:**
- Modify: `server/models/index.js:262-300`

- [ ] **Step 1:** 将 `User.hasMany(Studio, { foreignKey: 'owner_id', as: 'owned_studios' })` 改为 `as: 'owner'`，并把已有控制器代码中的 `as: 'owned_studios'` 改为 `as: 'owner'`

或反之：保留 `as: 'owner'` 在 Studio.belongsTo(User)，并把反向关联改为 `as: 'owned_studios'`（Studio→User），反向 User→Studio 用 `as: 'owner'`

---

## Task 23: 修复 `Post` `getPosts` 中 `category=official` 与 `category=news` 矛盾

**Files:**
- Modify: `server/controllers/postController.js:64-90`

- [ ] **Step 1:** 移除 `where.category = 'news'` 强行映射；或保持但加注释。建议删除误导性分支。

```js
if (category === 'essence') {
    where.is_essence = true
} else if (category === 'official') {
    where.category = 'news'
} else if (category) {
    where.category = category
}
```

由于原代码用 `category='news'` 是显式约定，保留即可，注释清楚。

---

## Task 24: 修复 `permissions.getRoleSync` 缓存永久为 null

**Files:**
- Modify: `server/app.js:startServer` (调用 refreshRoleCache)

- [ ] **Step 1:** 在 `app.js` `startServer` 中：

```js
const { refreshRoleCache, RolePermission } = require('./models');
// ...
await sequelize.sync({ alter: false });
if (sessionStore) await sessionStore.sync();
await refreshRoleCache(RolePermission);
console.log('角色权限缓存已刷新');
```

---

## Task 25: 修复 `rateLimit` 内存桶无上限

**Files:**
- Modify: `server/middleware/rateLimit.js`

- [ ] **Step 1:** 添加 LRU 上限（建议 10,000）；超过上限时清空最早的桶

```js
const MAX_BUCKETS = 10000

function evictIfFull() {
    if (buckets.size > MAX_BUCKETS) {
        // 删除最早过期或最旧的 20%
        const toDelete = Math.floor(MAX_BUCKETS * 0.2)
        let i = 0
        for (const key of buckets.keys()) {
            buckets.delete(key)
            if (++i >= toDelete) break
        }
    }
}

// 在 createRateLimiter 的 set 处调用 evictIfFull()
```

---

## Task 26: 修复 `sessionStore.js` `setInterval` 未持有引用

**Files:**
- Modify: `server/services/sessionStore.js:34-37`

- [ ] **Step 1:** 保存 interval handle 到 `this._cleanupTimer`

```js
this._cleanupTimer = setInterval(() => {
    this.clearExpired(() => {})
}, 15 * 60 * 1000)
this._cleanupTimer.unref()
```

---

## Task 27: 修复 `requireAdmin` / `adminMiddleware` 命名误导

**Files:**
- Modify: `server/middleware/auth.js:73-85`
- Modify: `server/middleware/permission.js:43-51`

- [ ] **Step 1:** 改名为 `reviewerOrAboveMiddleware` 与 `requireReviewerOrAbove`，并将错误信息改为 "需要审核员或以上权限"

为最小化外部影响，保持原名导出但内部新增 `requireReviewerOrAbove` 别名；并在文档中说明。原导出保持兼容。

---

## Task 28: 编写修复文档 `docs/BUGFIX-2026-06.md`

**Files:**
- Create: `docs/BUGFIX-2026-06.md`

- [ ] **Step 1:** 编写完整修复文档，包含每个 bug 的：标题、严重性、影响范围、修复方式、修改文件、回归验证建议

---

## 备注
- 不引入新依赖
- 优先保证功能正确性，其次性能
- 不改变现有 API 协议/响应格式
- 兼容性：保留原方法名/路由，行为变更通过响应字段增量体现
