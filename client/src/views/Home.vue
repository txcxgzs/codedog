<template>
  <div class="home">
    <div class="container">
      <!-- 主内容 -->
      <div class="main-content">
        <!-- 轮播图 -->
        <div class="hero" v-if="banners.length > 0">
          <el-carousel height="400px" :interval="5000" trigger="click" arrow="hover">
            <el-carousel-item v-for="banner in banners" :key="banner.id">
              <a :href="banner.link_url" target="_blank" class="hero-link">
                <img :src="banner.image_url" :alt="banner.title" class="hero-image" />
                <div class="hero-overlay">
                  <span class="hero-badge">精选</span>
                  <h2 class="hero-title">{{ banner.title }}</h2>
                </div>
              </a>
            </el-carousel-item>
          </el-carousel>
        </div>

        <!-- 推荐作品 -->
        <section class="section">
          <div class="section-header">
            <div class="section-title">
              <div class="title-icon"></div>
              <h3 class="title-text">推荐作品</h3>
            </div>
            <router-link to="/works" class="more-link">查看全部</router-link>
          </div>
          <div class="works-grid" v-loading="loadingFeatured">
            <div v-for="work in featuredWorks" :key="work.id" class="work-card" @click="$router.push(`/work/${work.codemao_work_id}`)">
              <div class="work-cover">
                <div class="work-image" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <span class="work-badge" v-if="work.type">{{ getTypeName(work.type) }}</span>
              </div>
              <div class="work-body">
                <h4 class="work-name">{{ work.name }}</h4>
                <div class="work-meta">
                  <div class="author" @click.stop="goUser(work.author)">
                    <el-avatar :size="18" :src="work.author?.avatar || defaultAvatar" />
                    <span>{{ work.author?.nickname || work.author?.username }}</span>
                  </div>
                  <div class="stats">
                    <span>{{ formatNum(work.view_times) }}</span>
                    <span>{{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-if="!loadingFeatured && featuredWorks.length === 0" description="暂无推荐作品" />
        </section>
        
        <!-- 最新作品 -->
        <section class="section">
          <div class="section-header">
            <div class="section-title">
              <div class="title-icon"></div>
              <h3 class="title-text">最新作品</h3>
            </div>
            <router-link to="/works" class="more-link">查看全部</router-link>
          </div>
          <div class="works-grid" v-loading="loadingLatest">
            <div v-for="work in latestWorks" :key="work.id" class="work-card" @click="$router.push(`/work/${work.codemao_work_id}`)">
              <div class="work-cover">
                <div class="work-image" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <span class="work-badge" v-if="work.type">{{ getTypeName(work.type) }}</span>
              </div>
              <div class="work-body">
                <h4 class="work-name">{{ work.name }}</h4>
                <div class="work-meta">
                  <div class="author" @click.stop="goUser(work.author)">
                    <el-avatar :size="18" :src="work.author?.avatar || defaultAvatar" />
                    <span>{{ work.author?.nickname || work.author?.username }}</span>
                  </div>
                  <div class="stats">
                    <span>{{ formatNum(work.view_times) }}</span>
                    <span>{{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-if="!loadingLatest && latestWorks.length === 0" description="暂无作品" />
        </section>
        
        <!-- 热门作品 -->
        <section class="section">
          <div class="section-header">
            <div class="section-title">
              <div class="title-icon"></div>
              <h3 class="title-text">热门作品</h3>
            </div>
            <router-link to="/works?sortBy=popular" class="more-link">查看全部</router-link>
          </div>
          <div class="works-grid" v-loading="loadingHot">
            <div v-for="work in hotWorks" :key="work.id" class="work-card" @click="$router.push(`/work/${work.codemao_work_id}`)">
              <div class="work-cover">
                <div class="work-image" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <span class="work-badge" v-if="work.type">{{ getTypeName(work.type) }}</span>
              </div>
              <div class="work-body">
                <h4 class="work-name">{{ work.name }}</h4>
                <div class="work-meta">
                  <div class="author" @click.stop="goUser(work.author)">
                    <el-avatar :size="18" :src="work.author?.avatar || defaultAvatar" />
                    <span>{{ work.author?.nickname || work.author?.username }}</span>
                  </div>
                  <div class="stats">
                    <span>{{ formatNum(work.view_times) }}</span>
                    <span>{{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-if="!loadingHot && hotWorks.length === 0" description="暂无作品" />
        </section>
      </div>
      
      <!-- 侧边栏 -->
      <aside class="sidebar">
        <!-- 用户卡片 -->
        <div class="card user-card" v-if="userStore.isLoggedIn">
          <div class="user-header">
            <el-avatar :size="48" :src="userStore.user?.avatar || defaultAvatar" />
            <div class="user-info">
              <h4 class="user-name">{{ userStore.user?.nickname || userStore.user?.username }}</h4>
              <span class="user-level">Lv.{{ userStore.user?.level || 1 }}</span>
            </div>
          </div>
          <p class="user-bio">{{ userStore.user?.bio || '这个人很懒，什么都没写~' }}</p>
          <el-button type="primary" class="publish-btn" @click="$router.push('/publish')">发布作品</el-button>
          <div class="user-actions">
            <router-link to="/profile" class="action-link">个人中心</router-link>
            <router-link to="/my-works" class="action-link">我的作品</router-link>
          </div>
        </div>
        
        <!-- 登录卡片 -->
        <div class="card login-card" v-else>
          <div class="login-icon"></div>
          <h4 class="login-title">欢迎来到编程狗</h4>
          <p class="login-desc">登录后可以发布作品、评论互动</p>
          <el-button type="primary" size="large" @click="$router.push('/login')">立即登录</el-button>
        </div>
        
        <!-- 重要通知 -->
        <div class="card" v-if="importantPosts.length > 0">
          <h4 class="card-title">
            <span class="title-dot"></span>
            重要通知
          </h4>
          <div class="list">
            <div v-for="post in importantPosts" :key="post.id" class="list-item" @click="$router.push(`/post/${post.id}`)">
              <el-tag size="small" type="danger">重要</el-tag>
              <span class="item-title">{{ post.title }}</span>
            </div>
          </div>
        </div>
        
        <!-- 精选帖子 -->
        <div class="card" v-if="featuredPosts.length > 0">
          <h4 class="card-title">
            <span class="title-dot"></span>
            精选帖子
          </h4>
          <div class="list">
            <div v-for="post in featuredPosts" :key="post.id" class="list-item" @click="$router.push(`/post/${post.id}`)">
              <span class="item-title">{{ post.title }}</span>
              <span class="item-meta">{{ formatNum(post.view_count) }} 阅读</span>
            </div>
          </div>
        </div>
        
        <!-- 活跃用户 -->
        <div class="card" v-if="activeUsers.length > 0">
          <h4 class="card-title">
            <span class="title-dot"></span>
            活跃用户
          </h4>
          <div class="users-list">
            <div v-for="user in activeUsers" :key="user.id" class="user-item" @click="goUser(user)">
              <el-avatar :size="36" :src="user.avatar || defaultAvatar" />
              <div class="user-item-info">
                <span class="user-item-name">{{ user.nickname || user.username }}</span>
                <span class="user-item-exp">{{ user.experience }} 经验</span>
              </div>
              <span class="user-item-level">Lv.{{ user.level }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { publicApi } from '@/api/public'
import { workApi } from '@/api/work'
import { postApi } from '@/api/post'

const router = useRouter()
const userStore = useUserStore()
const banners = ref([])
const featuredWorks = ref([])
const latestWorks = ref([])
const hotWorks = ref([])
const activeUsers = ref([])
const featuredPosts = ref([])
const importantPosts = ref([])
const loadingFeatured = ref(false)
const loadingLatest = ref(false)
const loadingHot = ref(false)

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzBmMGYwZiI+8J+RqjwvdGV4dD48L3N2Zz4='

const formatNum = (n) => {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n
}

const getTypeName = (workType) => {
  if (!workType) return ''
  const type = workType.toUpperCase()
  const typeMap = {
    'KITTEN': 'Kitten',
    'NEMO': 'Nemo',
    'COCO': 'Coco',
    'WOOD': 'Wood',
    'BOX': 'Box',
    'BOX2': 'Box 2',
    'CODE_BLOCK': '代码岛',
    'PYTHON': 'Python',
    'SCRATCH': 'Scratch',
    'NEKO': 'Neko'
  }
  return typeMap[type] || workType
}

const goUser = (author) => {
  if (!author) return
  if (author.codemao_user_id) {
    router.push(`/user/${author.codemao_user_id}`)
  } else if (author.id) {
    router.push(`/user/${author.id}`)
  }
}

onMounted(async () => {
  try {
    const bRes = await publicApi.getBanners()
    if (bRes.code === 200) banners.value = bRes.data
  } catch (e) {}
  
  try {
    const uRes = await publicApi.getActiveUsers()
    if (uRes.code === 200) activeUsers.value = uRes.data
  } catch (e) {}

  try {
    const pRes = await postApi.getPosts({ page: 1, pageSize: 4, category: 'essence' })
    if (pRes.code === 200) featuredPosts.value = pRes.data.list
  } catch (e) {}

  try {
    const impRes = await postApi.getPosts({ page: 1, pageSize: 2, isTop: true, category: 'official' })
    if (impRes.code === 200) importantPosts.value = impRes.data.list
  } catch (e) {}
  
  loadingFeatured.value = true
  try {
    const res = await workApi.getFeatured()
    if (res.code === 200) featuredWorks.value = res.data.slice(0, 8)
  } catch (e) {}
  loadingFeatured.value = false
  
  loadingLatest.value = true
  try {
    const res = await workApi.getList({ page: 1, pageSize: 8 })
    if (res.code === 200) latestWorks.value = res.data.list
  } catch (e) {}
  loadingLatest.value = false
  
  loadingHot.value = true
  try {
    const res = await workApi.getList({ page: 1, pageSize: 8, sortBy: 'popular' })
    if (res.code === 200) hotWorks.value = res.data.list
  } catch (e) {}
  loadingHot.value = false
})
</script>

<style lang="scss" scoped>
.home {
  padding: 48px 0;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 32px;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 48px;
  align-items: start;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 96px;
}

// 轮播图
:deep(.el-carousel__indicators) {
  bottom: 20px;
}

:deep(.el-carousel__indicator .el-carousel__button) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  opacity: 1;
}

:deep(.el-carousel__indicator.is-active .el-carousel__button) {
  background: var(--primary-color);
  width: 24px;
  border-radius: 4px;
}

.hero {
  :deep(.el-carousel) {
    border-radius: 20px;
    overflow: hidden;
  }
}

.hero-link {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s ease;
  
  .hero-link:hover & {
    transform: scale(1.03);
  }
}

.hero-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 48px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
}

.hero-badge {
  display: inline-block;
  padding: 4px 12px;
  background: var(--primary-color);
  color: #0f0f0f;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 6px;
  margin-bottom: 12px;
}

.hero-title {
  color: #fff;
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
}

// 区块
.section {
  background: var(--white);
  border-radius: 20px;
  padding: 32px;
  border: 1px solid var(--border-color);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .title-icon {
    width: 8px;
    height: 8px;
    background: var(--primary-color);
    border-radius: 50%;
  }
  
  .title-text {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0;
  }
}

.more-link {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s ease;
  
  &:hover {
    color: var(--primary-color);
  }
}

// 作品网格
.works-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.work-card {
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  background: var(--white);
  border: 1px solid var(--border-light);
  transition: all 0.25s ease;
  
  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12);
    border-color: var(--primary-light);
    
    .work-image {
      transform: scale(1.05);
    }
  }
  
  .work-cover {
    position: relative;
    padding-bottom: 100%;
    background: linear-gradient(135deg, #f5f5f5, #e8e8e8);
    overflow: hidden;
  }
  
  .work-image {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    transition: transform 0.5s ease;
  }
  
  .work-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 4px 10px;
    background: var(--primary-color);
    color: #0f0f0f;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    border-radius: 6px;
  }
  
  .work-body {
    padding: 14px;
  }
  
  .work-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .work-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .author {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--text-secondary);
    
    &:hover {
      color: var(--primary-color);
    }
  }
  
  .stats {
    display: flex;
    gap: 10px;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }
}

// 侧边栏卡片
.card {
  background: var(--white);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid var(--border-color);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 20px;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-color);
  
  .title-dot {
    width: 8px;
    height: 8px;
    background: var(--primary-color);
    border-radius: 50%;
  }
}

// 用户卡片
.user-card {
  .user-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }
  
  .user-info {
    flex: 1;
  }
  
  .user-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 4px;
  }
  
  .user-level {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--primary-color);
    background: var(--primary-bg);
    padding: 2px 8px;
    border-radius: 6px;
  }
  
  .user-bio {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0 0 16px;
    padding: 12px;
    background: var(--primary-bg);
    border-radius: 10px;
    border-left: 3px solid var(--primary-color);
    line-height: 1.5;
  }
  
  .publish-btn {
    width: 100%;
    font-weight: 700;
  }
  
  .user-actions {
    display: flex;
    gap: 10px;
    margin-top: 12px;
    
    .action-link {
      flex: 1;
      text-align: center;
      padding: 10px;
      background: var(--primary-bg);
      color: var(--text-secondary);
      font-size: 0.8125rem;
      font-weight: 600;
      border-radius: 10px;
      text-decoration: none;
      transition: all 0.2s ease;
      
      &:hover {
        background: var(--primary-light);
        color: var(--text-color);
      }
    }
  }
}

// 登录卡片
.login-card {
  text-align: center;
  background: linear-gradient(135deg, var(--primary-bg), var(--white));
  
  .login-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 12px;
    background: var(--primary-color);
    border-radius: 12px;
    position: relative;
    
    &::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      background: #0f0f0f;
      border-radius: 6px;
    }
    
    &::after {
      content: '';
      position: absolute;
      top: 16px;
      left: 16px;
      width: 12px;
      height: 12px;
      background: var(--primary-color);
      border-radius: 50%;
    }
  }
  
  .login-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 8px;
  }
  
  .login-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0 0 20px;
  }
}

// 列表
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list-item {
  padding: 12px;
  background: var(--primary-bg);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 10px;
  
  &:hover {
    background: var(--white);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    transform: translateX(4px);
  }
  
  .item-title {
    flex: 1;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .item-meta {
    font-size: 0.6875rem;
    color: var(--text-muted);
  }
}

// 用户列表
.users-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--primary-bg);
  }
  
  .user-item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .user-item-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-color);
  }
  
  .user-item-exp {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  
  .user-item-level {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--primary-color);
    background: var(--primary-bg);
    padding: 2px 8px;
    border-radius: 6px;
  }
}

// 响应式
@media (max-width: 1280px) {
  .works-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1024px) {
  .sidebar {
    display: none;
  }
  
  .container {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .home {
    padding: 24px 0;
  }
  
  .container {
    padding: 0 16px;
  }
  
  .works-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .section {
    padding: 20px;
  }
  
  .hero :deep(.el-carousel) {
    height: 220px !important;
  }
}
</style>
