<template>
  <div class="r-profile--page">
    <div class="r-profile--container">
      <!-- 个人信息头部 -->
      <div class="r-profile--header">
        <div class="r-profile--avatar_section" @click="changeAvatar">
          <AppImage :src="userStore.user?.avatar || defaultAvatar" :fallback="defaultAvatar" class="r-profile--avatar" />
          <div class="r-profile--avatar_overlay">更换头像</div>
          <input
            type="file"
            ref="avatarInput"
            accept="image/*"
            style="display: none"
            @change="handleAvatarChange"
          />
        </div>
        <div class="r-profile--info_section">
          <h2>{{ userStore.user?.nickname || userStore.user?.username }}</h2>
          <p class="r-profile--email">{{ userStore.user?.email }}</p>
          <p class="r-profile--bio">{{ userStore.user?.bio || '这个人很懒，什么都没写~' }}</p>
        </div>
        <div class="r-profile--actions">
          <el-button v-if="userStore.user?.codemao_user_id" plain @click="viewPublicProfile">
            查看我的主页
          </el-button>
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
              <el-form-item label="主页封面">
                <div class="r-profile--cover_setting">
                  <div class="r-profile--cover_preview" :style="{ backgroundImage: form.profile_cover ? `url(${form.profile_cover})` : '' }"><span v-if="!form.profile_cover">默认渐变封面</span></div>
                  <div><el-button :loading="coverUploading" @click="coverInput?.click()">上传封面图片</el-button><el-button v-if="form.profile_cover" text @click="form.profile_cover = ''">恢复默认</el-button></div>
                  <input ref="coverInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="handleCoverChange" />
                </div>
              </el-form-item>
              <el-form-item label="收藏隐私">
                <el-switch v-model="form.show_favorites" active-text="向其他用户展示我的收藏夹" inactive-text="仅自己可见" />
              </el-form-item>
              <el-form-item label="鼠标样式">
                <div class="r-profile--cursor_setting">
                  <el-switch
                    v-model="prettyCursorEnabled"
                    active-text="使用 STMC 美化鼠标"
                    inactive-text="使用系统默认鼠标"
                    @change="changeCursorPreference"
                  />
                  <small>仅在使用鼠标的电脑设备上生效，可随时切回系统默认样式。</small>
                </div>
              </el-form-item>
              <transition name="r-profile--save">
                <el-form-item v-if="isProfileDirty" class="r-profile--save_row">
                  <div class="r-profile--save_hint">检测到资料有改动</div>
                  <el-button type="primary" :loading="loading" @click="saveProfile">
                    保存修改
                  </el-button>
                  <el-button @click="resetProfileForm">撤销改动</el-button>
                </el-form-item>
              </transition>
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

        <el-tab-pane label="已授权应用" name="authorizations">
          <div class="r-profile--tab_content r-profile--tab_content_wide">
            <el-table class="r-profile--authorization_table" :data="authorizations" v-loading="authLoading" empty-text="暂无授权的第三方应用">
              <el-table-column label="应用" min-width="150">
                <template #default="{ row }">{{ row.app?.name || '-' }}</template>
              </el-table-column>
              <el-table-column label="权限" min-width="170">
                <template #default="{ row }">
                  <el-tag v-for="s in (row.scopes || [])" :key="s" size="small" style="margin:0 4px 4px 0">{{ s }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="授权时间" width="170">
                <template #default="{ row }">{{ formatAuthDate(row.authorized_at) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="96" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button size="small" type="danger" @click="revokeAuth(row)">撤销</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    
    <GeetestDialog ref="geetestDialogRef" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { userApi } from '@/api/user'
import { uploadApi } from '@/api/upload'
import { developerApi } from '@/api/developer'
import { geetestApi } from '@/api/geetest'
import { ElMessage, ElMessageBox } from 'element-plus'
import GeetestDialog from '@/components/GeetestDialog.vue'
import AppImage from '@/components/AppImage.vue'

const userStore = useUserStore()
const router = useRouter()
const activeTab = ref('info')
const authorizations = ref([])
const authLoading = ref(false)
const formRef = ref(null)
const passwordFormRef = ref(null)
const loading = ref(false)
const passwordLoading = ref(false)
const geetestDialogRef = ref(null)
const geetestConfig = ref(null)
const avatarInput = ref(null)
const avatarLoading = ref(false)
const coverInput = ref(null)
const coverUploading = ref(false)
const PRETTY_CURSOR_PREFERENCE = 'codedog_pretty_cursor_choice_v1'
const prettyCursorEnabled = ref(localStorage.getItem(PRETTY_CURSOR_PREFERENCE) === 'enabled')

const changeCursorPreference = enabled => {
  const value = enabled ? 'enabled' : 'disabled'
  localStorage.setItem(PRETTY_CURSOR_PREFERENCE, value)
  document.documentElement.classList.toggle('codedog-pretty-cursor', enabled)
  window.dispatchEvent(new CustomEvent('codedog-cursor-preference', { detail: { enabled } }))
  ElMessage.success(enabled ? '已启用 STMC 美化鼠标' : '已恢复系统默认鼠标')
}

const viewPublicProfile = () => {
  const codemaoId = userStore.user?.codemao_user_id
  if (!codemaoId) {
    ElMessage.warning('当前账号暂无可用的公开主页 ID')
    return
  }
  router.push(`/user/${codemaoId}`)
}

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const form = reactive({
  nickname: '',
  bio: '',
  profile_cover: '',
  show_favorites: false
})
const savedProfile = ref({ nickname: '', bio: '', profile_cover: '', show_favorites: false })
const profileSnapshot = () => ({
  nickname: String(form.nickname || '').trim(),
  bio: String(form.bio || '').trim(),
  profile_cover: String(form.profile_cover || '').trim(),
  show_favorites: !!form.show_favorites
})
const isProfileDirty = computed(() => JSON.stringify(profileSnapshot()) !== JSON.stringify(savedProfile.value))
const resetProfileForm = () => Object.assign(form, savedProfile.value)

const handleCoverChange = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    ElMessage.error('请选择不超过 5MB 的 JPG、PNG 或 WebP 图片')
    event.target.value = ''
    return
  }
  coverUploading.value = true
  try {
    const res = await uploadApi.image(file)
    if (res.code !== 200 || !res.data?.url) throw new Error(res.msg || '上传失败')
    form.profile_cover = res.data.url
    ElMessage.success('封面已上传，保存资料后生效')
  } catch (error) {
    ElMessage.error(error.response?.data?.msg || error.message || '封面上传失败')
  } finally {
    coverUploading.value = false
    event.target.value = ''
  }
}

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
    const res = await geetestApi.getConfig()
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
      avatarInput.value && (avatarInput.value.value = '')
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
      profile_cover: form.profile_cover,
      show_favorites: form.show_favorites,
      ...geetestData
    })
    if (res.code === 200) {
      savedProfile.value = profileSnapshot()
      ElMessage.success('保存成功')
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    loading.value = false
  }
}

const changePassword = async () => {
  // 当前仅支持编程猫账号登录，自助改密功能未启用
  ElMessage.info('当前仅支持编程猫账号登录，请前往编程猫修改密码')
  return
}

watch(() => userStore.user, (user) => {
  if (user) {
    form.nickname = user.nickname || ''
    form.bio = user.bio || ''
    form.profile_cover = user.profile_cover || ''
    form.show_favorites = !!user.show_favorites
    savedProfile.value = profileSnapshot()
  }
}, { immediate: true })


const formatAuthDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN')
}

const loadAuthorizations = async () => {
  authLoading.value = true
  try {
    const res = await developerApi.listAuthorizations()
    if (res.code === 200) authorizations.value = res.data || []
  } catch (e) {
    console.error(e)
  } finally {
    authLoading.value = false
  }
}

const revokeAuth = async (row) => {
  try {
    await ElMessageBox.confirm(`撤销对「${row.app?.name || '该应用'}」的授权？`, '撤销授权', { type: 'warning' })
    const res = await developerApi.revokeAuthorization(row.id)
    if (res.code === 200) {
      ElMessage.success('已撤销')
      loadAuthorizations()
    } else {
      ElMessage.error(res.msg || '撤销失败')
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.msg || '撤销失败')
  }
}

watch(activeTab, (v) => {
  if (v === 'authorizations') loadAuthorizations()
})

onMounted(() => {
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
    position: relative;
    cursor: pointer;

    .r-profile--avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      object-fit: cover;
      border: 4px solid $primary-light;
      transition: opacity 0.3s;
    }

    .r-profile--avatar_overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.5);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.3s;
    }

    &:hover {
      .r-profile--avatar {
        opacity: 0.8;
      }

      .r-profile--avatar_overlay {
        opacity: 1;
      }
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

  .r-profile--tab_content_wide {
    width: 100%;
    max-width: none;
  }

  .r-profile--authorization_table {
    width: 100%;
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

.r-profile--cover_setting { width: 100%; }
.r-profile--cover_preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 3 / 1;
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid #e2e8f2;
  border-radius: 14px;
  color: #fff;
  font-size: 13px;
  background: linear-gradient(120deg, #17243f, #617adb 55%, #7cd6e5);
  background-position: center;
  background-size: cover;
}

/* 新版资料中心：与公开主页共享轻盈的蓝金视觉体系。 */
.r-profile--page {
  min-height: calc(100vh - 56px);
  padding: 34px 20px 80px;
  align-items: flex-start;
  background:
    radial-gradient(circle at 8% 5%, rgba(254, 196, 51, .17), transparent 26%),
    radial-gradient(circle at 92% 4%, rgba(91, 177, 255, .18), transparent 29%),
    linear-gradient(135deg, #f8faff 0%, #f4f7fc 55%, #fffaf2 100%);
}

.r-profile--container { max-width: 1120px; }

.r-profile--header {
  position: relative;
  align-items: center;
  min-height: 150px;
  padding: 30px 34px;
  margin-bottom: 22px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.92);
  border-radius: 24px;
  background:
    radial-gradient(circle at 82% 20%, rgba(113, 211, 231, .22), transparent 24%),
    linear-gradient(125deg, rgba(255,255,255,.98), rgba(244,248,255,.96));
  box-shadow: 0 20px 55px rgba(30, 54, 92, .11);
}

.r-profile--header::after {
  content: '';
  position: absolute;
  right: -55px;
  bottom: -85px;
  width: 260px;
  height: 210px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(84,109,215,.08), rgba(104,211,228,.16));
}

.r-profile--header .r-profile--avatar_section,
.r-profile--header .r-profile--info_section,
.r-profile--header .r-profile--actions { position: relative; z-index: 1; }
.r-profile--header .r-profile--avatar_section .r-profile--avatar {
  width: 112px;
  height: 112px;
  border: 5px solid #fff;
  box-shadow: 0 12px 28px rgba(28,45,75,.18);
}
.r-profile--header .r-profile--avatar_section .r-profile--avatar_overlay { width: 112px; height: 112px; }
.r-profile--header .r-profile--info_section h2 { font-size: 28px; color: #152039; letter-spacing: -.5px; }
.r-profile--header .r-profile--actions { flex-wrap: wrap; justify-content: flex-end; max-width: 390px; }
.r-profile--header .r-profile--actions .el-button { height: 40px; margin-left: 0; padding: 0 17px; border-radius: 12px; }

.r-profile--tabs {
  padding: 10px 30px 36px;
  border: 1px solid rgba(226,231,242,.92);
  border-radius: 24px;
  box-shadow: 0 20px 55px rgba(30,54,92,.09);
}
.r-profile--tabs :deep(.el-tabs__header) { margin-bottom: 30px; }
.r-profile--tabs :deep(.el-tabs__nav-wrap) { padding-top: 8px; }
.r-profile--tabs :deep(.el-tabs__item) { height: 52px; padding: 0 22px; font-weight: 600; color: #68748b; }
.r-profile--tabs :deep(.el-tabs__item.is-active) { color: #172039; }
.r-profile--tabs :deep(.el-tabs__active-bar) { height: 3px; border-radius: 3px; background: #fec433; }
.r-profile--tabs .r-profile--tab_content { max-width: 760px; margin: 0 auto; }
.r-profile--tabs .r-profile--tab_content_wide { max-width: none; }
.r-profile--form :deep(.el-form-item) { margin-bottom: 24px; }
.r-profile--form :deep(.el-form-item__label) { color: #435069; font-weight: 600; }
.r-profile--form :deep(.el-input__wrapper),
.r-profile--form :deep(.el-textarea__inner) {
  border-radius: 12px;
  box-shadow: 0 0 0 1px #dfe5ef inset;
  transition: box-shadow .2s, background .2s;
}
.r-profile--form :deep(.el-input__wrapper) { min-height: 44px; padding: 0 14px; }
.r-profile--form :deep(.el-input__wrapper.is-focus),
.r-profile--form :deep(.el-textarea__inner:focus) { box-shadow: 0 0 0 2px rgba(254,196,51,.62) inset; }
.r-profile--form :deep(.is-disabled .el-input__wrapper) { background: #f4f6fa; }
.r-profile--cursor_setting { display:flex; flex-direction:column; align-items:flex-start; gap:7px; }
.r-profile--cursor_setting small { color:#8a94a6; line-height:1.55; }
.r-profile--cover_preview { aspect-ratio: 3.4 / 1; border-radius: 18px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }

.r-profile--save_row {
  position: sticky;
  bottom: 18px;
  z-index: 5;
  margin: 10px 0 0 !important;
  padding: 14px 16px;
  border: 1px solid rgba(226,231,242,.95);
  border-radius: 16px;
  background: rgba(255,255,255,.94);
  box-shadow: 0 16px 36px rgba(30,54,92,.16);
  backdrop-filter: blur(12px);
}
.r-profile--save_row :deep(.el-form-item__content) { gap: 10px; }
.r-profile--save_hint { margin-right: auto; color: #69758b; font-size: 13px; }
.r-profile--save-enter-active, .r-profile--save-leave-active { transition: opacity .2s, transform .2s; }
.r-profile--save-enter-from, .r-profile--save-leave-to { opacity: 0; transform: translateY(8px); }

@media (max-width: 768px) {
  .r-profile--page { padding: 14px 12px 94px; }
  .r-profile--header { padding: 24px 18px; border-radius: 19px; }
  .r-profile--header .r-profile--actions { max-width: none; }
  .r-profile--header .r-profile--actions .el-button { flex: 1; min-width: 130px; }
  .r-profile--tabs { padding: 8px 14px 26px; border-radius: 19px; }
  .r-profile--tabs :deep(.el-tabs__nav-scroll) { overflow-x: auto; }
  .r-profile--tabs :deep(.el-tabs__nav) { float: none; display: flex; width: max-content; }
  .r-profile--tabs :deep(.el-tabs__item) { padding: 0 16px; }
  .r-profile--form :deep(.el-form-item) { display: block; }
  .r-profile--form :deep(.el-form-item__label) { display: block; width: 100% !important; height: 30px; line-height: 30px; text-align: left; }
  .r-profile--form :deep(.el-form-item__content) { margin-left: 0 !important; }
  .r-profile--save_hint { width: 100%; }
}
</style>
