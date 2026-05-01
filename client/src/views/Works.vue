<template>
  <div class="works-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h1>发现作品</h1>
        <p>探索有趣的编程作品</p>
      </div>
    </div>
    
    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-content">
        <div class="filter-tabs">
          <span class="tab" :class="{ active: !currentType }" @click="currentType = ''; fetchWorks()">全部</span>
          <span class="tab" :class="{ active: currentType === '游戏' }" @click="currentType = '游戏'; fetchWorks()">🎮 游戏</span>
          <span class="tab" :class="{ active: currentType === '动画' }" @click="currentType = '动画'; fetchWorks()">🎬 动画</span>
          <span class="tab" :class="{ active: currentType === '故事' }" @click="currentType = '故事'; fetchWorks()">📖 故事</span>
          <span class="tab" :class="{ active: currentType === '音乐' }" @click="currentType = '音乐'; fetchWorks()">🎵 音乐</span>
          <span class="tab" :class="{ active: currentType === '艺术' }" @click="currentType = '艺术'; fetchWorks()">🎨 艺术</span>
        </div>
        <div class="filter-actions">
          <input v-model="keyword" type="text" class="search-input" placeholder="搜索作品" @keyup.enter="searchWorks">
          <select v-model="sortBy" class="sort-select" @change="fetchWorks">
            <option value="latest">最新发布</option>
            <option value="popular">最多浏览</option>
            <option value="praise">最多点赞</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- 作品列表 -->
    <div class="works-container">
      <div class="work-grid" v-loading="loading">
        <div v-for="work in works" :key="work.id" class="work-card" @click="$router.push(`/work/${work.codemao_work_id}`)">
          <div class="card-cover">
            <img :src="work.preview" :alt="work.name" loading="lazy">
            <span class="card-tag" v-if="work.type">{{ getTypeName(work.type) }}</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">{{ work.name }}</h3>
            <p class="card-desc">{{ work.description || '暂无描述' }}</p>
            <div class="card-author">
              <el-avatar :size="22" :src="work.author?.avatar" />
              <span>{{ work.author?.nickname || work.author?.username }}</span>
            </div>
            <div class="card-stats">
              <span><el-icon><View /></el-icon> {{ formatNum(work.view_times) }}</span>
              <span><el-icon><Star /></el-icon> {{ formatNum(work.praise_times) }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <el-empty v-if="!loading && works.length === 0" description="暂无作品" />
      
      <div class="pagination" v-if="total > pageSize">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" background @current-change="fetchWorks" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { workApi } from '@/api/work'

const route = useRoute()
const loading = ref(false)
const works = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')
const sortBy = ref('latest')
const currentType = ref('')

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

const fetchWorks = async () => {
  loading.value = true
  try {
    const res = await workApi.getList({ page: page.value, pageSize: pageSize.value, keyword: keyword.value, type: currentType.value, sortBy: sortBy.value })
    if (res.code === 200) { works.value = res.data.list; total.value = res.data.pagination.total }
  } catch (e) { console.error(e) }
  loading.value = false
}

const searchWorks = () => { page.value = 1; fetchWorks() }

watch(() => route.query, (q) => {
  if (q.keyword) keyword.value = q.keyword
  if (q.type) currentType.value = q.type
  fetchWorks()
}, { immediate: false })

onMounted(() => {
  if (route.query.keyword) keyword.value = route.query.keyword
  if (route.query.type) currentType.value = route.query.type
  fetchWorks()
})
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$primary-hover: #FFD700;
$primary-light: #FFF9E6;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;
$white: #fff;

.works-page { min-height: 100%; }

.page-header {
  background: linear-gradient(135deg, $primary-color 0%, $primary-hover 100%);
  padding: 48px 24px;
  
  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    text-align: center;
    color: $text-color;
    
    h1 { font-size: 32px; font-weight: 600; margin: 0 0 8px; }
    p { font-size: 16px; opacity: 0.8; margin: 0; }
  }
}

.filter-bar {
  background: $white;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 60px;
  z-index: 100;
  
  .filter-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    
    @media (max-width: 768px) { flex-direction: column; align-items: stretch; }
  }
}

.filter-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  
  .tab {
    padding: 8px 16px;
    font-size: 14px;
    color: $text-secondary;
    background: #f5f5f5;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover { color: $primary-color; background: $primary-light; }
    &.active { color: $white; background: $primary-color; }
  }
}

.filter-actions {
  display: flex;
  gap: 12px;
  
  .search-input {
    width: 200px;
    height: 36px;
    padding: 0 16px;
    border: 1px solid #ddd;
    border-radius: 18px;
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
    
    &:focus { border-color: $primary-color; }
  }
  
  .sort-select {
    height: 36px;
    padding: 0 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    cursor: pointer;
    
    &:focus { border-color: $primary-color; }
  }
}

.works-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.work-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  
  @media (max-width: 1200px) { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
}

.work-card {
  background: $white;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid #eee;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
    
    .card-cover img { transform: scale(1.05); }
  }
  
  .card-cover {
    position: relative;
    padding-top: 100%;
    overflow: hidden;
    background: #f0f0f0;
    
    img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    
    .card-tag {
      position: absolute;
      top: 8px;
      left: 8px;
      padding: 2px 8px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-size: 11px;
      border-radius: 4px;
    }
    
    .card-ide {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 2px 8px;
      background: #FEC433;
      color: #333;
      font-size: 11px;
      border-radius: 4px;
      font-weight: 500;
    }
  }
  
  .card-body {
    padding: 12px;
    
    .card-title { font-size: 14px; font-weight: 500; color: $text-color; margin: 0 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-desc { font-size: 12px; color: $text-muted; margin: 0 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-author { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; span { font-size: 12px; color: $text-secondary; } }
    .card-stats { display: flex; gap: 12px; font-size: 12px; color: $text-muted; span { display: flex; align-items: center; gap: 4px; } }
  }
}

.pagination { display: flex; justify-content: center; margin-top: 32px; }
</style>
