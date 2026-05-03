<template>
  <div class="home">
    <div class="container">
      <!-- Hero Banner -->
      <section class="hero" v-if="banners.length > 0">
        <el-carousel height="480px" :interval="6000" trigger="click" arrow="always">
          <el-carousel-item v-for="banner in banners" :key="banner.id">
            <a :href="banner.link_url" target="_blank" class="hero-item">
              <img :src="banner.image_url" :alt="banner.title" class="hero-image" />
              <div class="hero-overlay"></div>
              <div class="hero-content">
                <span class="hero-badge">Featured</span>
                <h2 class="hero-title">{{ banner.title }}</h2>
              </div>
            </a>
          </el-carousel-item>
        </el-carousel>
      </section>

      <!-- Featured Works -->
      <section class="section">
        <header class="section-head">
          <h3 class="section-title">推荐作品</h3>
          <router-link to="/works" class="section-link">全部作品</router-link>
        </header>
        <div class="works-grid" v-loading="loadingFeatured">
          <article 
            v-for="(work, index) in featuredWorks" 
            :key="work.id" 
            class="work"
            :style="{ '--delay': `${index * 0.06}s` }"
            @click="$router.push(`/work/${work.codemao_work_id}`)"
          >
            <div class="work-cover">
              <div class="work-bg" :style="{ backgroundImage: `url(${work.preview})` }"></div>
              <span class="work-tag" v-if="work.type">{{ getTypeName(work.type) }}</span>
            </div>
            <div class="work-info">
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
          </article>
        </div>
        <el-empty v-if="!loadingFeatured && featuredWorks.length === 0" description="暂无推荐作品" />
      </section>

      <!-- Latest Works -->
      <section class="section">
        <header class="section-head">
          <h3 class="section-title">最新作品</h3>
          <router-link to="/works" class="section-link">全部作品</router-link>
        </header>
        <div class="works-grid" v-loading="loadingLatest">
          <article 
            v-for="(work, index) in latestWorks" 
            :key="work.id" 
            class="work"
            :style="{ '--delay': `${index * 0.06}s` }"
            @click="$router.push(`/work/${work.codemao_work_id}`)"
          >
            <div class="work-cover">
              <div class="work-bg" :style="{ backgroundImage: `url(${work.preview})` }"></div>
              <span class="work-tag" v-if="work.type">{{ getTypeName(work.type) }}</span>
            </div>
            <div class="work-info">
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
          </article>
        </div>
        <el-empty v-if="!loadingLatest && latestWorks.length === 0" description="暂无作品" />
      </section>

      <!-- Hot Works -->
      <section class="section">
        <header class="section-head">
          <h3 class="section-title">热门作品</h3>
          <router-link to="/works?sortBy=popular" class="section-link">全部作品</router-link>
        </header>
        <div class="works-grid" v-loading="loadingHot">
          <article 
            v-for="(work, index) in hotWorks" 
            :key="work.id" 
            class="work"
            :style="{ '--delay': `${index * 0.06}s` }"
            @click="$router.push(`/work/${work.codemao_work_id}`)"
          >
            <div class="work-cover">
              <div class="work-bg" :style="{ backgroundImage: `url(${work.preview})` }"></div>
              <span class="work-tag" v-if="work.type">{{ getTypeName(work.type) }}</span>
            </div>
            <div class="work-info">
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
          </article>
        </div>
        <el-empty v-if="!loadingHot && hotWorks.length === 0" description="暂无作品" />
      </section>
    </div>

    <!-- Sidebar -->
    <aside class="sidebar">
      <!-- User Card -->
      <div class="widget" v-if="userStore.isLoggedIn">
        <div class="widget-header">
          <el-avatar :size="48" :src="userStore.user?.avatar || defaultAvatar" />
          <div class="widget-info">
            <h4>{{ userStore.user?.nickname || userStore.user?.username }}</h4>
            <span class="widget-level">Lv.{{ userStore.user?.level || 1 }}</span>
          </div>
        </div>
        <p class="widget-bio">{{ userStore.user?.bio || '这个人很懒，什么都没写~' }}</p>
        <el-button type="primary" class="widget-btn" @click="$router.push('/publish')">发布作品</el-button>
        <div class="widget-links">
          <router-link to="/profile">个人中心</router-link>
          <router-link to="/my-works">我的作品</router-link>
        </div>
      </div>

      <!-- Login Card -->
      <div class="widget widget-login" v-else>
        <div class="widget-icon">
          <svg viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#FEC433"/>
            <rect x="10" y="10" width="28" height="28" rx="6" fill="#0F0F0F"/>
            <circle cx="19" cy="24" r="4" fill="#FEC433"/>
            <circle cx="29" cy="24" r="4" fill="#FEC433"/>
          </svg>
        </div>
        <h4>欢迎来到编程狗</h4>
        <p>登录后可以发布作品、评论互动</p>
        <el-button type="primary" @click="$router.push('/login')">立即登录</el-button>
      </div>

      <!-- Notices -->
      <div class="widget" v-if="importantPosts.length > 0">
        <h5 class="widget-title">重要通知</h5>
        <div class="notice-list">
          <div 
            v-for="post in importantPosts" 
            :key="post.id" 
            class="notice-item"
            @click="$router.push(`/post/${post.id}`)"
          >
            <el-tag size="small" type="danger">重要</el-tag>
            <span>{{ post.title }}</span>
          </div>
        </div>
      </div>

      <!-- Featured Posts -->
      <div class="widget" v-if="featuredPosts.length > 0">
        <h5 class="widget-title">精选帖子</h5>
        <div class="post-list">
          <div 
            v-for="post in featuredPosts" 
            :key="post.id" 
            class="post-item"
            @click="$router.push(`/post/${post.id}`)"
          >
            <span>{{ post.title }}</span>
            <span class="post-meta">{{ formatNum(post.view_count) }} 阅读</span>
          </div>
        </div>
      </div>

      <!-- Active Users -->
      <div class="widget" v-if="activeUsers.length > 0">
        <h5 class="widget-title">活跃用户</h5>
        <div class="user-list">
          <div 
            v-for="user in activeUsers" 
            :key="user.id" 
            class="user-item"
            @click="goUser(user)"
          >
            <el-avatar :size="36" :src="user.avatar || defaultAvatar" />
            <div class="user-item-info">
              <span>{{ user.nickname || user.username }}</span>
              <span>{{ user.experience }} 经验</span>
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
  max-width: 1440px;
  margin: 0 auto;
  padding: 64px 48px;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 64px;
  align-items: start;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 64px;
}

// Hero
:deep(.el-carousel__indicators--outside) {
  margin-top: 20px;
}

:deep(.el-carousel__button) {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c9c7c4;
}

:deep(.el-carousel__indicator.is-active .el-carousel__button) {
  background: var(--primary);
  width: 24px;
  border-radius: 3px;
}

.hero {
  :deep(.el-carousel) {
    border-radius: var(--radius-xl);
    overflow: hidden;
  }
}

.hero-item {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(15, 15, 15, 0.7), transparent 60%);
}

.hero-content {
  position: absolute;
  bottom: 48px;
  left: 48px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero-badge {
  display: inline-block;
  width: fit-content;
  padding: 6px 14px;
  background: var(--primary);
  color: var(--dark);
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-radius: var(--radius-sm);
}

.hero-title {
  font-family: var(--font-display);
  font-size: 2.25rem;
  font-weight: 800;
  color: #fff;
  margin: 0;
  letter-spacing: -0.03em;
  max-width: 600px;
}

// Sections
.section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.section-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text);
  margin: 0;
  letter-spacing: -0.02em;
}

.section-link {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.15s ease;

  &:hover {
    color: var(--primary-dark);
  }
}

// Works Grid - 4 columns
.works-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.work {
  cursor: pointer;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeIn 0.5s ease var(--delay) both;

  &:hover {
    transform: translateY(-6px);
    box-shadow: var(--shadow-lg);
    border-color: var(--primary);

    .work-bg {
      transform: scale(1.06);
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(24px);
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

.work-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.work-tag {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 10px;
  background: var(--primary);
  color: var(--dark);
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: var(--radius-sm);
}

.work-info {
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
    color: var(--primary-dark);
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

.widget {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 24px;
  border: 1px solid var(--border);
}

.widget-title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 16px;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.widget-info {
  flex: 1;

  h4 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 4px;
  }

  .widget-level {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--primary-dark);
    background: var(--primary-light);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
  }
}

.widget-bio {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0 0 16px;
  padding: 12px;
  background: var(--primary-light);
  border-radius: var(--radius);
  border-left: 3px solid var(--primary);
  line-height: 1.5;
}

.widget-btn {
  width: 100%;
  font-weight: 700;
}

.widget-links {
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
    border-radius: var(--radius);
    text-decoration: none;
    transition: all 0.15s ease;

    &:hover {
      background: var(--primary);
      color: var(--dark);
    }
  }
}

.widget-login {
  text-align: center;
  background: linear-gradient(135deg, var(--primary-light), var(--surface));

  .widget-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 16px;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  h4 {
    font-family: var(--font-display);
    font-size: 1.125rem;
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
  background: var(--primary-light);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 10px;

  &:hover {
    background: var(--surface);
    box-shadow: var(--shadow);
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

  .post-meta {
    flex: none;
    font-size: 0.6875rem;
    color: var(--text-muted);
    font-weight: 500;
  }
}

.user-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--primary-light);
  }

  .user-item-info {
    flex: 1;
    display: flex;
    flex-direction: column;

    span:first-child {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
    }

    span:last-child {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  }

  .user-level {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--primary-dark);
    background: var(--primary-light);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
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
    padding: 32px 20px;
    gap: 48px;
  }

  .works-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .hero :deep(.el-carousel) {
    height: 280px !important;
  }

  .hero-content {
    bottom: 24px;
    left: 24px;
  }

  .hero-title {
    font-size: 1.5rem;
  }
}
</style>
