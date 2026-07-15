<template>
  <div class="r-studio--page">
    <div class="r-studio--container">
      <div class="r-studio--header">
        <div class="r-studio--heading">
          <h2 class="r-studio--title">找到一起创造的人</h2>
          <p>加入工作室，与伙伴分享灵感、作品与成长。</p>
        </div>
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
        <el-radio-group v-model="activeTab" @change="handleTabChange">
          <el-radio-button label="all">全部工作室</el-radio-button>
          <el-radio-button label="my" v-if="userStore.isLoggedIn">我的工作室</el-radio-button>
        </el-radio-group>
      </div>
      
      <div class="r-studio--content" v-loading="loading">
        <div class="r-studio--grid" v-if="studios.length > 0">
          <div v-for="studio in studios" :key="studio.id" class="r-studio--card" @click="$router.push(`/studio/${studio.id}`)">
            <!-- 修复: 默认封面用工作室名称首字艺术字,而非 emoji -->
            <div class="r-studio--card_cover">
              <img v-if="studio.cover || studio.cover_url" :src="studio.cover || studio.cover_url" :alt="studio.name" class="r-studio--card_cover_image" />
              <div v-else class="r-studio--card_cover_image r-studio--card_cover_pending">封面生成中</div>
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
    
    <el-dialog v-model="createDialogVisible" title="创建工作室" width="720px" class="r-studio--create_dialog">
      <div class="r-studio--create_intro"><b>组建你的创作小队</b><span>设置名称和加入方式，创建后还可以邀请伙伴、管理作品。</span></div>
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-position="top" class="r-studio--create_form">
        <el-form-item label="名称" prop="name">
          <el-input v-model="createForm.name" placeholder="请输入工作室名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="简介" prop="description">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="介绍一下你的工作室吧" maxlength="500" />
        </el-form-item>
        <el-form-item label="封面" prop="cover">
          <div class="r-studio--cover_upload" @click="studioCoverInput?.click()">
            <img v-if="createForm.cover" :src="createForm.cover" alt="工作室封面" />
            <span v-else>选择工作室封面图片</span>
            <el-button size="small" :loading="coverUploading">{{ createForm.cover ? '更换图片' : '上传图片' }}</el-button>
          </div>
          <input ref="studioCoverInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="uploadStudioCover" />
        </el-form-item>
        <el-form-item label="加入方式" prop="join_type">
          <el-radio-group v-model="createForm.join_type" class="r-studio--join_options">
            <el-radio label="free"><b>自由加入</b><span>任何人都可以直接加入</span></el-radio>
            <el-radio label="apply"><b>申请加入</b><span>管理员审核后加入</span></el-radio>
            <el-radio label="invite"><b>仅限邀请</b><span>只允许受邀用户加入</span></el-radio>
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
import { useGeetestConfig } from '@/composables/useGeetestConfig'
import { Search, Plus } from '@element-plus/icons-vue'
import { uploadApi } from '@/api/upload'

const userStore = useUserStore()
const loading = ref(true)
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
const studioCoverInput = ref(null)
const coverUploading = ref(false)

const uploadStudioCover = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 5 * 1024 * 1024) return ElMessage.warning('封面不能超过 5MB')
  coverUploading.value = true
  try {
    const res = await uploadApi.image(file)
    createForm.cover = res.data?.url || ''
    if (!createForm.cover) throw new Error('图床未返回地址')
    ElMessage.success('封面上传成功')
  } catch (e) { ElMessage.error(e.response?.data?.msg || '封面上传失败') }
  finally { coverUploading.value = false }
}

const { geetestEnabled, fetchGeetestConfig } = useGeetestConfig()

// 默认封面已改为模板中动态渲染首字艺术字
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

// 修复: 切换标签时重置分页,避免从"我的工作室"切回"全部"时停留在非第一页
const handleTabChange = () => {
  currentPage.value = 1
  fetchStudios()
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
  
  let geetestData = {}
  if (geetestEnabled('create_studio') && geetestDialog.value) {
    const result = await geetestDialog.value.show('create_studio')
    if (!result) return
    geetestData = result
  }
  
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

onMounted(() => {
  fetchGeetestConfig()
  fetchStudios()
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
    background-color: #6978dc; /* 仅作加载兜底，不能覆盖模板传入的 background-image */

    .r-studio--card_cover_image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* 工作室首字艺术字占位符 */
    .r-studio--cover_placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;

      .r-studio--cover_initial {
        font-size: 48px;
        font-weight: 700;
        color: rgba(255,255,255,0.9);
        text-shadow: 0 2px 8px rgba(0,0,0,0.2);
        font-family: 'Georgia', 'Times New Roman', serif;
        user-select: none;
      }
    }
    
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

/* 全新工作室广场：与发现/社区统一的蓝金画布 */
.r-studio--page { position:relative; overflow:hidden; padding:46px 24px 80px; background:radial-gradient(circle at 8% 6%,rgba(255,205,92,.32),transparent 27rem),radial-gradient(circle at 92% 14%,rgba(108,190,255,.25),transparent 31rem),linear-gradient(145deg,#f5f8ff 0%,#fafbff 50%,#fff8eb 100%); }
.r-studio--page::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.5; background-image:linear-gradient(rgba(95,125,170,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(95,125,170,.055) 1px,transparent 1px); background-size:44px 44px; mask-image:linear-gradient(to bottom,#000,transparent 80%); }
.r-studio--container { position:relative; z-index:1; max-width:1220px; }
.r-studio--header { align-items:flex-end; margin-bottom:22px; }
.r-studio--heading p { margin:10px 0 0; color:#667085; font-size:15px; }
.r-studio--header .r-studio--title { color:#172033; font-size:clamp(32px,3vw,43px); line-height:1.12; letter-spacing:-.045em; font-weight:800; }
.r-studio--header .r-studio--header_actions { gap:10px; }
.r-studio--header .r-studio--header_actions .r-studio--search_input { width:310px; }
.r-studio--header .r-studio--header_actions .r-studio--search_input :deep(.el-input__wrapper) { height:44px; border-radius:12px 0 0 12px!important; background:rgba(255,255,255,.84); box-shadow:0 0 0 1px rgba(213,219,230,.9) inset!important; }
.r-studio--header .r-studio--header_actions .r-studio--search_input :deep(.el-input-group__append) { border-radius:0 12px 12px 0!important; box-shadow:none; }
.r-studio--header .r-studio--header_actions .r-studio--search_input :deep(.el-input-group__append .el-button) { width:52px; padding:0; border-radius:0!important; }
.r-studio--header .el-button { height:44px; padding:0 19px; border:0; border-radius:12px!important; box-shadow:0 9px 22px rgba(220,159,24,.2); }
.r-studio--tabs { display:inline-flex; margin-bottom:18px; padding:5px; border:1px solid rgba(255,255,255,.92); border-radius:14px; background:rgba(255,255,255,.72); backdrop-filter:blur(16px); box-shadow:0 10px 28px rgba(39,55,82,.06); }
.r-studio--tabs :deep(.el-radio-group) { display:flex; gap:8px; }
.r-studio--tabs :deep(.el-radio-button) { margin:0; }
.r-studio--tabs :deep(.el-radio-button .el-radio-button__inner) { padding:9px 18px; border:0!important; border-radius:10px!important; background:transparent; color:#667085; font-weight:600; }
.r-studio--tabs :deep(.el-radio-button.is-active .el-radio-button__inner) { color:#fff; background:#172033; box-shadow:0 6px 14px rgba(23,32,51,.16)!important; }
.r-studio--content { min-height:430px; padding:24px; border:1px solid rgba(255,255,255,.94); border-radius:20px; background:rgba(255,255,255,.76); backdrop-filter:blur(18px); box-shadow:0 20px 55px rgba(39,55,82,.08); }
.r-studio--grid { grid-template-columns:repeat(3,1fr); gap:20px; }
.r-studio--card { border:1px solid rgba(226,231,239,.85); border-radius:17px; box-shadow:0 8px 24px rgba(39,55,82,.06); }
.r-studio--card:hover { transform:translateY(-6px); box-shadow:0 18px 38px rgba(39,55,82,.14); }
.r-studio--card .r-studio--card_cover { height:150px; }
.r-studio--card_cover_pending { display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#edf2fa,#e5eaf4); color:#8a96a8; font-size:13px; }
.r-studio--card .r-studio--card_cover .r-studio--card_level { top:12px; right:12px; padding:4px 9px; border-radius:8px; backdrop-filter:blur(8px); }
.r-studio--card .r-studio--card_cover .r-studio--card_badge { bottom:12px; right:12px; border-radius:7px; }
.r-studio--card .r-studio--card_body { padding:18px; }
.r-studio--card .r-studio--card_body .r-studio--card_name { color:#1b2436; font-size:17px; font-weight:700; }
.r-studio--card .r-studio--card_body .r-studio--card_desc { color:#697386; }
.r-studio--card .r-studio--card_body .r-studio--card_meta { padding-top:13px; border-top:1px solid #edf0f5; }
@media(max-width:768px){.r-studio--page{padding:28px 14px 56px}.r-studio--header{align-items:flex-start;flex-direction:column}.r-studio--header .r-studio--header_actions{width:100%;flex-wrap:wrap}.r-studio--header .r-studio--header_actions .r-studio--search_input{width:100%}.r-studio--content{padding:14px}.r-studio--grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.r-studio--grid{grid-template-columns:1fr}}
.r-studio--cover_upload { width:100%; min-height:92px; padding:12px; display:flex; align-items:center; gap:12px; border:1px dashed #cad2df; border-radius:14px; background:#f8faff; cursor:pointer; }
.r-studio--cover_upload:hover { border-color:#fec433; background:#fffaf0; }
.r-studio--cover_upload img { width:132px; height:72px; object-fit:cover; border-radius:10px; }
.r-studio--cover_upload > span { flex:1; color:#667085; }
.r-studio--create_dialog :deep(.el-dialog) { border-radius:22px!important; }
.r-studio--create_dialog :deep(.el-dialog__header) { padding:25px 28px 16px; border-bottom:1px solid #edf0f5; }
.r-studio--create_dialog :deep(.el-dialog__title) { color:#172033; font-size:22px; font-weight:800; }
.r-studio--create_dialog :deep(.el-dialog__body) { padding:18px 28px 8px; }
.r-studio--create_dialog :deep(.el-dialog__footer) { padding:16px 28px 24px; }
.r-studio--create_intro { display:flex; flex-direction:column; gap:4px; margin-bottom:20px; padding:14px 16px; border-radius:13px; background:linear-gradient(90deg,#fff8e5,#f2f8ff); }
.r-studio--create_intro b { color:#172033; font-size:15px; }
.r-studio--create_intro span { color:#7b8596; font-size:13px; }
.r-studio--create_form :deep(.el-form-item__label) { color:#344054; font-weight:700; }
.r-studio--create_form :deep(.el-input__wrapper), .r-studio--create_form :deep(.el-textarea__inner) { border-radius:11px!important; background:#fbfcff; }
.r-studio--create_form :deep(.el-input__wrapper) { min-height:42px; }
.r-studio--join_options { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; width:100%; }
.r-studio--join_options :deep(.el-radio) { height:auto; margin:0; padding:14px; align-items:flex-start; border:1px solid #e1e6ee; border-radius:13px; background:#fff; }
.r-studio--join_options :deep(.el-radio.is-checked) { border-color:#fec433; background:#fffaf0; box-shadow:0 7px 20px rgba(220,159,24,.1); }
.r-studio--join_options :deep(.el-radio__label) { display:flex; flex-direction:column; gap:3px; padding-left:8px; color:#344054; }
.r-studio--join_options :deep(.el-radio__label span) { color:#98a2b3; font-size:11px; white-space:normal; }
@media(max-width:640px){.r-studio--join_options{grid-template-columns:1fr}}
</style>
