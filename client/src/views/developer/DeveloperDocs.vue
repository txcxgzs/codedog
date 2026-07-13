<template>
  <div class="r-devdocs--page">
    <div class="r-devdocs--container">
      <div class="r-devdocs--header">
        <h1>开发者文档</h1>
        <el-button @click="$router.push('/developer')">返回控制台</el-button>
      </div>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>概述</h2>
        <p>编程狗开发者平台提供 OAuth2 授权码模式，让你的应用在用户授权后，只读访问用户的公开资料、作品、评论与帖子。</p>
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
          <el-table-column prop="description" label="说明" />
        </el-table>
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

GET /api/oauth/userinfo   # 等价于 profile:read</pre>
        <p>统一响应：<code>{ code, msg, data }</code>。默认限流约 60 次/分钟/应用+IP。</p>
      </el-card>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>5. 撤销 token</h2>
        <pre class="r-devdocs--pre">POST /api/oauth/revoke
{ "token": "atk_... 或 rtk_..." }</pre>
      </el-card>
    </div>
  </div>

      <el-card shadow="never" class="r-devdocs--card">
        <h2>5. 工作室、关注、收藏与审核</h2>
        <pre class="r-devdocs--pre">GET  /api/open/v1/me/studios?status=active&amp;page=1&amp;pageSize=20
GET  /api/open/v1/me/studios/:id
GET  /api/open/v1/me/followers?page=1&amp;pageSize=20
GET  /api/open/v1/me/following?page=1&amp;pageSize=20
GET  /api/open/v1/me/favorites?page=1&amp;pageSize=20
GET  /api/open/v1/me/likes?page=1&amp;pageSize=20        (scope: favorites:read)

GET  /api/open/v1/studios/pending-review?keyword=xxx     (scope: studios:review, admin)
POST /api/open/v1/studios/:id/review                     (scope: studios, admin)
Body: { action: "approve" | "reject" | "ban", note?: "..." }

审核接口要求 OAuth 用户具备 admin 或 superadmin 角色。</pre>
      </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { developerApi } from '@/api/developer'

const scopes = ref([
  { key: 'profile:read', name: '读取资料', description: '昵称、头像、简介、等级、粉丝/关注/作品数' },
  { key: 'works:read', name: '读取作品', description: '本人已发布且可见的作品列表与详情' },
  { key: 'comments:read', name: '读取评论', description: '本人评论列表' },
  { key: 'posts:read', name: '读取帖子', description: '本人帖子列表与详情' },
  { key: 'studios:read', name: '读取工作室', description: '本人加入的工作室列表与详情、成员和作品' },
  { key: 'follows:read', name: '读取关注关系', description: '本人的关注列表与粉丝列表' },
  { key: 'favorites:read', name: '读取收藏与点赞', description: '本人收藏的作品/帖子与点赞记录' },
  { key: 'studios:review', name: '审核工作室', description: '查看待审核工作室并通过/拒绝（需 app scope + 管理员身份）' }
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
