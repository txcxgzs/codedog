<template>
  <div class="r-profile--page">
    <div class="r-profile--container">
      <!-- 个人信息头部 -->
      <div class="r-profile--header">
        <div class="r-profile--avatar_section">
          <img :src="userStore.user?.avatar || defaultAvatar" class="r-profile--avatar" />
          <input 
            type="file" 
            ref="avatarInput" 
            accept="image/*" 
            style="display: none" 
            @change="handleAvatarChange"
          />
          <el-button size="small" class="r-profile--change_avatar" @click="changeAvatar">更换头像</el-button>
        </div>
        <div class="r-profile--info_section">
          <h2>{{ userStore.user?.nickname || userStore.user?.username }}</h2>
          <p class="r-profile--email">{{ userStore.user?.email }}</p>
          <p class="r-profile--bio">{{ userStore.user?.bio || '这个人很懒，什么都没写~' }}</p>
        </div>
        <div class="r-profile--actions">
          <el-button type="primary" @click="$router.push('/publish')">
            <span class="r-profile--btn_icon r-profile--btn_icon_publish"></span>
            发布作品
          </el-button>
          <el-button @click="$router.push('/my-works')">
            <span class="r-profile--btn_icon r-profile--btn_icon_works"></span>
            我的作品
          </el-button>
        </div>
      </div>
      
      <!-- 标签页 -->
      <el-tabs v-model="activeTab" class="r-profile--tabs">
        <el-tab-pane label="基本信息" name="info">
          <div class="r-profile--tab_content">
            <el-form 
              ref="formRef" 
              :model="form" 
              :rules="rules" 
              label-width="80px"
              class="r-profile--form"
            >
              <el-form-item label="用户名">
                <el-input :value="userStore.user?.username" disabled />
              </el-form-item>
              <el-form-item label="邮箱">
                <el-input :value="userStore.user?.email" disabled />
              </el-form-item>
              <el-form-item label="昵称" prop="nickname">
                <el-input v-model="form.nickname" placeholder="请输入昵称" />
              </el-form-item>
              <el-form-item label="个人简介" prop="bio">
                <el-input 
                  v-model="form.bio" 
                  type="textarea" 
                  :rows="4"
                  placeholder="介绍一下自己吧~"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="loading" @click="saveProfile">
                  保存修改
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="修改密码" name="password">
          <div class="r-profile--tab_content">
            <el-form 
              ref="passwordFormRef" 
              :model="passwordForm" 
              :rules="passwordRules" 
              label-width="100px"
              class="r-profile--form"
            >
              <el-form-item label="旧密码" prop="oldPassword">
                <el-input v-model="passwordForm.oldPassword" type="password" show-password />
              </el-form-item>
              <el-form-item label="新密码" prop="newPassword">
                <el-input v-model="passwordForm.newPassword" type="password" show-password />
              </el-form-item>
              <el-form-item label="确认密码" prop="confirmPassword">
                <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="passwordLoading" @click="changePassword">
                  修改密码
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    
    <GeetestDialog ref="geetestDialogRef" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { userApi } from '@/api/user'
import { ElMessage } from 'element-plus'
import GeetestDialog from '@/components/GeetestDialog.vue'

const userStore = useUserStore()
const activeTab = ref('info')
const formRef = ref(null)
const passwordFormRef = ref(null)
const loading = ref(false)
const passwordLoading = ref(false)
const geetestDialogRef = ref(null)
const geetestConfig = ref(null)
const avatarInput = ref(null)
const avatarLoading = ref(false)

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const form = reactive({
  nickname: '',
  bio: ''
})

const rules = {
  nickname: [
    { max: 50, message: '昵称最多50个字符', trigger: 'blur' }
  ]
}

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入旧密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const fetchGeetestConfig = async () => {
  try {
    const res = await fetch('/api/geetest/config').then(r => r.json())
    if (res.code === 200) {
      geetestConfig.value = res.data
    }
  } catch (e) {
    console.error('获取验证码配置失败:', e)
  }
}

const changeAvatar = () => {
  avatarInput.value?.click()
}

const handleAvatarChange = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }
  
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过2MB')
    return
  }
  
  let geetestData = {}
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.update_profile) {
    geetestData = await geetestDialogRef.value.show('update_profile')
    if (!geetestData) {
      avatarInput.value.value = ''
      return
    }
  }
  
  avatarLoading.value = true
  try {
    const formData = new FormData()
    formData.append('avatar', file)
    Object.keys(geetestData).forEach(key => {
      formData.append(key, geetestData[key])
    })
    
    const res = await userApi.updateAvatar(formData)
    if (res.code === 200) {
      await userStore.fetchCurrentUser()
      ElMessage.success('头像更新成功')
    } else {
      ElMessage.error(res.msg || '上传失败')
    }
  } catch (error) {
    console.error('上传头像失败:', error)
    ElMessage.error('上传失败')
  } finally {
    avatarLoading.value = false
    avatarInput.value.value = ''
  }
}

const saveProfile = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  
  let geetestData = {}
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.update_profile) {
    geetestData = await geetestDialogRef.value.show('update_profile')
    if (!geetestData) return
  }
  
  loading.value = true
  try {
    const res = await userStore.updateProfile({
      nickname: form.nickname,
      bio: form.bio,
      ...geetestData
    })
    if (res.code === 200) {
      ElMessage.success('保存成功')
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (error) {
    console.error('保存失败:', error)
  } finally {
    loading.value = false
  }
}

const changePassword = async () => {
  const valid = await passwordFormRef.value.validate().catch(() => false)
  if (!valid) return
  
  let geetestData = {}
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.update_profile) {
    geetestData = await geetestDialogRef.value.show('update_profile')
    if (!geetestData) return
  }
  
  passwordLoading.value = true
  try {
    const res = await userApi.changePassword(
      passwordForm.oldPassword,
      passwordForm.newPassword,
      geetestData
    )
    if (res.code === 200) {
      ElMessage.success('密码修改成功')
      passwordForm.oldPassword = ''
      passwordForm.newPassword = ''
      passwordForm.confirmPassword = ''
    } else {
      ElMessage.error(res.msg || '修改失败')
    }
  } catch (error) {
    console.error('修改密码失败:', error)
  } finally {
    passwordLoading.value = false
  }
}

onMounted(() => {
  form.nickname = userStore.user?.nickname || ''
  form.bio = userStore.user?.bio || ''
  fetchGeetestConfig()
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

.r-profile--page {
  padding: 24px;
  display: flex;
  justify-content: center;
}

.r-profile--container {
  max-width: 800px;
  width: 100%;
}

.r-profile--header {
  background: $white;
  border-radius: 12px;
  padding: 32px;
  display: flex;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .r-profile--avatar_section {
    text-align: center;
    flex-shrink: 0;
    
    .r-profile--avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      object-fit: cover;
      border: 4px solid $primary-light;
    }
    
    .r-profile--change_avatar {
      margin-top: 12px;
      border-radius: 16px;
    }
  }
  
  .r-profile--info_section {
    flex: 1;
    
    h2 {
      font-size: 24px;
      font-weight: 600;
      color: $text-color;
      margin: 0 0 8px;
    }
    
    .r-profile--email {
      color: $text-muted;
      font-size: 14px;
      margin: 0 0 8px;
    }
    
    .r-profile--bio {
      color: $text-secondary;
      font-size: 14px;
      margin: 0;
      line-height: 1.6;
    }
  }
  
  .r-profile--actions {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
    
    @media (max-width: 768px) {
      width: 100%;
      justify-content: center;
    }
    
    .el-button {
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .el-button--primary {
      background: $primary-color;
      border-color: $primary-color;
      color: $text-color;
      
      &:hover {
        background: $primary-hover;
        border-color: $primary-hover;
      }
    }
    
    .r-profile--btn_icon {
      width: 14px;
      height: 14px;
      
      &.r-profile--btn_icon_publish {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23333'%3E%3Cpath d='M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-profile--btn_icon_works {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
    }
  }
}

.r-profile--tabs {
  background: $white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  
  :deep(.el-tabs__header) {
    margin-bottom: 24px;
  }
  
  :deep(.el-tabs__item) {
    font-size: 15px;
    
    &.is-active {
      color: $primary-color;
    }
  }
  
  :deep(.el-tabs__active-bar) {
    background: $primary-color;
  }
  
  .r-profile--tab_content {
    max-width: 500px;
  }
  
  .r-profile--form {
    :deep(.el-input__wrapper) {
      border-radius: 8px;
    }
    
    :deep(.el-textarea__inner) {
      border-radius: 8px;
    }
    
    :deep(.el-button--primary) {
      background: $primary-color;
      border-color: $primary-color;
      color: $text-color;
      border-radius: 8px;
      padding: 10px 24px;
      
      &:hover {
        background: $primary-hover;
        border-color: $primary-hover;
      }
    }
  }
}
</style>
