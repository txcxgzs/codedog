<template>
  <div class="r-studio--page">
    <div class="r-studio--container">
      <div class="r-studio--header">
        <h2 class="r-studio--title">工作室</h2>
        <div class="r-studio--header_actions">
          <el-input 
            v-model="searchKeyword" 
            placeholder="搜索工作室" 
            clearable 
            class="r-studio--search_input"
            @keyup.enter="handleSearch"
          >
            <template #append><el-button @click="handleSearch"><el-icon><Search /></el-icon></el-button></template>
          </el-input>
          <el-button type="primary" @click="showCreateDialog" v-if="userStore.isLoggedIn" round>
            <el-icon class="el-icon--left"><Plus /></el-icon>
            创建工作室
          </el-button>
        </div>
      </div>
      
      <div class="r-studio--tabs">
        <el-radio-group v-model="activeTab" @change="fetchStudios">
          <el-radio-button label="all">全部工作室</el-radio-button>
          <el-radio-button label="my" v-if="userStore.isLoggedIn">我的工作室</el-radio-button>
        </el-radio-group>
      </div>
      
      <div class="r-studio--content" v-loading="loading">
        <div class="r-studio--grid" v-if="studios.length > 0">
          <div v-for="studio in studios" :key="studio.id" class="r-studio--card" @click="$router.push(`/studio/${studio.id}`)">
            <div class="r-studio--card_cover" :style="{ backgroundImage: `url(${studio.cover || defaultCover})` }">
              <div class="r-studio--card_level">Lv.{{ studio.level || 1 }}</div>
              <div class="r-studio--card_badge" v-if="studio.memberRole">{{ roleText(studio.memberRole) }}</div>
            </div>
            <div class="r-studio--card_body">
              <h4 class="r-studio--card_name">{{ studio.name }}</h4>
              <p class="r-studio--card_desc">{{ studio.description || '暂无简介' }}</p>
              <div class="r-studio--card_meta">
                <span><span class="r-studio--meta_icon r-studio--meta_icon_member"></span>{{ studio.member_count }}人</span>
                <span><span class="r-studio--meta_icon r-studio--meta_icon_work"></span>{{ studio.work_count }}作品</span>
                <span><span class="r-studio--meta_icon r-studio--meta_icon_point"></span>{{ studio.points || 0 }}积分</span>
              </div>
            </div>
          </div>
        </div>
        
        <el-empty v-else description="暂无工作室" />
      </div>
      
      <div class="r-studio--pagination" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="fetchStudios"
        />
      </div>
    </div>
    
    <el-dialog v-model="createDialogVisible" title="创建工作室" width="500px">
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="createForm.name" placeholder="请输入工作室名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="简介" prop="description">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="介绍一下你的工作室吧" maxlength="500" />
        </el-form-item>
        <el-form-item label="封面" prop="cover">
          <el-input v-model="createForm.cover" placeholder="封面图片URL（可选）" />
        </el-form-item>
        <el-form-item label="加入方式" prop="join_type">
          <el-radio-group v-model="createForm.join_type">
            <el-radio label="free">自由加入</el-radio>
            <el-radio label="apply">申请加入</el-radio>
            <el-radio label="invite">仅限邀请</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
    
    <GeetestDialog ref="geetestDialog" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { studioApi } from '@/api/studio'
import { ElMessage } from 'element-plus'
import GeetestDialog from '@/components/GeetestDialog.vue'
import { Search, Plus } from '@element-plus/icons-vue'

const userStore = useUserStore()
const loading = ref(false)
const createLoading = ref(false)
const activeTab = ref('all')
const studios = ref([])
const currentPage = ref(1)
const pageSize = ref(12)
const total = ref(0)
const createDialogVisible = ref(false)
const createFormRef = ref(null)
const geetestDialog = ref(null)
const searchKeyword = ref('')

const defaultCover = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMDAgMTUwIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjE1MCIgeT0iNzUiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPuWbvueJh+WKoOi9veWksei0pTwvdGV4dD48L3N2Zz4='

const createForm = reactive({
  name: '',
  description: '',
  cover: '',
  join_type: 'apply'
})

const createRules = {
  name: [{ required: true, message: '请输入工作室名称', trigger: 'blur' }]
}

const roleText = (role) => {
  const map = { owner: '创建者', admin: '管理员', member: '成员' }
  return map[role] || ''
}

const fetchStudios = async () => {
  loading.value = true
  try {
    let res
    if (activeTab.value === 'my') {
      res = await studioApi.getMyStudios()
      if (res.code === 200) {
        studios.value = res.data
        total.value = res.data.length
      }
    } else {
      res = await studioApi.getStudios({ page: currentPage.value, pageSize: pageSize.value, keyword: searchKeyword.value })
      if (res.code === 200) {
        studios.value = res.data.list
        total.value = res.data.total
      }
    }
  } catch (e) {
    console.error('获取工作室失败:', e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchStudios()
}

const showCreateDialog = () => {
  createForm.name = ''
  createForm.description = ''
  createForm.cover = ''
  createForm.join_type = 'apply'
  createDialogVisible.value = true
}

const handleCreate = async () => {
  const valid = await createFormRef.value.validate().catch(() => false)
  if (!valid) return
  
  const geetestData = await geetestDialog.value.show('create_studio')
  
  createLoading.value = true
  try {
    const res = await studioApi.createStudio({ ...createForm, ...geetestData })
    if (res.code === 200) {
      ElMessage.success('工作室创建成功')
      createDialogVisible.value = false
      activeTab.value = 'my'
      fetchStudios()
    } else {
      ElMessage.error(res.msg || '创建失败')
    }
  } catch (e) {
    ElMessage.error('创建失败')
  } finally {
    createLoading.value = false
  }
}

onMounted(fetchStudios)
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$primary-hover: #FFD700;
$primary-light: #FFF9E6;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;
$white: #fff;
$border-color: #eee;

.r-studio--page {
  padding: 24px;
  min-height: calc(100vh - 60px);
  background: #f5f5f5;
}

.r-studio--container {
  max-width: 1200px;
  margin: 0 auto;
}

.r-studio--header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  .r-studio--title {
    font-size: 24px;
    font-weight: 600;
    color: $text-color;
    margin: 0;
  }
  
  .r-studio--header_actions {
    display: flex;
    gap: 12px;
    align-items: center;
    
    .r-studio--search_input {
      width: 300px;
      
      :deep(.el-input__wrapper) {
        border-radius: 6px 0 0 6px;
        box-shadow: 0 0 0 1px #dcdfe6 inset !important;
        
        &.is-focus {
          box-shadow: 0 0 0 1px $primary-color inset !important;
        }
      }
      
      :deep(.el-input-group__append) {
        border-radius: 0 6px 6px 0;
        background-color: $primary-color;
        border: none;
        padding: 0;
        
        .el-button {
          border: none;
          background: transparent;
          color: $text-color;
          padding: 12px 20px;
          margin: 0;
          height: 100%;
          border-radius: 0 6px 6px 0;
          
          &:hover {
            background-color: $primary-hover;
          }
        }
      }
    }
  }
  
  .el-button {
    background: $primary-color;
    border-color: $primary-color;
    color: $text-color;
    border-radius: 6px;
    padding: 10px 20px;
    font-weight: 600;
    
    &:hover {
      background: $primary-hover;
      border-color: $primary-hover;
    }
  }
}

.r-studio--tabs {
  margin-bottom: 24px;
  
  :deep(.el-radio-button) {
    margin-right: 12px;
    
    .el-radio-button__inner {
      border: 1px solid #dcdfe6;
      padding: 10px 24px;
      background: #fff;
      border-radius: 6px !important;
      color: $text-secondary;
      box-shadow: none !important;
      transition: all 0.2s;
      
      &:hover {
        color: $primary-color;
        border-color: $primary-color;
      }
    }
    
    &.is-active .el-radio-button__inner {
      background-color: $primary-color;
      border-color: $primary-color;
      color: $text-color;
    }
  }
}

.r-studio--content {
  background: $white;
  border-radius: 12px;
  padding: 24px;
  min-height: 400px;
}

.r-studio--grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  
  @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 576px) { grid-template-columns: 1fr; }
}

.r-studio--card {
  background: $white;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid $border-color;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0,0,0,0.1);
    border-color: transparent;
  }
  
  .r-studio--card_cover {
    height: 120px;
    background-size: cover;
    background-position: center;
    position: relative;
    
    .r-studio--card_level {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    .r-studio--card_badge {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: $primary-color;
      color: $text-color;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 500;
    }
  }
  
  .r-studio--card_body {
    padding: 16px;
    
    .r-studio--card_name {
      font-size: 16px;
      font-weight: 600;
      color: $text-color;
      margin: 0 0 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .r-studio--card_desc {
      font-size: 13px;
      color: $text-secondary;
      margin: 0 0 16px;
      height: 40px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.5;
    }
    
    .r-studio--card_meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: $text-muted;
      
      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .r-studio--meta_icon {
        width: 14px;
        height: 14px;
        background-size: contain;
        background-repeat: no-repeat;
        
        &.r-studio--meta_icon_member {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E");
        }
        
        &.r-studio--meta_icon_work {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03A3.003 3.003 0 0 1 11 18c-1.66 0-3-1.34-3-3z'/%3E%3C/svg%3E");
        }
        
        &.r-studio--meta_icon_point {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/%3E%3C/svg%3E");
        }
      }
    }
  }
}

.r-studio--pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>
