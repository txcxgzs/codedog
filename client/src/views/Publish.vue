<template>
  <div class="r-publish--page">
    <div class="r-publish--container">
      <div class="r-publish--header">
        <h2 class="r-publish--title">把你的作品带到这里</h2>
        <p class="r-publish--desc">粘贴作品 ID，预览确认后即可发布到编程狗社区。</p>
      </div>
      <div class="r-publish--steps">
        <span class="is-active"><b>1</b>填写 ID</span><i></i><span :class="{ 'is-active': previewData }"><b>2</b>确认作品</span><i></i><span><b>3</b>发布完成</span>
      </div>
      
      <el-form 
        ref="formRef" 
        :model="form" 
        :rules="rules" 
        label-position="top"
        class="r-publish--form"
        @submit.prevent="handlePublish"
      >
        <el-form-item label="编程猫作品 ID" prop="codemaoWorkId">
          <el-input
            v-model="form.codemaoWorkId"
            placeholder="例如：233220320"
            class="r-publish--input"
          >
            <template #append>
              <el-button @click="previewWork" :loading="previewLoading">获取作品</el-button>
            </template>
          </el-input>
          <div class="r-publish--tip">
            <span class="r-publish--tip_icon"></span>
            <span>打开编程猫作品页面，复制网址 <code>/work/</code> 后面的数字即可。</span>
          </div>
        </el-form-item>
        
        <el-form-item v-if="previewData">
          <div class="r-publish--preview">
            <div class="r-publish--preview_header">
              <span class="r-publish--preview_icon"></span>
              作品预览
            </div>
            <div class="r-publish--preview_content">
              <div class="r-publish--preview_cover">
                <img :src="previewData.preview" alt="预览" referrerpolicy="no-referrer">
              </div>
              <div class="r-publish--preview_info">
                <h4>{{ previewData.name }}</h4>
                <p>{{ previewData.description || '暂无描述' }}</p>
                <div class="r-publish--preview_meta">
                  <span><span class="r-publish--meta_icon r-publish--meta_icon_user"></span>{{ previewData.codemao_author_name }}</span>
                  <span><span class="r-publish--meta_icon r-publish--meta_icon_type"></span>{{ previewData.type }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-button 
            type="primary" 
            :loading="loading"
            native-type="submit"
            class="r-publish--submit_btn"
          >
            <span class="r-publish--submit_icon"></span>
            发布作品
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <GeetestDialog ref="geetestDialogRef" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { workApi } from '@/api/work'
import { geetestApi } from '@/api/geetest'
import { ElMessage } from 'element-plus'
import GeetestDialog from '@/components/GeetestDialog.vue'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)
const previewLoading = ref(false)
const previewData = ref(null)
const geetestDialogRef = ref(null)
const geetestConfig = ref(null)

const form = reactive({
  codemaoWorkId: ''
})

const rules = {
  codemaoWorkId: [
    { required: true, message: '请输入作品ID', trigger: 'blur' }
  ]
}

const fetchGeetestConfig = async () => {
  try {
    const res = await geetestApi.getConfig()
    if (res.code === 200) {
      geetestConfig.value = res.data
    }
  } catch (e) {
    console.error('获取极验配置失败:', e)
  }
}

onMounted(() => {
  fetchGeetestConfig()
})

const previewWork = async () => {
  if (!form.codemaoWorkId) {
    ElMessage.warning('请输入作品ID')
    return
  }
  
  previewLoading.value = true
  try {
    const res = await workApi.getDetail(form.codemaoWorkId)
    if (res.code === 200) {
      previewData.value = res.data
    } else {
      ElMessage.error('作品不存在或未公开')
      previewData.value = null
    }
  } catch (error) {
    ElMessage.error('获取作品信息失败')
    previewData.value = null
  } finally {
    previewLoading.value = false
  }
}

const handlePublish = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  
  let geetestData = {}
  
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.publish_work) {
    geetestData = await geetestDialogRef.value.show('publish_work')
    if (!geetestData) return
  }
  
  loading.value = true
  try {
    const res = await workApi.publish(parseInt(form.codemaoWorkId), geetestData)
    if (res.code === 200) {
      ElMessage.success('作品发布成功')
      router.push(`/work/${res.data.codemao_work_id}`)
    } else {
      ElMessage.error(res.msg || '发布失败')
    }
  } catch (error) {
    console.error('发布作品错误:', error)
    ElMessage.error('发布失败，请重试')
  } finally {
    loading.value = false
  }
}
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

.r-publish--page {
  position:relative;
  min-height:calc(100vh - 64px);
  padding:46px 24px 80px;
  display: flex;
  justify-content: center;
  overflow:hidden;
  background:radial-gradient(circle at 8% 6%,rgba(255,205,92,.32),transparent 28rem),radial-gradient(circle at 92% 14%,rgba(108,190,255,.25),transparent 32rem),linear-gradient(145deg,#f5f8ff 0%,#fafbff 50%,#fff8eb 100%);
}
.r-publish--page::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.5; background-image:linear-gradient(rgba(95,125,170,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(95,125,170,.055) 1px,transparent 1px); background-size:44px 44px; mask-image:linear-gradient(to bottom,#000,transparent 82%); }

.r-publish--container {
  position:relative;
  z-index:1;
  max-width: 900px;
  width: 100%;
  background: $white;
  border:1px solid rgba(255,255,255,.94);
  border-radius: 22px;
  padding: 40px 44px;
  background:rgba(255,255,255,.84);
  backdrop-filter:blur(18px);
  box-shadow: 0 20px 55px rgba(39,55,82,.09);
  
  .r-publish--header {
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid $border-color;
    
    .r-publish--title {
      font-size: clamp(31px,4vw,43px);
      line-height:1.15;
      letter-spacing:-.045em;
      font-weight: 800;
      color: #172033;
      margin: 0 0 8px;
    }
    
    .r-publish--desc {
      color: #667085;
      font-size: 15px;
      margin: 0;
    }
  }
  
  .r-publish--form {
    :deep(.el-form-item__label) { color:#344054; font-size:15px; font-weight:700; }
    .r-publish--input {
      :deep(.el-input__wrapper) {
        min-height:48px;
        border-radius: 12px 0 0 12px!important;
        background:#f8faff;
      }
      
      :deep(.el-input-group__append) {
        border-radius: 0 12px 12px 0;
        background: $primary-color;
        border-color: $primary-color;
        color: $text-color;
        
        .el-button {
          color: $text-color;
          font-weight: 500;
        }
      }
    }
  }
  
  .r-publish--tip {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: $text-muted;
    margin-top: 12px;
        padding: 14px 16px;
    background: $primary-light;
    border-radius: 8px;
    line-height: 1.6;
    
    .r-publish--tip_icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      margin-top: 2px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FEC433'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
    
    strong {
      color: $primary-color;
    }
  }
  
  .r-publish--preview {
    width: 100%;
    border: 1px solid $border-color;
    border-radius: 17px;
    overflow: hidden;
    
    .r-publish--preview_header {
      background: linear-gradient(90deg,#fff8e5,#f2f8ff);
      padding: 14px 18px;
      font-size: 14px;
      font-weight: 500;
      color: $text-color;
      border-bottom: 1px solid $border-color;
      display: flex;
      align-items: center;
      gap: 8px;
      
      .r-publish--preview_icon {
        width: 18px;
        height: 18px;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2367c23a'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
    }
    
    .r-publish--preview_content {
      display: flex;
      gap: 20px;
      padding: 22px;
      
      @media (max-width: 576px) {
        flex-direction: column;
      }
      
      .r-publish--preview_cover {
        width: 200px;
        flex-shrink: 0;
        position: relative;
        
        @media (max-width: 576px) {
          width: 100%;
        }
        
        img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 13px;
        }
        
        &::before {
          content: '';
          display: block;
          padding-top: 100%;
        }
      }
      
      .r-publish--preview_info {
        flex: 1;
        
        h4 {
          font-size: 18px;
          font-weight: 600;
          color: $text-color;
          margin: 0 0 8px;
        }
        
        p {
          font-size: 14px;
          color: $text-secondary;
          margin: 0 0 12px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.6;
        }
        
        .r-publish--preview_meta {
          display: flex;
          gap: 20px;
          font-size: 13px;
          color: $text-muted;
          
          span {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          
          .r-publish--meta_icon {
            width: 14px;
            height: 14px;
            
            &.r-publish--meta_icon_user {
              background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E") no-repeat center;
              background-size: contain;
            }
            
            &.r-publish--meta_icon_type {
              background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z'/%3E%3C/svg%3E") no-repeat center;
              background-size: contain;
            }
          }
        }
      }
    }
  }
  
  .r-publish--submit_btn {
    width: 100%;
    height: 48px;
    font-size: 16px;
    border-radius: 13px!important;
    background: $primary-color;
    border-color: $primary-color;
    color: $text-color;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    
    &:hover {
      background: $primary-hover;
      border-color: $primary-hover;
    }
    
    .r-publish--submit_icon {
      width: 16px;
      height: 16px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23333'%3E%3Cpath d='M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
  }
}
.r-publish--steps { display:flex; align-items:center; margin:0 0 28px; padding:14px 16px; border-radius:14px; background:#f6f8fb; color:#98a2b3; }
.r-publish--steps span { display:flex; align-items:center; gap:7px; white-space:nowrap; font-weight:600; }
.r-publish--steps span b { display:grid; place-items:center; width:25px; height:25px; border-radius:8px; background:#e6eaf0; color:#7b8493; }
.r-publish--steps span.is-active { color:#172033; }
.r-publish--steps span.is-active b { background:#fec433; color:#172033; }
.r-publish--steps i { flex:1; height:1px; margin:0 12px; background:#dfe4ec; }
.r-publish--tip code { padding:2px 5px; border-radius:5px; background:rgba(255,255,255,.72); color:#9b6800; }
@media(max-width:640px){.r-publish--page{padding:20px 14px 56px}.r-publish--container{padding:28px 18px;border-radius:18px}.r-publish--steps{overflow-x:auto}.r-publish--steps i{min-width:20px}}
</style>
