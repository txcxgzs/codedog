<template>
  <div class="home">
    <div class="container">
      <!-- Hero Banner -->
      <section class="hero" v-if="banners.length > 0">
        <el-carousel height="420px" :interval="6000" trigger="click" arrow="always">
          <el-carousel-item v-for="banner in banners" :key="banner.id">
            <a :href="banner.link_url" target="_blank" class="hero-slide">
              <img :src="banner.image_url" :alt="banner.title" class="hero-img" />
              <div class="hero-overlay">
                <div class="hero-content">
                  <span class="hero-tag">精选</span>
                  <h2 class="hero-title">{{ banner.title }}</h2>
                </div>
              </div>
            </a>
          </el-carousel-item>
        </el-carousel>
      </section>

      <!-- Featured Works -->
      <section class="section featured">
        <header class="section-header">
          <h3 class="section-title">推荐作品</h3>
          <router-link to="/works" class="section-more">查看全部</router-link>
        </header>
        <div class="works-grid" v-loading="loadingFeatured">
          <article 
            v-for="(work, index) in featuredWorks" 
            :key="work.id" 
            class="work-card"
            :style="{ animationDelay: `${index * 0.08}s` }"
            @click="$router.push(`/work/${work.codemao_work_id}`)"
          >
            <div class="work-cover">
              <div class="work-img" :style="{ backgroundImage: `url(${work.preview})` }"></div>
              <span class="work-type" v-if="work.type">{{ getTypeName(work.type) }}</span>
            </div>
            <div class="work-body">
              <h4 class="work-name">{{ work.name }}</h4>
              <div class="work-meta">
                <div class="author" @click.stop="goUser(work.author)">
                  <el-avatar :size="20" :src="work.author?.avatar || defaultAvatar" />
                  <span>{{ work.author?.nickname || work.author?.username }}</span>
                </div>
                <div class="stats">
                  <span>{{ formatNum(work.view_times) }}</span>
                  <span>{{ formatNum(work.praise_times) }}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
        <el-empty v-if="!loadingFeatured && featuredWorks.length === 0" description="暂无推荐作品" />
      </section>

      <!-- Latest Works -->
      <section class="section latest">
        <header class="section-header">
          <h3 class="section-title">最新作品</h3>
          <router-link to="/works" class="section-more">查看全部</router-link>
        </header>
        <div class="works-grid" v-loading="loadingLatest">
          <article 
            v-for="(work, index) in latestWorks" 
            :key="work.id" 
            class="work-card"
            :style="{ animationDelay: `${index * 0.08}s` }"
            @click="$router.push(`/work/${work.codemao_work_id}`)"
          >
            <div class="work-cover">
              <div class="work-img" :style="{ backgroundImage: `url(${work.preview})` }"></div>
              <span class="work-type" v-if="work.type">{{ getTypeName(work.type) }}</span>
            </div>
            <div class="work-body">
              <h4 class="work-name">{{ work.name }}</h4>
              <div class="work-meta">
                <div class="author" @click.stop="goUser(work.author)">
                  <el-avatar :size="20" :src="work.author?.avatar || defaultAvatar" />
                  <span>{{ work.author?.nickname || work.author?.username }}</span>
                </div>
                <div class="stats">
                  <span>{{ formatNum(work.view_times) }}</span>
                  <span>{{ formatNum(work.praise_times) }}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
        <el-empty v-if="!loadingLatest && latestWorks.length === 0" description="暂无作品" />
      </section>

      <!-- Hot Works -->
      <section class="section hot">
        <header class="section-header">
          <h3 class="section-title">热门作品</h3>
          <router-link to="/works?sortBy=popular" class="section-more">查看全部</router-link>
        </header>
        <div class="works-grid" v-loading="loadingHot">
          <article 
            v-for="(work, index) in hotWorks" 
            :key="work.id" 
            class="work-card"
            :style="{ animationDelay: `${index * 0.08}s` }"
            @click="$router.push(`/work/${work.codemao_work_id}`)"
          >
            <div class="work-cover">
              <div class="work-img" :style="{ backgroundImage: `url(${work.preview})` }"></div>
              <span class="work-type" v-if="work.type">{{ getTypeName(work.type) }}</span>
            </div>
            <div class="work-body">
              <h4 class="work-name">{{ work.name }}</h4>
              <div class="work-meta">
                <div class="author" @click.stop="goUser(work.author)">
                  <el-avatar :size="20" :src="work.author?.avatar || defaultAvatar" />
                  <span>{{ work.author?.nickname || work.author?.username }}</span>
                </div>
                <div class="stats">
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

    <!-- Sidebar -->
    <aside class="sidebar">
      <!-- User Card -->
      <div class="card user-card" v-if="userStore.isLoggedIn">
        <div class="user-header">
          <el-avatar :size="56" :src="userStore.user?.avatar || defaultAvatar" />
          <div class="user-info">
            <h4>{{ userStore.user?.nickname || userStore.user?.username }}</h4>
            <span class="level">Lv.{{ userStore.user?.level || 1 }}</span>
          </div>
        </div>
        <p class="bio">{{ userStore.user?.bio || '这个人很懒，什么都没写~' }}</p>
        <el-button type="primary" class="btn-full" @click="$router.push('/publish')">发布作品</el-button>
        <div class="user-links">
          <router-link to="/profile">个人中心</router-link>
          <router-link to="/my-works">我的作品</router-link>
        </div>
      </div>

      <!-- Login Card -->
      <div class="card login-card" v-else>
        <div class="login-mark">
          <svg viewBox="0 0 48 48">
            <rect x="4" y="4" width="40" height="40" rx="12" fill="#FEC433"/>
            <rect x="12" y="12" width="24" height="24" rx="6" fill="#0A0A0A"/>
            <circle cx="20" cy="24" r="4" fill="#FEC433"/>
            <circle cx="28" cy="24" r="4" fill="#FEC433"/>
          </svg>
        </div>
        <h4>欢迎来到编程狗</h4>
        <p>登录后可以发布作品、评论互动</p>
        <el-button type="primary" @click="$router.push('/login')">立即登录</el-button>
      </div>

      <!-- Notices -->
      <div class="card" v-if="importantPosts.length > 0">
        <h5 class="card-title">重要通知</h5>
        <div class="notice-list">
          <div 
            v-for="post in importantPosts" 
            :key="post.id" 
            class="notice"
            @click="$router.push(`/post/${post.id}`)"
          >
            <el-tag size="small" type="danger">重要</el-tag>
            <span>{{ post.title }}</span>
          </div>
        </div>
      </div>

      <!-- Featured Posts -->
      <div class="card" v-if="featuredPosts.length > 0">
        <h5 class="card-title">精选帖子</h5>
        <div class="post-list">
          <div 
            v-for="post in featuredPosts" 
            :key="post.id" 
            class="post"
            @click="$router.push(`/post/${post.id}`)"
          >
            <span class="post-title">{{ post.title }}</span>
            <span class="post-views">{{ formatNum(post.view_count) }} 阅读</span>
          </div>
        </div>
      </div>

      <!-- Active Users -->
      <div class="card" v-if="activeUsers.length > 0">
        <h5 class="card-title">活跃用户</h5>
        <div class="user-list">
          <div 
            v-for="user in activeUsers" 
            :key="user.id" 
            class="user-item"
            @click="goUser(user)"
          >
            <el-avatar :size="40" :src="user.avatar || defaultAvatar" />
            <div class="user-item-info">
              <span class="name">{{ user.nickname || user.username }}</span>
              <span class="exp">{{ user.experience }} 经验</span>
            </div>
            <span class="user-level">Lv.{{ user.level }}</span>
          </div>
        </div>
      </div>
    </aside>
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

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzBhMGEwYSI+8J+SgTwvdGV4dD48L3N2Zz4='

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
  max-width: 1400px;
  margin: 0 auto;
  padding: 48px 40px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 48px;
  align-items: start;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 48px;
}

// Hero
:deep(.el-carousel__indicators--outside) {
  margin-top: 16px;
}

:deep(.el-carousel__button) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d4d4d4;
  opacity: 1;
}

:deep(.el-carousel__indicator.is-active .el-carousel__button) {
  background: var(--primary);
  width: 28px;
  border-radius: 4px;
}

.hero {
  :deep(.el-carousel) {
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }
}

.hero-slide {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
}

.hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s ease;
  
  .hero-slide:hover & {
    transform: scale(1.03);
  }
}

.hero-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 56px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
}

.hero-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero-tag {
  display: inline-block;
  width: fit-content;
  padding: 6px 14px;
  background: var(--primary);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 6px;
}

.hero-title {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
  letter-spacing: -0.02em;
}

// Sections
.section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.section-more {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: var(--primary);
  }
}

// Works Grid
.works-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.work-card {
  cursor: pointer;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeInUp 0.5s ease both;

  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
    border-color: var(--primary);

    .work-img {
      transform: scale(1.08);
    }
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.work-cover {
  position: relative;
  padding-bottom: 100%;
  background: linear-gradient(135deg, #f0f0f0, #e8e8e8);
  overflow: hidden;
}

.work-img {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.work-type {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 10px;
  background: var(--primary);
  color: var(--text);
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-radius: 6px;
}

.work-body {
  padding: 16px;
}

.work-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px;
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
  gap: 8px;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  &:hover {
    color: var(--primary);
  }
}

.stats {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

// Sidebar
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 96px;
}

.card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 24px;
  border: 1px solid var(--border);
}

.card-title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 16px;
}

// User Card
.user-card {
  .user-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .user-info {
    flex: 1;

    h4 {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 4px;
    }

    .level {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--primary);
      background: var(--primary-light);
      padding: 2px 8px;
      border-radius: 6px;
    }
  }

  .bio {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0 0 16px;
    padding: 12px;
    background: var(--primary-light);
    border-radius: 10px;
    border-left: 3px solid var(--primary);
    line-height: 1.5;
  }

  .btn-full {
    width: 100%;
    font-weight: 700;
  }

  .user-links {
    display: flex;
    gap: 10px;
    margin-top: 12px;

    a {
      flex: 1;
      text-align: center;
      padding: 10px;
      background: var(--primary-light);
      color: var(--text-secondary);
      font-size: 0.8125rem;
      font-weight: 600;
      border-radius: 10px;
      text-decoration: none;
      transition: all 0.2s ease;

      &:hover {
        background: var(--primary);
        color: var(--text);
      }
    }
  }
}

// Login Card
.login-card {
  text-align: center;
  background: linear-gradient(135deg, var(--primary-light), var(--surface));

  .login-mark {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  h4 {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 8px;
  }

  p {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0 0 20px;
  }
}

// Notice List
.notice-list,
.post-list,
.user-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notice,
.post {
  padding: 12px;
  background: var(--primary-light);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 10px;

  &:hover {
    background: var(--surface);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    transform: translateX(4px);
  }

  span {
    flex: 1;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .post-views {
    flex: none;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }
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
    background: var(--primary-light);
  }

  .user-item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }

  .exp {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .user-level {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--primary);
    background: var(--primary-light);
    padding: 2px 8px;
    border-radius: 6px;
  }
}

// Responsive
@media (max-width: 1280px) {
  .works-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1024px) {
  .home {
    grid-template-columns: 1fr;
  }

  .sidebar {
    display: none;
  }
}

@media (max-width: 768px) {
  .home {
    padding: 24px 20px;
  }

  .works-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .hero :deep(.el-carousel) {
    height: 240px !important;
  }

  .hero-overlay {
    padding: 24px;
  }

  .hero-title {
    font-size: 1.5rem;
  }
}
</style>
