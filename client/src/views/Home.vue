<template>
  <div class="home-page">
    <div class="home-container">
      <!-- 左侧主内容 -->
      <div class="main-column">
        <!-- 轮播图 - 优雅设计 -->
        <div class="banner-area" v-if="banners.length > 0">
          <el-carousel height="380px" :interval="5000" indicator-position="outside" :autoplay="true" arrow="hover">
            <el-carousel-item v-for="banner in banners" :key="banner.id">
              <a :href="banner.link_url" target="_blank" class="banner-item">
                <img :src="banner.image_url" :alt="banner.title" class="banner-image" />
                <div class="banner-overlay">
                  <h3 class="banner-title">{{ banner.title }}</h3>
                </div>
              </a>
            </el-carousel-item>
          </el-carousel>
        </div>

        <!-- 推荐作品 -->
        <div class="section">
          <div class="section-header">
            <div class="section-title">
              <span class="section-icon">⭐</span>
              <span class="section-text">推荐作品</span>
            </div>
            <router-link to="/works" class="section-more">
              查看更多 <el-icon><ArrowRight /></el-icon>
            </router-link>
          </div>
          <div class="work-grid" v-loading="loadingFeatured">
            <div v-for="work in featuredWorks" :key="work.id" class="work-card" @click="$router.push(`/work/${work.codemao_work_id}`)">
              <div class="work-cover">
                <div class="work-image" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <div class="work-overlay">
                  <span class="work-tag" v-if="work.type">{{ getTypeName(work.type) }}</span>
                </div>
              </div>
              <div class="work-body">
                <p class="work-title" :title="work.name">{{ work.name }}</p>
                <div class="work-bottom">
                  <div class="author-info" @click.stop="goUser(work.author)">
                    <el-avatar :size="20" :src="work.author?.avatar || defaultAvatar" class="author-avatar" />
                    <span class="author-name">{{ work.author?.nickname || work.author?.username }}</span>
                  </div>
                  <div class="work-stats">
                    <span class="stat-item">👁 {{ formatNum(work.view_times) }}</span>
                    <span class="stat-item">❤️ {{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-if="!loadingFeatured && featuredWorks.length === 0" description="暂无推荐作品" />
        </div>
        
        <!-- 最新作品 -->
        <div class="section">
          <div class="section-header">
            <div class="section-title">
              <span class="section-icon">✨</span>
              <span class="section-text">最新作品</span>
            </div>
            <router-link to="/works" class="section-more">
              查看更多 <el-icon><ArrowRight /></el-icon>
            </router-link>
          </div>
          <div class="work-grid" v-loading="loadingLatest">
            <div v-for="work in latestWorks" :key="work.id" class="work-card" @click="$router.push(`/work/${work.codemao_work_id}`)">
              <div class="work-cover">
                <div class="work-image" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <div class="work-overlay">
                  <span class="work-tag" v-if="work.type">{{ getTypeName(work.type) }}</span>
                </div>
              </div>
              <div class="work-body">
                <p class="work-title" :title="work.name">{{ work.name }}</p>
                <div class="work-bottom">
                  <div class="author-info" @click.stop="goUser(work.author)">
                    <el-avatar :size="20" :src="work.author?.avatar || defaultAvatar" class="author-avatar" />
                    <span class="author-name">{{ work.author?.nickname || work.author?.username }}</span>
                  </div>
                  <div class="work-stats">
                    <span class="stat-item">👁 {{ formatNum(work.view_times) }}</span>
                    <span class="stat-item">❤️ {{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-if="!loadingLatest && latestWorks.length === 0" description="暂无作品" />
        </div>
        
        <!-- 热门作品 -->
        <div class="section">
          <div class="section-header">
            <div class="section-title">
              <span class="section-icon">🔥</span>
              <span class="section-text">热门作品</span>
            </div>
            <router-link to="/works?sortBy=popular" class="section-more">
              查看更多 <el-icon><ArrowRight /></el-icon>
            </router-link>
          </div>
          <div class="work-grid" v-loading="loadingHot">
            <div v-for="work in hotWorks" :key="work.id" class="work-card" @click="$router.push(`/work/${work.codemao_work_id}`)">
              <div class="work-cover">
                <div class="work-image" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <div class="work-overlay">
                  <span class="work-tag" v-if="work.type">{{ getTypeName(work.type) }}</span>
                </div>
              </div>
              <div class="work-body">
                <p class="work-title" :title="work.name">{{ work.name }}</p>
                <div class="work-bottom">
                  <div class="author-info" @click.stop="goUser(work.author)">
                    <el-avatar :size="20" :src="work.author?.avatar || defaultAvatar" class="author-avatar" />
                    <span class="author-name">{{ work.author?.nickname || work.author?.username }}</span>
                  </div>
                  <div class="work-stats">
                    <span class="stat-item">👁 {{ formatNum(work.view_times) }}</span>
                    <span class="stat-item">❤️ {{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-if="!loadingHot && hotWorks.length === 0" description="暂无作品" />
        </div>
      </div>
      
      <!-- 右侧边栏 - 优雅设计 -->
      <aside class="sidebar">
        <!-- 用户卡片 -->
        <div class="side-card user-card" v-if="userStore.isLoggedIn">
          <div class="user-header">
            <el-avatar :size="56" :src="userStore.user?.avatar || defaultAvatar" class="user-avatar-lg" />
            <div class="user-info-lg">
              <h4 class="user-name">{{ userStore.user?.nickname || userStore.user?.username }}</h4>
              <span class="user-level-lg">Lv.{{ userStore.user?.level || 1 }} • {{ userStore.user?.experience || 0 }} 经验</span>
            </div>
          </div>
          <p class="user-bio">{{ userStore.user?.bio || '这个人很懒，什么都没写~' }}</p>
          <el-button type="primary" class="publish-btn-full" @click="$router.push('/publish')">
            <el-icon><EditPen /></el-icon>
            发布作品
          </el-button>
          <div class="action-buttons">
            <router-link to="/profile" class="action-btn">
              <span class="action-icon">👤</span>
              个人中心
            </router-link>
            <router-link to="/my-works" class="action-btn">
              <span class="action-icon">📁</span>
              我的作品
            </router-link>
          </div>
        </div>
        
        <!-- 登录卡片 -->
        <div class="side-card login-card" v-else>
          <div class="login-icon">🐕</div>
          <h4 class="login-title">欢迎来到编程狗</h4>
          <p class="login-desc">登录后可以发布作品、评论互动</p>
          <el-button type="primary" size="large" @click="$router.push('/login')">立即登录</el-button>
          <el-button text @click="$router.push('/register')">注册账号</el-button>
        </div>
        
        <!-- 重要通知 -->
        <div class="side-card important-notices" v-if="importantPosts.length > 0">
          <h4 class="side-card-title">
            <span class="title-icon">📢</span>
            重要通知
          </h4>
          <div class="notice-list">
            <div v-for="post in importantPosts" :key="post.id" class="notice-item important" @click="$router.push(`/post/${post.id}`)">
              <div class="notice-content">
                <el-tag size="small" type="danger" effect="plain" class="notice-tag">重要</el-tag>
                <span class="notice-title">{{ post.title }}</span>
              </div>
              <div class="notice-meta">
                <span class="notice-author">{{ post.author?.nickname || post.author?.username }}</span>
                <span class="notice-time">{{ formatTime(post.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 精选帖子 -->
        <div class="side-card featured-posts" v-if="featuredPosts.length > 0">
          <h4 class="side-card-title">
            <span class="title-icon">✨</span>
            精选帖子
          </h4>
          <div class="post-list">
            <div v-for="post in featuredPosts" :key="post.id" class="post-item" @click="$router.push(`/post/${post.id}`)">
              <div class="post-title">{{ post.title }}</div>
              <div class="post-meta">
                <span class="post-author">{{ post.author?.nickname || post.author?.username }}</span>
                <span class="post-views">{{ formatNum(post.view_count) }} 阅读</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 活跃用户 -->
        <div class="side-card active-users" v-if="activeUsers.length > 0">
          <h4 class="side-card-title">
            <span class="title-icon">🏆</span>
            活跃用户
          </h4>
          <div class="user-list">
            <div v-for="user in activeUsers" :key="user.id" class="user-list-item" @click="goUser(user)">
              <div class="user-avatar-wrap">
                <el-avatar :size="44" :src="user.avatar || defaultAvatar" class="user-list-avatar" />
                <span class="user-level-badge">Lv.{{ user.level }}</span>
              </div>
              <div class="user-list-info">
                <span class="user-list-name" :title="user.nickname">{{ user.nickname || user.username }}</span>
                <span class="user-list-exp">{{ user.experience }} 经验</span>
              </div>
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
import { ElMessage } from 'element-plus'
import { ArrowRight, EditPen } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { publicApi } from '@/api/public'
import { workApi } from '@/api/work'
import { postApi } from '@/api/post'

const router = useRouter()
const userStore = useUserStore()
const banners = ref([])
const announcements = ref([])
const featuredWorks = ref([])
const latestWorks = ref([])
const hotWorks = ref([])
const activeUsers = ref([])
const featuredPosts = ref([])
const importantPosts = ref([])
const loadingFeatured = ref(false)
const loadingLatest = ref(false)
const loadingHot = ref(false)

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2FhYyI+8J+RqOKAjfCfkrs8L3RleHQ+PC9zdmc+'

const formatNum = (n) => {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  
  return date.toLocaleDateString('zh-CN')
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
    const aRes = await publicApi.getAnnouncements()
    if (aRes.code === 200) announcements.value = aRes.data
  } catch (e) {}

  try {
    const uRes = await publicApi.getActiveUsers()
    if (uRes.code === 200) activeUsers.value = uRes.data
  } catch (e) {}

  try {
    const pRes = await postApi.getPosts({ page: 1, pageSize: 4, category: 'essence' })
    if (pRes.code === 200) {
      featuredPosts.value = pRes.data.list
    }
  } catch (e) {}

  try {
    const impRes = await postApi.getPosts({ page: 1, pageSize: 2, isTop: true, category: 'official' })
    if (impRes.code === 200) {
      importantPosts.value = impRes.data.list
    }
  } catch (e) {}
  
  loadingFeatured.value = true
  try {
    const res = await workApi.getFeatured()
    if (res.code === 200) featuredWorks.value = res.data.slice(0, 10)
  } catch (e) {}
  loadingFeatured.value = false
  
  loadingLatest.value = true
  try {
    const res = await workApi.getList({ page: 1, pageSize: 10 })
    if (res.code === 200) latestWorks.value = res.data.list
  } catch (e) {}
  loadingLatest.value = false
  
  loadingHot.value = true
  try {
    const res = await workApi.getList({ page: 1, pageSize: 10, sortBy: 'popular' })
    if (res.code === 200) hotWorks.value = res.data.list
  } catch (e) {}
  loadingHot.value = false
})
</script>

<style lang="scss" scoped>
// 轮播图样式
:deep(.el-carousel__indicators--outside) {
  margin-top: 12px;
}

:deep(.el-carousel__button) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d5db;
  opacity: 1;
  transition: all 0.3s;
}

:deep(.el-carousel__indicator.is-active .el-carousel__button) {
  background: var(--primary-color);
  width: 28px;
  border-radius: 4px;
}

.home-page {
  min-height: 100%;
  padding: var(--spacing-lg) 0 var(--spacing-xl);
}

.home-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--spacing);
  display: flex;
  gap: var(--spacing-xl);
  align-items: flex-start;
}

.main-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing);
  position: sticky;
  top: 92px;
}

// 轮播图区域
.banner-area {
  width: 100%;
  
  :deep(.el-carousel) {
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow);
  }
}

.banner-item {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: var(--radius-xl);
  overflow: hidden;
  text-decoration: none;
}

.banner-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  border-radius: var(--radius-xl);
  transition: transform var(--duration-slow);
  
  .banner-item:hover & {
    transform: scale(1.05);
  }
}

.banner-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px 28px;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
}

.banner-title {
  color: #fff;
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

// 区域通用样式
.section {
  background: var(--white);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  border: 1px solid var(--border-color);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  
  .section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    
    .section-icon {
      font-size: 22px;
    }
    
    .section-text {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-color);
      letter-spacing: -0.3px;
    }
  }
}

.section-more {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
  text-decoration: none;
  transition: all var(--duration);
  
  &:hover {
    color: var(--primary-color);
    transform: translateX(2px);
  }
}

// 作品卡片网格
.work-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--spacing);
}

.work-card {
  background: var(--white);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--duration);
  cursor: pointer;
  border: 1px solid var(--border-light);
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--primary-light);
  }
  
  .work-cover {
    position: relative;
    padding-bottom: 100%; // 1:1 比例
    background: linear-gradient(135deg, #f5f7fa, #e8ecef);
    border-bottom: 1px solid var(--border-light);
  }
  
  .work-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    transition: transform var(--duration-slow);
  }
  
  .work-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.3));
    opacity: 0;
    transition: opacity var(--duration);
    
    .work-card:hover & {
      opacity: 1;
    }
  }
  
  .work-tag {
    position: absolute;
    top: 10px;
    left: 10px;
    background: var(--primary-color);
    color: var(--text-color);
    font-size: 11px;
    padding: 4px 10px;
    border-radius: var(--radius-round);
    font-weight: 600;
    z-index: 1;
    box-shadow: var(--shadow-sm);
  }
  
  .work-body {
    padding: var(--spacing);
  }
  
  .work-title {
    font-size: 14px;
    color: var(--text-color);
    margin-bottom: var(--spacing-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
    line-height: 1.4;
  }
  
  .work-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.author-info {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
  
  .author-avatar {
    flex-shrink: 0;
  }
  
  .author-name {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
    font-weight: 500;
    
    &:hover {
      color: var(--primary-color);
    }
  }
}

.work-stats {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 12px;
    color: var(--text-muted);
  }
}

// 侧边栏卡片
.side-card {
  background: var(--white);
  border-radius: var(--radius-xl);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-color);
}

.side-card-title {
  margin: 0 0 var(--spacing-lg);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
  
  .title-icon {
    font-size: 18px;
  }
}

// 用户卡片
.user-card {
  .user-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: var(--spacing);
  }
  
  .user-avatar-lg {
    border: 3px solid var(--primary-light);
    box-shadow: var(--shadow-sm);
  }
  
  .user-info-lg {
    flex: 1;
    min-width: 0;
    
    .user-name {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 700;
      color: var(--text-color);
    }
    
    .user-level-lg {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }
  }
  
  .user-bio {
    margin: 0 0 var(--spacing);
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    background: var(--primary-bg);
    padding: 12px;
    border-radius: var(--radius);
    border-left: 3px solid var(--primary-color);
  }
  
  .publish-btn-full {
    width: 100%;
    height: 44px;
    font-weight: 600;
    font-size: 14px;
  }
  
  .action-buttons {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
    
    .action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px;
      background: var(--primary-bg);
      color: var(--text-secondary);
      border-radius: var(--radius);
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      transition: all var(--duration);
      
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
    font-size: 48px;
    margin-bottom: var(--spacing-sm);
  }
  
  .login-title {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-color);
  }
  
  .login-desc {
    margin: 0 0 var(--spacing);
    font-size: 13px;
    color: var(--text-secondary);
  }
}

// 通知列表
.notice-list,
.post-list,
.user-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notice-item,
.post-item {
  padding: 12px;
  border-radius: var(--radius);
  background: var(--primary-bg);
  cursor: pointer;
  transition: all var(--duration);
  border: 1px solid transparent;
  
  &:hover {
    background: var(--white);
    border-color: var(--primary-color);
    box-shadow: var(--shadow-sm);
    transform: translateX(4px);
  }
  
  &.important {
    background: linear-gradient(135deg, #fff7ed, var(--white));
  }
  
  .notice-content {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  
  .notice-title,
  .post-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-color);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .notice-meta,
  .post-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-muted);
  }
}

.user-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--duration);
  border: 1px solid var(--border-light);
  
  &:hover {
    background: var(--primary-bg);
    border-color: var(--primary-color);
    transform: translateX(4px);
  }
  
  .user-avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }
  
  .user-list-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  
  .user-list-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .user-list-exp {
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .user-level-badge {
    position: absolute;
    bottom: -4px;
    right: -4px;
    background: var(--primary-color);
    color: var(--text-color);
    font-size: 10px;
    padding: 1px 6px;
    border-radius: var(--radius-round);
    font-weight: 700;
    border: 2px solid var(--white);
    box-shadow: var(--shadow-sm);
  }
}

// 响应式
@media (max-width: 1280px) {
  .work-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1024px) {
  .sidebar {
    display: none;
  }
  
  .work-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .home-container {
    padding: 0 var(--spacing-sm);
  }
  
  .home-page {
    padding: var(--spacing) 0 var(--spacing-lg);
  }
  
  .work-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm);
  }
  
  .section {
    padding: var(--spacing);
    border-radius: var(--radius-lg);
  }
  
  .banner-area :deep(.el-carousel) {
    height: 220px !important;
  }
}
</style>
