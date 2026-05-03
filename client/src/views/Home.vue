<template>
  <div class="home">
    <div class="container">
      <!-- Banner -->
      <section class="banner" v-if="banners.length > 0">
        <el-carousel height="340px" :interval="5000" arrow="always">
          <el-carousel-item v-for="banner in banners" :key="banner.id">
            <a :href="banner.link_url" target="_blank" class="banner-link">
              <img :src="banner.image_url" :alt="banner.title" class="banner-img" />
              <div class="banner-overlay">
                <span class="banner-tag">精选</span>
                <h2 class="banner-title">{{ banner.title }}</h2>
              </div>
            </a>
          </el-carousel-item>
        </el-carousel>
      </section>

      <!-- Featured -->
      <section class="section">
        <header class="section-header">
          <h3 class="section-title">推荐作品</h3>
          <router-link to="/works" class="section-more">查看全部 →</router-link>
        </header>
        <div class="works" v-loading="loadingFeatured">
          <article 
            v-for="work in featuredWorks" 
            :key="work.id" 
            class="work-item"
            @click="$router.push(`/work/${work.codemao_work_id}`)"
          >
            <div class="work-cover">
              <div class="work-thumb" :style="{ backgroundImage: `url(${work.preview})` }"></div>
              <span class="work-badge" v-if="work.type">{{ getTypeName(work.type) }}</span>
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

      <!-- Latest -->
      <section class="section">
        <header class="section-header">
          <h3 class="section-title">最新作品</h3>
          <router-link to="/works" class="section-more">查看全部 →</router-link>
        </header>
        <div class="works" v-loading="loadingLatest">
          <article 
            v-for="work in latestWorks" 
            :key="work.id" 
            class="work-item"
            @click="$router.push(`/work/${work.codemao_work_id}`)"
          >
            <div class="work-cover">
              <div class="work-thumb" :style="{ backgroundImage: `url(${work.preview})` }"></div>
              <span class="work-badge" v-if="work.type">{{ getTypeName(work.type) }}</span>
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

      <!-- Hot -->
      <section class="section">
        <header class="section-header">
          <h3 class="section-title">热门作品</h3>
          <router-link to="/works?sortBy=popular" class="section-more">查看全部 →</router-link>
        </header>
        <div class="works" v-loading="loadingHot">
          <article 
            v-for="work in hotWorks" 
            :key="work.id" 
            class="work-item"
            @click="$router.push(`/work/${work.codemao_work_id}`)"
          >
            <div class="work-cover">
              <div class="work-thumb" :style="{ backgroundImage: `url(${work.preview})` }"></div>
              <span class="work-badge" v-if="work.type">{{ getTypeName(work.type) }}</span>
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
      <div class="card" v-if="userStore.isLoggedIn">
        <div class="user-info">
          <el-avatar :size="48" :src="userStore.user?.avatar || defaultAvatar" />
          <div class="user-detail">
            <h4>{{ userStore.user?.nickname || userStore.user?.username }}</h4>
            <span class="user-level">Lv.{{ userStore.user?.level || 1 }}</span>
          </div>
        </div>
        <p class="user-bio">{{ userStore.user?.bio || '这个人很懒，什么都没写~' }}</p>
        <el-button type="primary" class="btn-block" @click="$router.push('/publish')">发布作品</el-button>
        <div class="user-links">
          <router-link to="/profile">个人中心</router-link>
          <router-link to="/my-works">我的作品</router-link>
        </div>
      </div>

      <!-- Login Card -->
      <div class="card card-login" v-else>
        <div class="login-icon">
          <svg viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="8" fill="#FEC433"/>
            <rect x="10" y="10" width="28" height="28" rx="4" fill="#17181A"/>
            <circle cx="19" cy="24" r="3.5" fill="#FEC433"/>
            <circle cx="29" cy="24" r="3.5" fill="#FEC433"/>
          </svg>
        </div>
        <h4>欢迎来到编程狗</h4>
        <p>登录后可以发布作品、评论互动</p>
        <el-button type="primary" @click="$router.push('/login')">立即登录</el-button>
      </div>

      <!-- Notice -->
      <div class="card" v-if="importantPosts.length > 0">
        <h5 class="card-title">重要通知</h5>
        <div class="list">
          <div 
            v-for="post in importantPosts" 
            :key="post.id" 
            class="list-item"
            @click="$router.push(`/post/${post.id}`)"
          >
            <el-tag size="small" type="danger">重要</el-tag>
            <span>{{ post.title }}</span>
          </div>
        </div>
      </div>

      <!-- Posts -->
      <div class="card" v-if="featuredPosts.length > 0">
        <h5 class="card-title">精选帖子</h5>
        <div class="list">
          <div 
            v-for="post in featuredPosts" 
            :key="post.id" 
            class="list-item"
            @click="$router.push(`/post/${post.id}`)"
          >
            <span>{{ post.title }}</span>
            <span class="item-meta">{{ formatNum(post.view_count) }} 阅读</span>
          </div>
        </div>
      </div>

      <!-- Users -->
      <div class="card" v-if="activeUsers.length > 0">
        <h5 class="card-title">活跃用户</h5>
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
            <span class="user-item-level">Lv.{{ user.level }}</span>
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

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzE3MTgxQSI+8J+SgTwvdGV4dD48L3N2Zz4='

const formatNum = (n) => {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
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
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 24px;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Banner */
:deep(.el-carousel__button) {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border-hover);
}

:deep(.el-carousel__indicator.is-active .el-carousel__button) {
  background: var(--primary);
  width: 20px;
  border-radius: 3px;
}

.banner {
  :deep(.el-carousel) {
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
}

.banner-link {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
}

.banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banner-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 32px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
}

.banner-tag {
  display: inline-block;
  padding: 4px 12px;
  background: var(--primary);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: var(--radius);
  margin-bottom: 8px;
}

.banner-title {
  color: #fff;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

/* Section */
.section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.section-more {
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.15s ease;

  &:hover {
    color: var(--primary-dark);
  }
}

/* Works Grid */
.works {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.work-item {
  cursor: pointer;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-hover);
    border-color: var(--primary);
  }
}

.work-cover {
  position: relative;
  padding-bottom: 100%;
  background: var(--bg);
  overflow: hidden;
}

.work-thumb {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: transform 0.3s ease;

  .work-item:hover & {
    transform: scale(1.05);
  }
}

.work-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 500;
  border-radius: var(--radius);
}

.work-info {
  padding: 10px;
}

.work-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
  margin: 0 0 8px;
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
    color: var(--primary-dark);
  }
}

.stats {
  display: flex;
  gap: 8px;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

/* Sidebar */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 72px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
}

.card-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px;
}

/* User Card */
.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.user-detail {
  flex: 1;

  h4 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 4px;
  }

  .user-level {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--primary-dark);
    background: var(--primary-light);
    padding: 2px 6px;
    border-radius: var(--radius);
  }
}

.user-bio {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0 0 12px;
  padding: 10px;
  background: var(--bg);
  border-radius: var(--radius);
  border-left: 3px solid var(--primary);
  line-height: 1.5;
}

.btn-block {
  width: 100%;
  font-weight: 600;
}

.user-links {
  display: flex;
  gap: 8px;
  margin-top: 10px;

  a {
    flex: 1;
    text-align: center;
    padding: 8px;
    background: var(--bg);
    color: var(--text-secondary);
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: var(--radius);
    text-decoration: none;
    transition: all 0.15s ease;

    &:hover {
      background: var(--primary);
      color: var(--text);
    }
  }
}

/* Login Card */
.card-login {
  text-align: center;
  background: linear-gradient(135deg, var(--primary-light), var(--surface));

  .login-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 10px;
  }

  h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 6px;
  }

  p {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0 0 14px;
  }
}

/* Lists */
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  padding: 8px 10px;
  background: var(--bg);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: var(--primary-light);
  }

  span:first-of-type {
    flex: 1;
    font-size: 0.8125rem;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-meta {
    flex: none;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--bg);
  }

  .user-item-info {
    flex: 1;
    display: flex;
    flex-direction: column;

    span:first-child {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text);
    }

    span:last-child {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  }

  .user-item-level {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--primary-dark);
    background: var(--primary-light);
    padding: 2px 6px;
    border-radius: var(--radius);
  }
}

/* Responsive */
@media (max-width: 1100px) {
  .works {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 960px) {
  .home {
    grid-template-columns: 1fr;
  }

  .sidebar {
    display: none;
  }
}

@media (max-width: 720px) {
  .home {
    padding: 16px;
  }

  .works {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .banner :deep(.el-carousel) {
    height: 200px !important;
  }

  .banner-overlay {
    padding: 20px;
  }

  .banner-title {
    font-size: 1.125rem;
  }
}
</style>
