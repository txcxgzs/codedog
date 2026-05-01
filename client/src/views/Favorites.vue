<template>
  <div class="r-favorites--page">
    <div class="r-favorites--container">
      <div class="r-favorites--header">
        <div class="r-favorites--header_left">
          <h2 class="r-favorites--title">我的收藏</h2>
          <span class="r-favorites--count">共 {{ total }} 个收藏</span>
        </div>
        <div class="r-favorites--header_right">
          <el-input v-model="searchKeyword" placeholder="搜索作品" clearable style="width: 200px;" @keyup.enter="handleSearch">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button @click="handleSearch">搜索</el-button>
          <el-button v-if="!batchMode" @click="enterBatchMode">批量管理</el-button>
          <template v-else>
            <el-button @click="selectAll">全选</el-button>
            <el-button @click="cancelBatchMode">取消</el-button>
            <el-button type="danger" @click="batchRemove" :disabled="selectedWorks.length === 0">取消收藏 ({{ selectedWorks.length }})</el-button>
          </template>
        </div>
      </div>
      
      <div class="r-favorites--content" v-loading="loading">
        <div class="r-favorites--grid" v-if="works.length > 0">
          <div v-for="work in works" :key="work.id" class="r-favorites--card" :class="{ 'is-selected': selectedWorks.includes(work.id) }">
            <div class="r-favorites--card_checkbox" v-if="batchMode" @click.stop="toggleSelect(work.id)">
              <el-checkbox :model-value="selectedWorks.includes(work.id)" />
            </div>
            <div class="r-favorites--card_cover" :style="{ backgroundImage: `url(${work.preview})` }" @click="goWork(work)"></div>
            <div class="r-favorites--card_body">
              <h4 class="r-favorites--card_title" @click="goWork(work)">{{ work.name }}</h4>
              <p class="r-favorites--card_author">{{ work.author?.nickname || work.author?.username }}</p>
              <div class="r-favorites--card_actions">
                <span class="r-favorites--card_ide" v-if="work.ide_type">{{ getIdeTypeName(work.ide_type) }}</span>
                <el-button v-if="!batchMode" size="small" text type="danger" @click.stop="removeFavorite(work)">
                  <el-icon><Delete /></el-icon> 取消收藏
                </el-button>
              </div>
            </div>
          </div>
        </div>
        
        <el-empty v-else description="暂无收藏" />
      </div>
      
      <div class="r-favorites--pagination" v-if="total > pageSize">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchFavorites" />
      </div>
    </div>
    
    <GeetestDialog ref="geetestDialog" @success="onGeetestSuccess" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Delete } from '@element-plus/icons-vue'
import { favoriteApi } from '@/api/favorite'
import { useUserStore } from '@/stores/user'
import GeetestDialog from '@/components/GeetestDialog.vue'
import { useGeetestConfig } from '@/composables/useGeetestConfig'

const router = useRouter()
const userStore = useUserStore()
const { geetestEnabled, fetchGeetestConfig } = useGeetestConfig()

const loading = ref(false)
const works = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')
const batchMode = ref(false)
const selectedWorks = ref([])
const geetestDialog = ref(null)
const pendingRemoveWork = ref(null)
const pendingBatchRemove = ref(false)

const getIdeTypeName = (ideType) => {
  if (!ideType) return ''
  const type = ideType.toUpperCase()
  const ideMap = {
    'KITTEN': 'Kitten',
    'KITTEN4': 'Kitten 4',
    'KITTEN3': 'Kitten 3',
    'NEMO': 'Nemo',
    'BOX': 'Box',
    'BOX2': 'Box 2',
    'WOOD': 'Wood',
    'COCO': 'Coco',
    'NEKO': 'Neko',
    'CODE_BLOCK': '代码岛',
    'PYTHON': 'Python',
    'SCRATCH': 'Scratch'
  }
  return ideMap[type] || ideType
}

const goWork = (work) => {
  if (batchMode.value) {
    toggleSelect(work.id)
  } else {
    router.push(`/work/${work.codemao_work_id}`)
  }
}

const fetchFavorites = async () => {
  loading.value = true
  try {
    const res = await favoriteApi.getMyFavorites({ page: currentPage.value, pageSize: pageSize.value, keyword: searchKeyword.value })
    if (res.code === 200) {
      works.value = res.data.list
      total.value = res.data.total
    }
  } catch (e) {
    console.error('获取收藏失败:', e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchFavorites()
}

const enterBatchMode = () => {
  batchMode.value = true
  selectedWorks.value = []
}

const cancelBatchMode = () => {
  batchMode.value = false
  selectedWorks.value = []
}

const toggleSelect = (workId) => {
  const index = selectedWorks.value.indexOf(workId)
  if (index > -1) {
    selectedWorks.value.splice(index, 1)
  } else {
    selectedWorks.value.push(workId)
  }
}

const selectAll = () => {
  if (selectedWorks.value.length === works.value.length) {
    selectedWorks.value = []
  } else {
    selectedWorks.value = works.value.map(w => w.id)
  }
}

const removeFavorite = async (work) => {
  try {
    await ElMessageBox.confirm('确定要取消收藏该作品吗？', '提示', { type: 'warning' })
    
    if (geetestEnabled.value('remove_favorite')) {
      pendingRemoveWork.value = work
      geetestDialog.value?.show('remove_favorite')
    } else {
      await doRemoveFavorite(work.id)
    }
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const batchRemove = async () => {
  if (selectedWorks.value.length === 0) return
  
  try {
    await ElMessageBox.confirm(`确定要取消收藏选中的 ${selectedWorks.value.length} 个作品吗？`, '提示', { type: 'warning' })
    
    if (geetestEnabled.value('remove_favorite')) {
      pendingBatchRemove.value = true
      geetestDialog.value?.show('remove_favorite')
    } else {
      await doBatchRemove()
    }
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const onGeetestSuccess = async (data) => {
  if (pendingBatchRemove.value) {
    await doBatchRemove()
    pendingBatchRemove.value = false
  } else if (pendingRemoveWork.value) {
    await doRemoveFavorite(pendingRemoveWork.value.id)
    pendingRemoveWork.value = null
  }
}

const doRemoveFavorite = async (workId) => {
  try {
    const res = await favoriteApi.remove(workId)
    if (res.code === 200) {
      ElMessage.success('已取消收藏')
      works.value = works.value.filter(w => w.id !== workId)
      total.value--
      if (works.value.length === 0 && currentPage.value > 1) {
        currentPage.value--
        fetchFavorites()
      }
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const doBatchRemove = async () => {
  try {
    let success = 0
    for (const workId of selectedWorks.value) {
      const res = await favoriteApi.remove(workId)
      if (res.code === 200) success++
    }
    ElMessage.success(`已取消收藏 ${success} 个作品`)
    cancelBatchMode()
    fetchFavorites()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  fetchGeetestConfig()
  fetchFavorites()
})
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;
$white: #fff;
$border-color: #eee;

.r-favorites--page {
  padding: 24px;
  min-height: calc(100vh - 60px);
}

.r-favorites--container {
  max-width: 1200px;
  margin: 0 auto;
}

.r-favorites--header {
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  
  .r-favorites--header_left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .r-favorites--header_right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .r-favorites--title {
    font-size: 24px;
    font-weight: 600;
    color: $text-color;
    margin: 0;
  }
  
  .r-favorites--count {
    color: $text-muted;
    font-size: 14px;
  }
}

.r-favorites--content {
  background: $white;
  border-radius: 12px;
  padding: 24px;
  min-height: 400px;
}

.r-favorites--grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  
  @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
}

.r-favorites--card {
  background: $white;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid $border-color;
  transition: all 0.3s;
  position: relative;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  }
  
  &.is-selected {
    border-color: $primary-color;
    box-shadow: 0 0 0 2px rgba($primary-color, 0.3);
  }
  
  .r-favorites--card_checkbox {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
    background: $white;
    border-radius: 4px;
    padding: 2px;
  }
  
  .r-favorites--card_cover {
    padding-top: 100%;
    background-size: cover;
    background-position: center;
  }
  
  .r-favorites--card_body {
    padding: 12px;
    
    .r-favorites--card_title {
      font-size: 14px;
      font-weight: 500;
      color: $text-color;
      margin: 0 0 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      
      &:hover {
        color: $primary-color;
      }
    }
    
    .r-favorites--card_author {
      font-size: 12px;
      color: $text-muted;
      margin: 0 0 8px;
    }
    
    .r-favorites--card_actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .r-favorites--card_ide {
        font-size: 11px;
        padding: 2px 6px;
        background: $primary-color;
        color: $text-color;
        border-radius: 4px;
        font-weight: 500;
      }
    }
  }
}

.r-favorites--pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>
