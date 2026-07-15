<template>
  <div class="r-devdocs--page">
    <div class="r-devdocs--container">
      <div class="r-devdocs--header">
        <h1>开发者文档</h1>
        <el-button @click="$router.push('/developer')">返回控制台</el-button>
      </div>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>概述</h2>
        <p>平台同时支持用户授权码模式和应用级 client_credentials 模式。公开社区数据由应用自身访问，不需要用户授权。</p>
        <ul>
          <li>Token：access_token 2 小时，refresh_token 30 天</li>
          <li>仅支持机密客户端（backend 保管 client_secret）</li>
          <li>应用需管理员审核通过（status=active）后才能换 token</li>
        </ul>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>权限 Scope</h2>
        <el-table :data="scopes" size="small">
          <el-table-column prop="key" label="Scope" width="160" />
          <el-table-column prop="name" label="名称" width="140" />
          <el-table-column label="授权主体" width="100">
            <template #default="{ row }"><el-tag size="small" :type="row.audience === 'application' ? 'success' : 'info'">{{ row.audience === 'application' ? '应用' : '用户' }}</el-tag></template>
          </el-table-column>
          <el-table-column label="风险" width="90">
            <template #default="{ row }">
              <el-tag :type="row.risk === 'admin' ? 'danger' : (row.risk === 'write' ? 'warning' : 'info')" size="small">
                {{ row.risk === 'admin' ? '管理' : (row.risk === 'write' ? '写入' : '只读') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" />
        </el-table>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>应用级公开数据令牌（无需用户授权）</h2>
        <pre class="r-devdocs--pre">POST /api/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&amp;client_id=YOUR_CLIENT_ID
&amp;client_secret=YOUR_CLIENT_SECRET
&amp;scope=search:read works:public:read</pre>
        <p>也支持 HTTP Basic。返回以 <code>aat_</code> 开头的短期应用令牌，不签发 refresh_token，且只能调用应用级公开接口。</p>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>1. 引导用户授权</h2>
        <pre class="r-devdocs--pre">GET /oauth/authorize
  ?response_type=code
  &amp;client_id=YOUR_CLIENT_ID
  &amp;redirect_uri=https://your.app/callback
  &amp;scope=profile:read works:read
  &amp;state=random_csrf_token</pre>
        <p>用户同意后会 302 到回调地址，并带上 <code>code</code> 与 <code>state</code>。</p>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>2. 用 code 换 token</h2>
        <pre class="r-devdocs--pre">POST /api/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&amp;code=AUTHORIZATION_CODE
&amp;redirect_uri=https://your.app/callback
&amp;client_id=YOUR_CLIENT_ID
&amp;client_secret=YOUR_CLIENT_SECRET</pre>
        <p>也支持 HTTP Basic（client_id:client_secret）。成功响应 data 字段：</p>
        <pre class="r-devdocs--pre">{
  "access_token": "atk_...",
  "token_type": "Bearer",
  "expires_in": 7200,
  "refresh_token": "rtk_...",
  "scope": "profile:read works:read"
}</pre>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>3. 刷新 token</h2>
        <pre class="r-devdocs--pre">POST /api/oauth/token
grant_type=refresh_token
&amp;refresh_token=rtk_...
&amp;client_id=...
&amp;client_secret=...</pre>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>4. 调用开放 API</h2>
        <pre class="r-devdocs--pre">GET /api/open/v1/me
Authorization: Bearer ACCESS_TOKEN

GET /api/open/v1/me/works?page=1&amp;pageSize=20
GET /api/open/v1/me/works/:id
GET /api/open/v1/me/comments
GET /api/open/v1/me/posts
GET /api/open/v1/me/posts/:id
GET /api/open/v1/me/notifications
GET /api/open/v1/me/activity
GET /api/open/v1/me/works/stats
GET /api/open/v1/me/works/:id/stats
GET /api/open/v1/me/studios/:id/members

GET /api/oauth/userinfo   # 等价于 profile:read</pre>
        <p>统一响应：<code>{ code, msg, data }</code>。默认限流约 60 次/分钟/应用+IP。</p>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>5. 写入 API</h2>
        <pre class="r-devdocs--pre">POST   /api/open/v1/comments              (comments:write)
DELETE /api/open/v1/comments/:id          (comments:write)
POST   /api/open/v1/posts                 (posts:write)
PATCH  /api/open/v1/posts/:id             (posts:write)
DELETE /api/open/v1/posts/:id             (posts:write)
POST   /api/open/v1/works                 (works:write, body: { codemaoWorkId })
PATCH  /api/open/v1/works/:codemaoId      (works:write)
DELETE /api/open/v1/works/:codemaoId      (works:write)
POST   /api/open/v1/me/notifications      (notifications:write)</pre>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>7. 撤销 token</h2>
        <pre class="r-devdocs--pre">POST /api/oauth/revoke
{ "token": "atk_... 或 rtk_..." }</pre>
      </el-card>
      <el-card shadow="never" class="r-devdocs--card">
        <h2>8. 工作室、关注与收藏</h2>
        <pre class="r-devdocs--pre">GET  /api/open/v1/me/studios?status=active&amp;page=1&amp;pageSize=20
GET  /api/open/v1/me/studios/:id
GET  /api/open/v1/me/followers?page=1&amp;pageSize=20
GET  /api/open/v1/me/following?page=1&amp;pageSize=20
GET  /api/open/v1/me/favorites?page=1&amp;pageSize=20
GET  /api/open/v1/me/likes?page=1&amp;pageSize=20        (scope: favorites:read)</pre>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>9. 公开社区与搜索 API</h2>
        <p>以下接口使用 <code>client_credentials</code> 获取的应用令牌，不需要跳转用户授权页：</p>
        <pre class="r-devdocs--pre">GET /api/open/v1/users/:id                 (users:public:read)
GET /api/open/v1/works                     (works:public:read)
GET /api/open/v1/works/:id                 (works:public:read)
GET /api/open/v1/posts                     (posts:public:read)
GET /api/open/v1/posts/:id                 (posts:public:read)
GET /api/open/v1/studios                   (studios:public:read)
GET /api/open/v1/studios/:id               (studios:public:read)
GET /api/open/v1/search?q=关键词            (search:read)
GET /api/open/v1/community/feed?mode=latest (community:feed:read)
GET /api/open/v1/community/stats            (community:stats:read)</pre>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>10. 分析与工作室只读 API</h2>
        <pre class="r-devdocs--pre">GET /api/open/v1/me/openid                          (openid)
GET /api/open/v1/me/analytics/works                 (works:analytics:read)
GET /api/open/v1/me/analytics/posts                 (posts:analytics:read)
GET /api/open/v1/me/analytics/account               (account:analytics:read)
GET /api/open/v1/me/comments/received               (comments:received:read)
GET /api/open/v1/me/studios/:id/applications        (studios:applications:read)
GET /api/open/v1/me/studios/:id/submissions         (studios:submissions:read)
GET /api/open/v1/me/studios/:id/analytics           (studios:analytics:read)
GET /api/open/v1/me/studios/:id/logs                (studios:logs:read)
GET /api/open/v1/developer/usage?days=7              (developer:usage:read)</pre>
        <el-alert type="info" :closable="false" title="应用新增权限并重新审核通过后，历史令牌不会自动获得新权限，用户必须重新进入授权页确认。" />
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { developerApi } from '@/api/developer'

const scopes = ref([
  { key: 'profile:read', name: '读取资料', description: '昵称、头像、简介与公开统计', risk: 'read' }
])

onMounted(async () => {
  try {
    const res = await developerApi.getScopeDocs()
    if (res.code === 200 && Array.isArray(res.data?.scopes)) {
      scopes.value = res.data.scopes
    }
  } catch { /* defaults */ }
})
</script>

<style scoped lang="scss">
.r-devdocs--page {
  min-height: calc(100vh - 64px);
  background: #f7f8fa;
  padding: 24px 16px 48px;
}
.r-devdocs--container {
  max-width: 900px;
  margin: 0 auto;
}
.r-devdocs--header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  h1 { margin: 0; font-size: 22px; }
}
.r-devdocs--card {
  margin-bottom: 14px;
  h2 { margin: 0 0 10px; font-size: 16px; }
  p, ul { color: #555; line-height: 1.7; font-size: 14px; }
}
.r-devdocs--pre {
  background: #1e1e1e;
  color: #e8e8e8;
  padding: 12px 14px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
