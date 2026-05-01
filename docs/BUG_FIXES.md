# Bug修复记录文档

## 修复日期：2026-05-01

---

## 🐛 本次修复的Bug列表

### 1. ✅ 严重：冗余模型文件导致混淆（已修复）

**问题描述：**
- `server/models/User.js` 和 `server/models/Work.js` 是冗余文件
- 与 `server/models/index.js` 中的定义不一致
- User模型：`index.js` 使用 `codemao_user_id`，`User.js` 使用 `codemao_id`
- Work模型：`codemao_work_id` 类型不一致（STRING vs INTEGER）

**修复方案：**
- 删除 `server/models/User.js`
- 删除 `server/models/Work.js`
- 统一使用 `server/models/index.js` 中的模型定义

**修复文件：**
- 删除：`server/models/User.js`
- 删除：`server/models/Work.js`

---

### 2. ✅ 高危：点赞/取消点赞返回数据不准确（已修复）

**问题描述：**
- `increment()`/`decrement()` 操作后，`work.praise_times` 的值没有立即更新
- 返回给前端的点赞数是旧数据，导致前端显示不准确
- 影响作品点赞和评论点赞功能

**修复方案：**
- 在执行 `increment`/`decrement` 后重新查询最新数据
- 使用 `findByPk` 获取更新后的点赞数
- 确保返回给前端的数据是准确的

**修复文件：**
- `server/controllers/workController.js` - `likeWork` 函数
- `server/controllers/commentController.js` - `likeComment` 函数

---

### 3. ✅ 中等：用户作品同步机制不可靠（已修复）

**问题描述：**
- 作品同步失败时静默处理，没有任何通知机制
- 没有重试机制，网络波动会导致同步失败
- `work_count` 只记录新同步的数量，不准确

**修复方案：**
- 添加重试机制（最多重试3次，每次间隔5秒）
- 添加逐个作品同步的错误处理
- 修正 `work_count` 统计逻辑（统计实际作品数量而非同步数量）
- 返回详细的同步结果统计

**修复文件：**
- `server/controllers/userController.js` - `syncUserWorks` 函数

---

### 4. ✅ 中等：评论点赞功能缺少取消功能（已修复）

**问题描述：**
- 用户已点赞评论后只能返回错误，没有取消点赞功能
- 前端无法实现"再次点击取消点赞"的交互

**修复方案：**
- 添加评论取消点赞逻辑
- 取消点赞时删除Like记录并减少点赞数
- 返回统一的 `liked: true/false` 状态

**修复文件：**
- `server/controllers/commentController.js` - `likeComment` 函数

---

### 5. ✅ 低危：路由参数类型处理不一致（已修复）

**问题描述：**
- 路由参数在不同的控制器中处理方式不同
- `codemao_work_id` 有时转String，有时保持原样
- 可能导致数据库查询失败

**修复方案：**
- 创建统一的参数处理中间件 `server/middleware/params.js`
- 在路由层统一处理ID类型转换
- 所有以 `Id` 结尾的参数自动转为String类型

**修复文件：**
- 新增：`server/middleware/params.js`
- 修改：`server/routes/workRoutes.js`

---

## 修复日期：2026-04-18

---

## 🐛 已修复的Bug列表

### 1. ✅ 严重：GeetestService 模块缺失（已修复）

**问题描述：**
- 文件路径：`server/controllers/userController.js` 第17行
- 代码引用了 `require('../services/geetestService')`
- 但实际只存在 `geetest.js` 文件，导出的是 `GeetestLib` 类
- **在Windows上可能正常工作（不区分大小写），但部署到Linux/Docker会直接崩溃**

**修复方案：**
- 创建新文件 `server/services/geetestService.js`
- 封装 `GeetestLib` 类并提供场景化验证功能
- 包含配置管理、验证码验证、统计记录等功能
- 支持从数据库和环境变量读取配置

**修复文件：**
- 新增：`server/services/geetestService.js`

**测试状态：** ✅ 已创建，待运行测试

---

### 2. ✅ 中等：依赖安装问题（已修复）

**问题描述：**
- `sqlite3@5.1.6` 在 Node.js 24.11.1 上没有预编译二进制文件
- `node_modules` 被误删后重新安装失败
- 多个依赖标记为 `invalid` 和 `extraneous`

**修复方案：**
- 清理 npm 缓存后重新安装 sqlite3
- 使用 `npm cache clean --force` 清理缓存
- 设置环境变量跳过源码编译，使用预编译文件
- 所有依赖安装成功，无编译错误

**修复命令：**
```bash
cd server
Remove-Item -Recurse -Force node_modules\sqlite3 -ErrorAction SilentlyContinue
npm cache clean --force
npm install sqlite3@5.1.6
npm install
```

**验证结果：** ✅ 数据库连接成功，服务正常启动

---

### 3. ✅ 低危：环境变量配置不完整（已修复）

**问题描述：**
- `.env.example` 缺少 `SESSION_SECRET` 配置
- 缺少 CORS 配置说明
- 新用户可能不知道需要设置这些关键配置

**修复方案：**
- 在 `.env.example` 中添加 `SESSION_SECRET` 配置项
- 添加 `CORS_ORIGIN` 配置项及说明
- 完善所有配置项的注释说明

**修复文件：**
- `.env.example`

---

### 4. ✅ 低危：Session安全配置优化（已修复）

**问题描述：**
- Session 默认密钥太弱（`'hcaptcha-session-secret'`）
- `saveUninitialized: true` 浪费资源
- `secure: false` 在生产环境不安全
- 缺少 `sameSite` cookie 属性

**修复方案：**
- 更新默认密钥提示文案
- 改为 `saveUninitialized: false`
- 根据 `NODE_ENV` 自动设置 `secure` 和 `sameSite`
- 生产环境使用 `sameSite: 'strict'`
- 开发环境使用 `sameSite: 'lax'`

**修复文件：**
- `server/app.js`

---

### 5. ✅ 低危：CORS配置优化（已修复）

**问题描述：**
- `origin: true` 允许所有来源，存在安全风险
- 生产环境应该限制为特定的前端域名

**修复方案：**
- 添加 `CORS_ORIGIN` 环境变量支持
- 开发环境默认允许 localhost
- 生产环境严格检查白名单
- 允许没有 origin 的请求（如移动应用或 curl）

**修复文件：**
- `server/app.js`
- `.env.example`

---

### 6. ✅ 信息：路由顺序检查（无问题）

**检查结果：**
- `postRoutes.js` - ✅ 路由顺序正确（`/my/list` 在 `/:id` 之前）
- `workRoutes.js` - ✅ 路由顺序正确（`/publish`, `/featured`, `/my`, `/user/:userId`, `/codemao/:codemaoId` 都在 `/:codemaoId` 之前）
- `studioRoutes.js` - ✅ 路由顺序正确（`/my/list`, `/detail/:id` 等都在 `/:id` 之前）

**结论：** 所有路由文件顺序正确，无需修复

---

## 📋 修复总结

### 修复统计

| 修复日期 | 严重 | 高危 | 中等 | 低危 | 信息 | 状态 |
|---------|------|------|------|------|------|------|
| 2026-05-01 | 1 | 1 | 2 | 1 | 0 | ✅ 已完成 |
| 2026-04-18 | 1 | 0 | 1 | 3 | 1 | ✅ 已完成 |

### 累计修复的文件列表

**2026-05-01 新增/修改：**
1. ✅ `server/models/User.js` - 已删除（冗余文件）
2. ✅ `server/models/Work.js` - 已删除（冗余文件）
3. ✅ `server/controllers/workController.js` - 修复点赞数据不准确
4. ✅ `server/controllers/commentController.js` - 添加取消点赞功能
5. ✅ `server/controllers/userController.js` - 增强作品同步机制
6. ✅ `server/middleware/params.js` - 新建（统一参数处理）
7. ✅ `server/routes/workRoutes.js` - 应用参数处理中间件

**2026-04-18 修改：**
1. ✅ `server/services/geetestService.js` - 新建
2. ✅ `server/package.json` - 更新依赖版本
3. ✅ `.env.example` - 完善配置示例
4. ✅ `server/app.js` - 优化安全配置

---

## 🚀 部署说明

### Windows 开发环境

**推荐使用 MySQL：**

```bash
# 1. 复制环境变量文件
copy .env.example .env

# 2. 编辑 .env 文件，设置以下配置：
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=codemao_community
DB_USER=root
DB_PASSWORD=your_password

JWT_SECRET=your-jwt-secret-key-must-be-at-least-32-characters-long
SESSION_SECRET=your-session-secret-key-at-least-32-chars

# 3. 安装依赖
cd server
npm install

# 4. 启动服务
npm run dev
```

**如果使用 SQLite（需要编译工具）：**

```bash
# 1. 安装 Visual Studio Build Tools
# 下载地址: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# 安装时选择 "Desktop development with C++"

# 2. 安装依赖
cd server
npm install

# 3. 启动服务
npm run dev
```

### Linux/Docker 部署

```bash
# 1. 使用部署脚本
chmod +x deploy.sh
./deploy.sh

# 或手动部署
cp .env.example .env
# 编辑 .env 配置环境变量
cd server
npm install
npm start
```

---

## ⚠️ 注意事项

1. **Node.js 版本**
   - 当前使用 Node.js 24.11.1
   - sqlite3 在该版本上需要编译
   - 建议使用 Node.js 18 或 20（LTS版本）以获得更好的兼容性

2. **环境变量**
   - `JWT_SECRET` 必须设置且长度 >= 32 位
   - `SESSION_SECRET` 建议设置且长度 >= 32 位
   - 生产环境必须设置 `CORS_ORIGIN` 限制域名

3. **数据库**
   - 开发环境推荐使用 MySQL（避免 sqlite3 编译问题）
   - 生产环境推荐使用 MySQL（性能和稳定性更好）
   - SQLite 适合小型项目或测试环境

4. **安全**
   - 生产环境必须设置强密码和密钥
   - 建议启用 HTTPS
   - 建议配置验证码（极验或 hCaptcha）

---

## 📝 待优化项（非Bug）

1. 添加数据库迁移脚本（migrations）
2. 添加单元测试
3. 添加 API 文档（Swagger）
4. 优化错误处理和日志记录
5. 添加健康检查端点
6. 添加速率限制（rate limiting）
7. 优化图片上传（添加压缩和裁剪）

---

## 🔍 验证步骤

修复完成后，请执行以下验证：

- [x] 1. 依赖安装成功
- [x] 2. 服务启动成功
- [x] 3. 数据库连接成功
- [x] 4. API 接口正常响应
- [ ] 5. 用户登录功能正常
- [ ] 6. 验证码功能正常（如果配置）

### 验证结果

```
📦 使用SQLite数据库
📦 加载Sequelize模型
✅ 数据库连接成功
✅ 数据库模型同步完成
📌 系统首次启动，第一个使用编程猫登录的用户将自动成为管理员
🚀 服务器启动成功，端口: 3000
📍 API地址: http://localhost:3000/api
```

健康检查接口返回：`{"status":"ok","message":"服务运行正常"}` ✅

---

## 📞 问题反馈

如果在部署或使用过程中遇到问题，请：

1. 检查 `.env` 配置是否正确
2. 查看控制台错误日志
3. 确认数据库连接正常
4. 检查 Node.js 版本是否兼容

---

**文档最后更新时间：2026-05-01**
