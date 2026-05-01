<template>
  <div class="r-publish--page">
    <div class="r-publish--container">
      <div class="r-publish--header">
        <h2 class="r-publish--title">发布作品</h2>
        <p class="r-publish--desc">输入编程猫作品ID，系统将自动获取作品信息并发布到本平台</p>
      </div>
      
      <el-form 
        ref="formRef" 
        :model="form" 
        :rules="rules" 
        label-width="100px"
        class="r-publish--form"
        @submit.prevent="handlePublish"
      >
        <el-form-item label="作品ID" prop="codemaoWorkId">
          <el-input 
            v-model="form.codemaoWorkId" 
            placeholder="请输入编程猫作品ID"
            type="number"
            class="r-publish--input"
          >
            <template #append>
              <el-button @click="previewWork" :loading="previewLoading">预览</el-button>
            </template>
          </el-input>
          <div class="r-publish--tip">
            <span class="r-publish--tip_icon"></span>
            <span>如何获取作品ID：打开编程猫作品页面，URL中的数字即为作品ID。例如：https://shequ.codemao.cn/work/<strong>233220320</strong></span>
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
                <img :src="previewData.preview" alt="预览">
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
  padding: 24px;
  display: flex;
  justify-content: center;
}

.r-publish--container {
  max-width: 700px;
  width: 100%;
  background: $white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  
  .r-publish--header {
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid $border-color;
    
    .r-publish--title {
      font-size: 24px;
      font-weight: 600;
      color: $text-color;
      margin: 0 0 8px;
    }
    
    .r-publish--desc {
      color: $text-muted;
      font-size: 14px;
      margin: 0;
    }
  }
  
  .r-publish--form {
    .r-publish--input {
      :deep(.el-input__wrapper) {
        border-radius: 8px;
      }
      
      :deep(.el-input-group__append) {
        border-radius: 0 8px 8px 0;
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
    padding: 12px 16px;
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
    border-radius: 12px;
    overflow: hidden;
    
    .r-publish--preview_header {
      background: #f9fafb;
      padding: 12px 16px;
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
      padding: 20px;
      
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
          border-radius: 8px;
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
    border-radius: 8px;
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
</style>
