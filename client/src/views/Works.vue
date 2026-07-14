<template>
  <div class="works-page">
    <!-- 页面头部 -->
    <div class="page-header" :style="heroStyle" @mousemove="handleHeroMove" @mouseleave="resetHeroGlow">
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
            <img :src="work.preview" :alt="work.name" loading="lazy" referrerpolicy="no-referrer">
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { View, Star } from '@element-plus/icons-vue'
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
const heroGlow = ref({ x: 50, y: 50 })
const heroStyle = computed(() => ({ '--glow-x': `${heroGlow.value.x}%`, '--glow-y': `${heroGlow.value.y}%` }))
const handleHeroMove = (event) => { const rect = event.currentTarget.getBoundingClientRect(); heroGlow.value = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 } }
const resetHeroGlow = () => { heroGlow.value = { x: 50, y: 50 } }

const formatNum = (n) => {
  if (n == null) return 0
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n
}

const getTypeName = (workType) => {
  if (!workType) return ''
  const type = workType.toUpperCase()
  const typeMap = {
    'KITTEN': 'Kitten',
    'KITTEN4': 'KITTEN4',
    'NEMO': 'Nemo',
    'COCO': 'Coco',
    'WOOD': 'Wood',
    'BOX': 'Box',
    'BOX2': 'Box 2',
    'CODE_BLOCK': '代码岛',
    'PYTHON': 'Python',
    'SCRATCH': 'Scratch',
    'NEKO': 'Nemo'
  }
  return typeMap[type] || workType
}

const fetchWorks = async () => {
  loading.value = true
  try {
    const res = await workApi.getList({ page: page.value, pageSize: pageSize.value, keyword: keyword.value, type: currentType.value, sortBy: sortBy.value })
    if (res.code === 200) {
      works.value = res.data.list
      // 兼容后端两种分页返回格式：data.total 或 data.pagination.total
      total.value = res.data.total || res.data.pagination?.total || 0
    }
  } catch (e) { console.error(e) }
  loading.value = false
}

const searchWorks = () => { page.value = 1; fetchWorks() }

watch(() => route.query, (q) => {
  if (q.keyword) keyword.value = q.keyword
  if (q.type) currentType.value = q.type
  if (q.sortBy) sortBy.value = q.sortBy
  page.value = 1
  fetchWorks()
}, { immediate: false })

onMounted(() => {
  if (route.query.keyword) keyword.value = route.query.keyword
  if (route.query.type) currentType.value = route.query.type
  if (route.query.sortBy) sortBy.value = route.query.sortBy
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

.works-page {
  position: relative;
  min-height: calc(100vh - 64px);
  overflow: hidden;
  background:
    radial-gradient(circle at 8% 8%, rgba(255, 205, 92, .3), transparent 28rem),
    radial-gradient(circle at 92% 16%, rgba(108, 190, 255, .25), transparent 30rem),
    linear-gradient(145deg, #f5f8ff 0%, #fafbff 50%, #fff8eb 100%);
}
.works-page::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .5;
  background-image: linear-gradient(rgba(95,125,170,.055) 1px,transparent 1px), linear-gradient(90deg,rgba(95,125,170,.055) 1px,transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(to bottom, #000, transparent 80%);
}

.page-header {
  position: relative;
  overflow: hidden;
  margin: 24px auto 18px;
  max-width: 1200px;
  width: calc(100% - 48px);
  background: radial-gradient(circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(255,255,255,.7) 0%, rgba(255,255,255,.16) 28%, transparent 52%), linear-gradient(135deg, rgba(255,248,226,.92), rgba(247,243,255,.9) 48%, rgba(232,247,255,.92));
  border: 1px solid rgba(255,255,255,.92);
  border-radius: 22px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.95), 0 18px 50px rgba(39,55,82,.09);
  padding: 48px 24px;

  &::after { content: ''; position:absolute; inset:0; pointer-events:none; background: linear-gradient(115deg, rgba(255,255,255,.34), transparent 42%, rgba(255,255,255,.22)); mix-blend-mode: screen; }
  
  .header-content {
    position: relative;
    z-index: 1;
    max-width: 1200px;
    margin: 0 auto;
    text-align: center;
    color: $text-color;
    
    h1 { color:#172033; font-size: clamp(34px, 4vw, 46px); line-height:1.1; letter-spacing:-.045em; font-weight:800; margin: 0 0 12px; }
    p { color:#667085; font-size: 16px; opacity: 1; margin: 0; }
  }
}

@media (prefers-reduced-motion: reduce) { .page-header { --glow-x: 50% !important; --glow-y: 50% !important; } }

.filter-bar {
  width: calc(100% - 48px);
  max-width: 1200px;
  margin: 0 auto;
  background: rgba(255,255,255,.78);
  border: 1px solid rgba(255,255,255,.92);
  border-radius: 17px;
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 36px rgba(39,55,82,.07);
  position: sticky;
  top: 60px;
  z-index: 100;
  
  .filter-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 13px 16px;
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
    background: transparent;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover { color: $primary-color; background: $primary-light; }
    &.active { color: $white; background: #172033; box-shadow:0 6px 14px rgba(23,32,51,.16); }
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
    border-radius: 11px;
    background: rgba(255,255,255,.86);
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
    
    &:focus { border-color: $primary-color; }
  }
  
  .sort-select {
    height: 36px;
    padding: 0 12px;
    border: 1px solid #ddd;
    border-radius: 11px;
    background: rgba(255,255,255,.86);
    font-size: 14px;
    outline: none;
    cursor: pointer;
    
    &:focus { border-color: $primary-color; }
  }
}

.works-container {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 0 72px;
}

.work-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px 16px;
  
  @media (max-width: 1200px) { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
}

.work-card {
  background: rgba(255,255,255,.88);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid rgba(255,255,255,.95);
  box-shadow: 0 8px 25px rgba(39,55,82,.06);
  
  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 18px 38px rgba(39,55,82,.14);
    
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
      border-radius: 7px;
      backdrop-filter: blur(8px);
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
    padding: 14px;
    
    .card-title { font-size: 15px; font-weight: 700; color: #1b2436; margin: 0 0 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-desc { font-size: 12px; color: $text-muted; margin: 0 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-author { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; span { font-size: 12px; color: $text-secondary; } }
    .card-stats { display: flex; gap: 12px; font-size: 12px; color: $text-muted; span { display: flex; align-items: center; gap: 4px; } }
  }
}

.pagination { display: flex; justify-content: center; margin-top: 32px; }

@media (max-width: 768px) {
  .page-header, .filter-bar { width: calc(100% - 28px); }
  .page-header { margin-top: 14px; padding: 34px 18px; border-radius: 18px; }
  .filter-bar { position: relative; top: auto; }
  .filter-actions { width:100%; .search-input{flex:1;width:auto}.sort-select{max-width:120px} }
  .works-container { width:calc(100% - 28px); padding:20px 0 52px; }
}
</style>
