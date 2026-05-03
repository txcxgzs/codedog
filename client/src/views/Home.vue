<template>
  <div class="home">
    <div class="home-grid">
      <!-- 主内容区 -->
      <div class="main">
        <!-- 轮播图 -->
        <div class="hero" v-if="banners.length > 0">
          <el-carousel height="420px" :interval="6000" indicator-position="outside" arrow="hover">
            <el-carousel-item v-for="banner in banners" :key="banner.id">
              <a :href="banner.link_url" target="_blank" class="hero-slide">
                <img :src="banner.image_url" :alt="banner.title" class="hero-image" />
                <div class="hero-overlay">
                  <span class="hero-label">精选</span>
                  <h2 class="hero-title">{{ banner.title }}</h2>
                </div>
              </a>
            </el-carousel-item>
          </el-carousel>
        </div>

        <!-- 推荐作品 -->
        <section class="section">
          <header class="section-header">
            <div class="section-title">
              <span class="section-emoji">★</span>
              <h3 class="section-heading">推荐作品</h3>
            </div>
            <router-link to="/works" class="section-link">
              查看全部
              <el-icon><ArrowRight /></el-icon>
            </router-link>
          </header>
          <div class="works" v-loading="loadingFeatured">
            <article 
              v-for="work in featuredWorks" 
              :key="work.id" 
              class="work-card"
              @click="$router.push(`/work/${work.codemao_work_id}`)"
            >
              <div class="work-cover">
                <div class="work-image" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <span class="work-type" v-if="work.type">{{ getTypeName(work.type) }}</span>
              </div>
              <div class="work-info">
                <h4 class="work-name">{{ work.name }}</h4>
                <div class="work-meta">
                  <div class="work-author" @click.stop="goUser(work.author)">
                    <el-avatar :size="20" :src="work.author?.avatar || defaultAvatar" />
                    <span>{{ work.author?.nickname || work.author?.username }}</span>
                  </div>
                  <div class="work-stats">
                    <span>{{ formatNum(work.view_times) }}</span>
                    <span>{{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
          <el-empty v-if="!loadingFeatured && featuredWorks.length === 0" description="暂无推荐作品" />
        </section>
        
        <!-- 最新作品 -->
        <section class="section">
          <header class="section-header">
            <div class="section-title">
              <span class="section-emoji">✦</span>
              <h3 class="section-heading">最新作品</h3>
            </div>
            <router-link to="/works" class="section-link">
              查看全部
              <el-icon><ArrowRight /></el-icon>
            </router-link>
          </header>
          <div class="works" v-loading="loadingLatest">
            <article 
              v-for="work in latestWorks" 
              :key="work.id" 
              class="work-card"
              @click="$router.push(`/work/${work.codemao_work_id}`)"
            >
              <div class="work-cover">
                <div class="work-image" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <span class="work-type" v-if="work.type">{{ getTypeName(work.type) }}</span>
              </div>
              <div class="work-info">
                <h4 class="work-name">{{ work.name }}</h4>
                <div class="work-meta">
                  <div class="work-author" @click.stop="goUser(work.author)">
                    <el-avatar :size="20" :src="work.author?.avatar || defaultAvatar" />
                    <span>{{ work.author?.nickname || work.author?.username }}</span>
                  </div>
                  <div class="work-stats">
                    <span>{{ formatNum(work.view_times) }}</span>
                    <span>{{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
          <el-empty v-if="!loadingLatest && latestWorks.length === 0" description="暂无作品" />
        </section>
        
        <!-- 热门作品 -->
        <section class="section">
          <header class="section-header">
            <div class="section-title">
              <span class="section-emoji">◈</span>
              <h3 class="section-heading">热门作品</h3>
            </div>
            <router-link to="/works?sortBy=popular" class="section-link">
              查看全部
              <el-icon><ArrowRight /></el-icon>
            </router-link>
          </header>
          <div class="works" v-loading="loadingHot">
            <article 
              v-for="work in hotWorks" 
              :key="work.id" 
              class="work-card"
              @click="$router.push(`/work/${work.codemao_work_id}`)"
            >
              <div class="work-cover">
                <div class="work-image" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <span class="work-type" v-if="work.type">{{ getTypeName(work.type) }}</span>
              </div>
              <div class="work-info">
                <h4 class="work-name">{{ work.name }}</h4>
                <div class="work-meta">
                  <div class="work-author" @click.stop="goUser(work.author)">
                    <el-avatar :size="20" :src="work.author?.avatar || defaultAvatar" />
                    <span>{{ work.author?.nickname || work.author?.username }}</span>
                  </div>
                  <div class="work-stats">
                    <span>{{ formatNum(work.view_times) }}</span>
                    <span>{{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
          <el-empty v-if="!loadingHot && hotWorks.length === 0" description="暂无作品" />
        </section>
      </div>
      
      <!-- 侧边栏 -->
      <aside class="sidebar">
        <!-- 用户卡片 -->
        <div class="card user-card" v-if="userStore.isLoggedIn">
          <div class="user-header">
            <el-avatar :size="52" :src="userStore.user?.avatar || defaultAvatar" class="user-avatar" />
            <div class="user-info">
              <h4 class="user-name">{{ userStore.user?.nickname || userStore.user?.username }}</h4>
              <span class="user-level">Lv.{{ userStore.user?.level || 1 }}</span>
            </div>
          </div>
          <p class="user-bio">{{ userStore.user?.bio || '这个人很懒，什么都没写~' }}</p>
          <el-button type="primary" class="btn-full" @click="$router.push('/publish')">
            发布作品
          </el-button>
          <div class="user-actions">
            <router-link to="/profile" class="action">个人中心</router-link>
            <router-link to="/my-works" class="action">我的作品</router-link>
          </div>
        </div>
        
        <!-- 登录卡片 -->
        <div class="card login-card" v-else>
          <div class="login-icon">◈</div>
          <h4 class="login-title">欢迎来到编程狗</h4>
          <p class="login-desc">登录后可以发布作品、评论互动</p>
          <el-button type="primary" size="large" @click="$router.push('/login')">立即登录</el-button>
        </div>
        
        <!-- 重要通知 -->
        <div class="card" v-if="importantPosts.length > 0">
          <h4 class="card-title">
            <span class="card-icon">!</span>
            重要通知
          </h4>
          <div class="notice-list">
            <div 
              v-for="post in importantPosts" 
              :key="post.id" 
              class="notice-item"
              @click="$router.push(`/post/${post.id}`)"
            >
              <el-tag size="small" type="danger" effect="plain">重要</el-tag>
              <span class="notice-title">{{ post.title }}</span>
            </div>
          </div>
        </div>
        
        <!-- 精选帖子 -->
        <div class="card" v-if="featuredPosts.length > 0">
          <h4 class="card-title">
            <span class="card-icon">✦</span>
            精选帖子
          </h4>
          <div class="post-list">
            <div 
              v-for="post in featuredPosts" 
              :key="post.id" 
              class="post-item"
              @click="$router.push(`/post/${post.id}`)"
            >
              <span class="post-title">{{ post.title }}</span>
              <span class="post-views">{{ formatNum(post.view_count) }} 阅读</span>
            </div>
          </div>
        </div>
        
        <!-- 活跃用户 -->
        <div class="card" v-if="activeUsers.length > 0">
          <h4 class="card-title">
            <span class="card-icon">★</span>
            活跃用户
          </h4>
          <div class="user-list">
            <div 
              v-for="user in activeUsers" 
              :key="user.id" 
              class="user-item"
              @click="goUser(user)"
            >
              <el-avatar :size="40" :src="user.avatar || defaultAvatar" />
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
import { ArrowRight } from '@element-plus/icons-vue'
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
// 轮播图样式
:deep(.el-carousel__indicators--outside) {
  margin-top: var(--space-4);
}

:deep(.el-carousel__button) {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d4d4d4;
  opacity: 1;
}

:deep(.el-carousel__indicator.is-active .el-carousel__button) {
  background: var(--primary-color);
  width: 24px;
  border-radius: 3px;
}

.home {
  padding: var(--space-8) 0 var(--space-12);
}

.home-grid {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--space-6);
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--space-8);
  align-items: start;
}

.main {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  position: sticky;
  top: 96px;
}

// 轮播图
.hero {
  :deep(.el-carousel) {
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-md);
  }
}

.hero-slide {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s var(--ease-out);
  
  .hero-slide:hover & {
    transform: scale(1.03);
  }
}

.hero-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-8);
  background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.hero-label {
  display: inline-block;
  width: fit-content;
  padding: var(--space-1) var(--space-3);
  background: var(--primary-color);
  color: var(--text-color);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: var(--radius);
}

.hero-title {
  color: #fff;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

// 区块
.section {
  background: var(--white);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  border: 1px solid var(--border-color);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  
  .section-emoji {
    font-size: 1.25rem;
    color: var(--primary-color);
  }
  
  .section-heading {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0;
    letter-spacing: -0.01em;
  }
}

.section-link {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color var(--duration-fast) var(--ease-out);
  
  &:hover {
    color: var(--primary-color);
  }
}

// 作品网格
.works {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.work-card {
  background: var(--white);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--border-light);
  transition: all var(--duration) var(--ease-out);
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--primary-light);
    
    .work-image {
      transform: scale(1.05);
    }
  }
  
  .work-cover {
    position: relative;
    padding-bottom: 100%;
    background: linear-gradient(135deg, #f5f5f5, #e5e5e5);
    overflow: hidden;
  }
  
  .work-image {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    transition: transform 0.5s var(--ease-out);
  }
  
  .work-type {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    padding: var(--space-1) var(--space-2);
    background: var(--primary-color);
    color: var(--text-color);
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: var(--radius);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  
  .work-info {
    padding: var(--space-3);
  }
  
  .work-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 var(--space-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .work-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .work-author {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: 0.75rem;
    color: var(--text-secondary);
    
    &:hover {
      color: var(--primary-color);
    }
  }
  
  .work-stats {
    display: flex;
    gap: var(--space-2);
    font-size: 0.6875rem;
    color: var(--text-muted);
  }
}

// 侧边栏卡片
.card {
  background: var(--white);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  border: 1px solid var(--border-color);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-4);
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-color);
  
  .card-icon {
    color: var(--primary-color);
  }
}

// 用户卡片
.user-card {
  .user-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  
  .user-avatar {
    border: 2px solid var(--primary-light);
  }
  
  .user-info {
    flex: 1;
  }
  
  .user-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 var(--space-1);
  }
  
  .user-level {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--primary-color);
    background: var(--primary-bg);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius);
  }
  
  .user-bio {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0 0 var(--space-4);
    padding: var(--space-3);
    background: var(--primary-bg);
    border-radius: var(--radius);
    border-left: 3px solid var(--primary-color);
  }
  
  .btn-full {
    width: 100%;
    font-weight: 700;
  }
  
  .user-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
    
    .action {
      flex: 1;
      text-align: center;
      padding: var(--space-2);
      background: var(--primary-bg);
      color: var(--text-secondary);
      font-size: 0.8125rem;
      font-weight: 600;
      border-radius: var(--radius);
      transition: all var(--duration-fast) var(--ease-out);
      
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
    font-size: 3rem;
    color: var(--primary-color);
    margin-bottom: var(--space-2);
  }
  
  .login-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 var(--space-2);
  }
  
  .login-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0 0 var(--space-4);
  }
}

// 通知列表
.notice-list,
.post-list,
.user-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.notice-item,
.post-item {
  padding: var(--space-3);
  background: var(--primary-bg);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  
  &:hover {
    background: var(--white);
    box-shadow: var(--shadow-sm);
    transform: translateX(4px);
  }
  
  .notice-title,
  .post-title {
    flex: 1;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .post-views {
    font-size: 0.6875rem;
    color: var(--text-muted);
  }
}

.user-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  
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
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius);
  }
}

// 响应式
@media (max-width: 1280px) {
  .works {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1024px) {
  .sidebar {
    display: none;
  }
  
  .home-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .home {
    padding: var(--space-5) 0 var(--space-8);
  }
  
  .home-grid {
    padding: 0 var(--space-4);
  }
  
  .works {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  
  .section {
    padding: var(--space-4);
  }
  
  .hero :deep(.el-carousel) {
    height: 240px !important;
  }
}
</style>
