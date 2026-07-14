<template>
  <div class="r-studio-detail--page">
    <div class="r-studio-detail--container" v-loading="loading">
      <div class="r-studio-detail--header" v-if="studio">
        <!-- 修复: 默认封面用工作室名称首字艺术字,而非 emoji -->
        <div class="r-studio-detail--cover" :style="{ backgroundImage: studio.cover ? `url(${studio.cover})` : `url(${defaultStudioCover(studio)})` }">
          <div v-if="!studio.cover" class="r-studio-detail--cover_placeholder">
            <span class="r-studio-detail--cover_initial">{{ (studio.name || '?').charAt(0).toUpperCase() }}</span>
          </div>
        </div>
        <div class="r-studio-detail--info">
          <div class="r-studio-detail--title_row">
            <h1 class="r-studio-detail--name">{{ studio.name }}</h1>
            <span class="r-studio-detail--level">Lv.{{ studio.level || 1 }}</span>
          </div>
          <p class="r-studio-detail--desc">{{ studio.description || '暂无简介' }}</p>
          <div class="r-studio-detail--stats">
            <span><i>👥</i> {{ studio.member_count }} 成员</span>
            <span><i>📁</i> {{ studio.work_count }} 作品</span>
            <span><i>⭐</i> {{ studio.points || 0 }} 积分</span>
            <span><i>🏆</i> {{ studio.total_score || 0 }} 作品总分</span>
          </div>
          <div class="r-studio-detail--actions">
            <template v-if="userStore.isLoggedIn">
              <template v-if="userRole && userMemberStatus === 'active'">
                <el-dropdown trigger="click" @command="handleCommand">
                  <el-button type="primary">工作室操作 ▾</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="manage" v-if="userRole === 'owner' || userRole === 'admin'">管理工作室</el-dropdown-item>
                      <el-dropdown-item command="edit" v-if="userRole === 'owner'">编辑信息</el-dropdown-item>
                      <el-dropdown-item command="viceOwner" v-if="userRole === 'owner'">设置副室长</el-dropdown-item>
                      <el-dropdown-item command="submit">投稿作品</el-dropdown-item>
                      <el-dropdown-item command="leave" divided v-if="userRole !== 'owner'">退出工作室</el-dropdown-item>
                      <el-dropdown-item command="dissolve" divided v-if="userRole === 'owner'">解散工作室</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
              <template v-else-if="userMemberStatus === 'pending'">
                <el-button disabled>申请审核中</el-button>
              </template>
              <template v-else>
                <el-tooltip v-if="joinBlockedReason" :content="joinBlockedReason" placement="top">
                  <span><el-button type="primary" disabled>不可加入</el-button></span>
                </el-tooltip>
                <el-button v-else type="primary" @click="handleJoin">{{ joinText }}</el-button>
              </template>
            </template>
            <template v-else>
              <el-button type="primary" @click="$router.push('/login')">登录后加入</el-button>
            </template>
          </div>
        </div>
      </div>
      
      <el-tabs v-model="activeTab" class="r-studio-detail--tabs">
        <el-tab-pane label="作品" name="works">
          <div class="r-studio-detail--works">
            <div class="r-studio-detail--work_grid" v-if="works.length > 0">
              <div v-for="studioWork in works" :key="studioWork.id" class="r-studio-detail--work_card">
                <div class="r-studio-detail--work_preview" :style="{ backgroundImage: `url(${studioWork.preview || defaultWorkCover})` }" @click="goWork(studioWork)">
                  <span class="r-studio-detail--work_ide" v-if="studioWork.ide_type">{{ getIdeTypeName(studioWork.ide_type) }}</span>
                </div>
                <div class="r-studio-detail--work_info">
                  <div class="r-studio-detail--work_title_row">
                    <h4 @click="goWork(studioWork)">{{ studioWork.name || '未知作品' }}</h4>
                    <el-dropdown v-if="canManageWork(studioWork)" trigger="click" @command="(cmd) => handleWorkAction(cmd, studioWork)">
                      <span class="r-studio-detail--work_more" @click.stop>•••</span>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item :command="studioWork.status === 'down' ? 'up' : 'down'">
                            {{ studioWork.status === 'down' ? '上架' : '下架' }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                  <div class="r-studio-detail--work_bottom">
                    <span class="r-studio-detail--work_author" @click.stop="goUser(studioWork.submitUser)">{{ studioWork.submitUser?.nickname || studioWork.submitUser?.username || '未知' }}</span>
                    <div class="r-studio-detail--work_stats">
                      <span>❤️ {{ formatNum(studioWork.praise_times) }}</span>
                      <span>👁️ {{ formatNum(studioWork.view_times) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <el-empty v-else description="暂无作品" />
            <el-pagination
              v-if="worksTotal > worksPageSize"
              v-model:current-page="worksPage"
              :page-size="worksPageSize"
              :total="worksTotal"
              layout="prev, pager, next"
              @current-change="fetchWorks"
              style="margin-top: 20px; justify-content: center;"
            />
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="成员" name="members">
          <div class="r-studio-detail--members">
            <div class="r-studio-detail--member_list">
              <div v-for="member in members" :key="member.id" class="r-studio-detail--member_item">
                <AppImage :src="member.user?.avatar || member.avatar || defaultAvatar" :fallback="defaultAvatar" class="r-studio-detail--member_avatar" />
                <div class="r-studio-detail--member_info">
                  <span class="r-studio-detail--member_name">{{ member.user?.nickname || member.user?.username || member.nickname || member.username }}</span>
                  <el-tag size="small" :type="member.memberRole === 'owner' ? 'danger' : member.memberRole === 'vice_owner' ? 'success' : member.memberRole === 'admin' ? 'warning' : 'info'">
                    {{ roleText(member.memberRole) }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    
    <el-dialog v-model="editDialogVisible" title="编辑工作室" width="500px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editForm.name" maxlength="50" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="editForm.description" type="textarea" :rows="3" maxlength="500" />
        </el-form-item>
        <el-form-item label="封面">
          <el-input v-model="editForm.cover" placeholder="封面图片URL" />
        </el-form-item>
        <el-form-item label="加入方式">
          <el-radio-group v-model="editForm.join_type">
            <el-radio label="free">自由加入</el-radio>
            <el-radio label="apply">申请加入</el-radio>
            <el-radio label="invite">仅限邀请</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEdit" :loading="editLoading">保存</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="viceOwnerDialogVisible" title="设置副室长" width="400px">
      <el-form :model="viceOwnerForm" label-width="80px">
        <el-form-item label="副室长">
          <el-select v-model="viceOwnerForm.user_id" clearable placeholder="选择副室长（可清空）" filterable style="width: 100%;">
            <el-option v-for="m in members.filter(m => m.memberRole !== 'owner')" :key="m.id" :label="m.user?.nickname || m.user?.username" :value="m.user_id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="viceOwnerDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSetViceOwner" :loading="viceOwnerLoading">保存</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="manageDialogVisible" title="工作室管理" width="800px">
      <el-tabs>
        <el-tab-pane label="成员申请">
          <el-table :data="pendingMembers" size="small">
            <el-table-column label="用户" min-width="150">
              <template #default="{ row }">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <AppImage :src="row.user?.avatar || defaultAvatar" :fallback="defaultAvatar" style="width: 32px; height: 32px; border-radius: 50%;" />
                  <span>{{ row.user?.nickname || row.user?.username }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="joined_at" label="申请时间" width="160">
              <template #default="{ row }">{{ formatDate(row.joined_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="handleReviewMember(row.id, 'approve')">通过</el-button>
                <el-button size="small" type="danger" @click="handleReviewMember(row.id, 'reject')">拒绝</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!pendingMembers.length" description="暂无待审核申请" />
        </el-tab-pane>
        
        <el-tab-pane label="作品审核">
          <el-table :data="pendingWorks" size="small">
            <el-table-column label="作品" min-width="200">
              <template #default="{ row }">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <img :src="row.work?.preview || defaultWorkCover" style="width: 48px; height: 36px; border-radius: 4px; object-fit: cover;" referrerpolicy="no-referrer" />
                  <div>
                    <div>{{ row.work?.name }}</div>
                    <div style="font-size: 12px; color: #999;">by {{ row.user?.nickname || row.user?.username }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="投稿时间" width="160">
              <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="handleReviewWork(row.id, 'approve')">通过</el-button>
                <el-button size="small" type="danger" @click="handleReviewWork(row.id, 'reject')">拒绝</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!pendingWorks.length" description="暂无待审核作品" />
        </el-tab-pane>
        
        <el-tab-pane label="成员管理">
          <el-table :data="activeMembers" size="small">
            <el-table-column label="成员" min-width="150">
              <template #default="{ row }">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <AppImage :src="row.avatar || defaultAvatar" :fallback="defaultAvatar" style="width: 32px; height: 32px; border-radius: 50%;" />
                  <span>{{ row.nickname || row.username }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="memberRole" label="角色" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="row.memberRole === 'owner' ? 'danger' : row.memberRole === 'vice_owner' ? 'success' : row.memberRole === 'admin' ? 'warning' : 'info'">
                  {{ roleText(row.memberRole) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <template v-if="row.memberRole !== 'owner'">
                  <el-button size="small" v-if="userRole === 'owner' && row.memberRole !== 'vice_owner'" @click="handleSetRole(row.id, row.memberRole === 'admin' ? 'member' : 'admin')">
                    {{ row.memberRole === 'admin' ? '设为成员' : '设为管理员' }}
                  </el-button>
                  <el-button size="small" type="danger" @click="handleKickMember(row.id)">移除</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
    
    <el-dialog v-model="submitWorkDialogVisible" title="投稿作品" width="600px">
      <div class="r-studio-detail--my_works" v-loading="myWorksLoading">
        <template v-if="myWorks.length > 0">
          <div v-for="work in myWorks" :key="work.id" class="r-studio-detail--my_work_item" @click="handleSubmitWork(work.codemao_work_id)">
            <img :src="work.preview || defaultWorkCover" referrerpolicy="no-referrer" />
            <div class="r-studio-detail--my_work_name">{{ work.name }}</div>
          </div>
        </template>
        <!-- 修复: empty 状态居中显示(不被 grid 挤到左边) -->
        <div v-else class="r-studio-detail--empty_wrap">
          <el-empty description="您还没有发布作品">
            <el-button type="primary" @click="$router.push('/publish')">去发布作品</el-button>
          </el-empty>
        </div>
      </div>
    </el-dialog>
    
    <GeetestDialog ref="geetestDialog" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { studioApi } from '@/api/studio'
import { workApi } from '@/api/work'
import { ElMessage, ElMessageBox } from 'element-plus'
import GeetestDialog from '@/components/GeetestDialog.vue'
import { useGeetestConfig } from '@/composables/useGeetestConfig'
import AppImage from '@/components/AppImage.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const studio = ref(null)
const members = ref([])
const works = ref([])
const userRole = ref(null)
const userMemberStatus = ref(null)
const joinBlockedReason = ref(null)

const activeTab = ref('works')
const worksPage = ref(1)
const worksPageSize = ref(12)
const worksTotal = ref(0)

const editDialogVisible = ref(false)
const editLoading = ref(false)
const defaultStudioCover = (studio) => {
  const seed = Math.abs((Number(studio?.id || 0) * 2654435761) ^ String(studio?.name || '').length)
  const colors = [['#ff9a9e','#fad0c4'],['#a18cd1','#fbc2eb'],['#84fab0','#8fd3f4'],['#f6d365','#fda085'],['#5ee7df','#b490ca']]
  const pair = colors[seed % colors.length]; const initial = (studio?.name || 'S').charAt(0).toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 220"><defs><linearGradient id="g"><stop stop-color="${pair[0]}"/><stop offset="1" stop-color="${pair[1]}"/></linearGradient></defs><rect width="640" height="220" fill="url(#g)"/><circle cx="550" cy="20" r="130" fill="#fff" opacity=".14"/><text x="40" y="140" fill="#fff" font-size="82" font-family="sans-serif" font-weight="700">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const editForm = reactive({ name: '', description: '', cover: '', join_type: 'apply' })

const viceOwnerDialogVisible = ref(false)
const viceOwnerLoading = ref(false)
const viceOwnerForm = reactive({ user_id: null })

const manageDialogVisible = ref(false)
const pendingMembers = ref([])
const pendingWorks = ref([])

const submitWorkDialogVisible = ref(false)
const myWorks = ref([])
const myWorksLoading = ref(false)
const geetestDialog = ref(null)
const { geetestEnabled, fetchGeetestConfig } = useGeetestConfig()

// 默认封面已改为模板中动态渲染首字艺术字
const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzk5OSIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzLTN6bTAgMTQuMmMtMi41IDAtNC43MS0xLjI4LTYtMy4yMi4wMy0xLjk5IDQtMy4wOCA2LTMuMDggMS45OSAwIDUuOTcgMS4wOSA2IDMuMDgtMS4yOSAxLjk0LTMuNSAzLjIyLTYgMy4yMnoiLz48L3N2Zz4='
const defaultWorkCover = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2NjYyIgZD0iTTE5IDNINWMtMS4xIDAtMiAuOS0yIDJ2MTRjMCAxLjEuOSAyIDIgMmgxNGMxLjEgMCAyLS45IDItMlY1YzAtMS4xLS45LTItMi0yem0wIDE2SDVWNWgxNHYxNHptLTctMmgydi00aDR2LTJoLTRWN2gtMnY0SDd2Mmg0djR6Ii8+PC9zdmc+'

const joinText = computed(() => {
  if (!studio.value) return '加入'
  // 统一使用 free/apply/invite，兼容历史 public 数据
  const map = { free: '加入工作室', public: '加入工作室', apply: '申请加入', invite: '仅限邀请' }
  return map[studio.value.join_type] || '加入'
})

const activeMembers = computed(() => members.value)

const roleText = (role) => {
  const map = { owner: '创建者', vice_owner: '副室长', admin: '管理员', member: '成员' }
  return map[role] || ''
}

const formatNum = (n) => {
  if (!n) return '0'
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

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

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

const goWork = (work) => {
  if (!work) return
  if (work.codemao_work_id) {
    router.push(`/work/${work.codemao_work_id}`)
  } else {
    router.push(`/work/${work.id}`)
  }
}

const goUser = (user) => {
  if (!user) return
  if (user.codemao_user_id) {
    router.push(`/user/${user.codemao_user_id}`)
  } else if (user.id) {
    router.push(`/user/${user.id}`)
  }
}

const fetchStudio = async () => {
  loading.value = true
  try {
    const res = await studioApi.getStudio(route.params.id)
    if (res.code === 200) {
      studio.value = res.data.studio
      members.value = res.data.members
      works.value = res.data.works
      worksTotal.value = res.data.works?.length || 0
      userRole.value = res.data.userRole
      userMemberStatus.value = res.data.userMemberStatus
      joinBlockedReason.value = res.data.joinBlockedReason || null
    } else {
      ElMessage.error(res.msg || '获取工作室失败')
    }
  } catch (e) {
    ElMessage.error('获取工作室失败')
  }
  loading.value = false
}

// 切换不同工作室时重置状态，避免上一个工作室的残留数据短暂闪现
const resetState = () => {
  studio.value = null
  members.value = []
  works.value = []
  worksTotal.value = 0
  userRole.value = null
  userMemberStatus.value = null
  activeTab.value = 'works'
  worksPage.value = 1
}

// 监听路由参数变化（在不同工作室间跳转时重新加载数据）
watch(() => route.params.id, (newId) => {
  if (newId) {
    resetState()
    fetchStudio()
  }
})

const fetchWorks = async () => {
  try {
    const res = await studioApi.getStudioWorks(route.params.id, { page: worksPage.value, pageSize: worksPageSize.value })
    if (res.code === 200) {
      works.value = res.data.list
      worksTotal.value = res.data.total
    }
  } catch (e) { ElMessage.error('加载作品失败') }
}

const canManageWork = (studioWork) => {
  if (!userStore.user) return false
  if (userRole.value === 'owner') return true
  if (userRole.value === 'admin' && studioWork.submitUser?.id === userStore.user.id) return true
  return false
}

const handleWorkAction = (action, studioWork) => {
  if (action === 'up' || action === 'down') {
    toggleWorkStatus(studioWork, action)
  }
}

const toggleWorkStatus = async (studioWork, action) => {
  try {
    const res = await studioApi.toggleWorkStatus(route.params.id, studioWork.id, action)
    if (res.code === 200) {
      studioWork.status = action === 'up' ? 'approved' : 'down'
      ElMessage.success(res.msg)
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const handleJoin = async () => {
  if (studio.value.join_type === 'invite') {
    ElMessage.warning('该工作室仅限邀请加入')
    return
  }
  const geetestData = await geetestDialog.value?.show('join_studio')
  if (!geetestData) return
  try {
    const res = await studioApi.joinStudio(route.params.id, geetestData)
    if (res.code === 200) {
      ElMessage.success(res.msg)
      fetchStudio()
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const handleLeave = async () => {
  try {
    await ElMessageBox.confirm('确定退出该工作室吗？', '提示', { type: 'warning' })
    const res = await studioApi.leaveStudio(route.params.id)
    if (res.code === 200) {
      ElMessage.success('已退出工作室')
      fetchStudio()
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) { if (e !== 'cancel') ElMessage.error('操作失败') }
}

const showEditDialog = () => {
  editForm.name = studio.value.name
  editForm.description = studio.value.description || ''
  editForm.cover = studio.value.cover || ''
  editForm.join_type = studio.value.join_type
  editDialogVisible.value = true
}

const handleEdit = async () => {
  editLoading.value = true
  try {
    const res = await studioApi.updateStudio(route.params.id, editForm)
    if (res.code === 200) {
      ElMessage.success('保存成功')
      editDialogVisible.value = false
      fetchStudio()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
  editLoading.value = false
}

const showManageDialog = async () => {
  manageDialogVisible.value = true
  try {
    const [membersRes, worksRes] = await Promise.all([
      studioApi.getPendingMembers(route.params.id),
      studioApi.getPendingWorks(route.params.id)
    ])
    if (membersRes.code === 200) pendingMembers.value = membersRes.data
    if (worksRes.code === 200) pendingWorks.value = worksRes.data
  } catch (e) { ElMessage.error('加载管理数据失败') }
}

const showViceOwnerDialog = () => {
  viceOwnerForm.user_id = studio.value.vice_owner_id || null
  viceOwnerDialogVisible.value = true
}

const handleSetViceOwner = async () => {
  viceOwnerLoading.value = true
  try {
    const res = await studioApi.setViceOwner(route.params.id, viceOwnerForm.user_id)
    if (res.code === 200) {
      ElMessage.success('副室长已设置')
      viceOwnerDialogVisible.value = false
      fetchStudio()
    } else {
      ElMessage.error(res.msg || '设置失败')
    }
  } catch (e) {
    ElMessage.error('设置失败')
  } finally {
    viceOwnerLoading.value = false
  }
}

const handleDissolve = async () => {
  try {
    await ElMessageBox.confirm('确定解散该工作室吗？此操作不可恢复！', '警告', { type: 'warning', confirmButtonText: '确定解散', cancelButtonText: '取消' })
    const res = await studioApi.dissolveStudio(route.params.id)
    if (res.code === 200) {
      ElMessage.success('工作室已解散')
      // 修复：工作室列表路由为 /work_shop，原 /studios 路由不存在会触发 NotFound 重定向
      router.push('/work_shop')
    } else {
      ElMessage.error(res.msg || '解散失败')
    }
  } catch (e) { if (e !== 'cancel') ElMessage.error('操作失败') }
}

const handleCommand = (command) => {
  switch (command) {
    case 'manage': showManageDialog(); break
    case 'edit': showEditDialog(); break
    case 'viceOwner': showViceOwnerDialog(); break
    case 'submit': showSubmitWorkDialog(); break
    case 'leave': handleLeave(); break
    case 'dissolve': handleDissolve(); break
  }
}

const handleReviewMember = async (memberId, action) => {
  let geetestData = {}
  if (geetestEnabled('review_member')) {
    geetestData = await geetestDialog.value?.show('review_member')
    if (!geetestData) return
  }
  try {
    const res = await studioApi.reviewMember(route.params.id, memberId, action, geetestData)
    if (res.code === 200) {
      ElMessage.success(res.msg)
      showManageDialog()
      fetchStudio()
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const handleReviewWork = async (workId, action) => {
  try {
    const res = await studioApi.reviewWork(route.params.id, workId, action)
    if (res.code === 200) {
      ElMessage.success(res.msg)
      showManageDialog()
      fetchStudio()
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const handleSetRole = async (memberId, role) => {
  try {
    const res = await studioApi.setMemberRole(route.params.id, memberId, role)
    if (res.code === 200) {
      ElMessage.success('角色已更新')
      fetchStudio()
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const handleKickMember = async (memberId) => {
  try {
    await ElMessageBox.confirm('确定移除该成员吗？', '提示', { type: 'warning' })
    const res = await studioApi.kickMember(route.params.id, memberId)
    if (res.code === 200) {
      ElMessage.success('成员已移除')
      fetchStudio()
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) { if (e !== 'cancel') ElMessage.error('操作失败') }
}

const showSubmitWorkDialog = async () => {
  submitWorkDialogVisible.value = true
  myWorksLoading.value = true
  try {
    const res = await workApi.getMyWorks()
    if (res.code === 200) {
      myWorks.value = res.data.list || res.data || []
    }
  } catch (e) { ElMessage.error('加载作品列表失败') }
  myWorksLoading.value = false
}

const handleSubmitWork = async (workId) => {
  const geetestData = await geetestDialog.value?.show('submit_work')
  if (!geetestData) return
  try {
    const res = await studioApi.submitWork(route.params.id, workId, geetestData)
    if (res.code === 200) {
      ElMessage.success(res.msg)
      submitWorkDialogVisible.value = false
    } else {
      ElMessage.error(res.msg || '投稿失败')
    }
  } catch (e) {
    ElMessage.error('投稿失败')
  }
}

onMounted(fetchStudio)
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$primary-hover: #FFD700;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;
$white: #fff;
$border-color: #eee;

.r-studio-detail--page {
  padding: 24px;
  min-height: calc(100vh - 60px);
  background: #f5f5f5;
}

.r-studio-detail--container {
  max-width: 1200px;
  margin: 0 auto;
}

.r-studio-detail--header {
  display: flex;
  gap: 20px;
  background: $white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  
  .r-studio-detail--cover {
    width: 160px;
    height: 100px;
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    background-color: #6978dc;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;

    .r-studio-detail--cover_placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;

      .r-studio-detail--cover_initial {
        font-size: 42px;
        font-weight: 700;
        color: rgba(255,255,255,0.9);
        text-shadow: 0 2px 8px rgba(0,0,0,0.2);
        font-family: 'Georgia', 'Times New Roman', serif;
        user-select: none;
      }
    }
  }
  
  .r-studio-detail--info {
    flex: 1;
    min-width: 0;
    
    .r-studio-detail--title_row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    
    .r-studio-detail--name {
      font-size: 20px;
      font-weight: 600;
      color: $text-color;
      margin: 0;
    }
    
    .r-studio-detail--level {
      padding: 2px 10px;
      background: linear-gradient(135deg, $primary-color, $primary-hover);
      color: $text-color;
      font-size: 12px;
      font-weight: 600;
      border-radius: 10px;
    }
    
    .r-studio-detail--desc {
      font-size: 13px;
      color: $text-secondary;
      margin: 0 0 10px;
      line-height: 1.5;
    }
    
    .r-studio-detail--stats {
      display: flex;
      gap: 20px;
      margin-bottom: 12px;
      
      span {
        font-size: 13px;
        color: $text-muted;
        
        i {
          font-style: normal;
          margin-right: 4px;
        }
      }
    }
    
    .r-studio-detail--actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      
      .el-button {
        border-radius: 6px;
        margin: 0;
      }
    }
  }
}

.r-studio-detail--tabs {
  background: $white;
  border-radius: 12px;
  padding: 24px;
}

.r-studio-detail--works {
  min-height: 200px;
}

.r-studio-detail--work_grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  
  @media (max-width: 1200px) { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
}

.r-studio-detail--work_card {
  background: $white;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid #eee;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.1);
    border-color: $primary-color;
  }
  
  .r-studio-detail--work_preview {
    width: 100%;
    padding-top: 100%;
    background-size: cover;
    background-position: center;
    position: relative;
    
    .r-studio-detail--work_ide {
      position: absolute;
      top: 6px;
      right: 6px;
      padding: 1px 6px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-size: 10px;
      border-radius: 3px;
    }
  }
  
  .r-studio-detail--work_info {
    padding: 8px;
    
    .r-studio-detail--work_title_row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      
      h4 {
        flex: 1;
        font-size: 12px;
        font-weight: 500;
        color: $text-color;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.2;
        
        &:hover {
          color: $primary-color;
        }
      }
      
      .r-studio-detail--work_more {
        padding: 0 4px;
        color: $text-muted;
        cursor: pointer;
        font-size: 10px;
        letter-spacing: 1px;
        flex-shrink: 0;
        
        &:hover {
          color: $primary-color;
        }
      }
    }
    
    .r-studio-detail--work_bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .r-studio-detail--work_author {
        font-size: 10px;
        color: $text-muted;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 60%;
        cursor: pointer;
        
        &:hover {
          color: $primary-color;
          text-decoration: underline;
        }
      }
      
      .r-studio-detail--work_stats {
        display: flex;
        gap: 6px;
        font-size: 10px;
        color: $text-muted;
        flex-shrink: 0;
      }
    }
  }
}

.r-studio-detail--members {
  min-height: 200px;
}

.r-studio-detail--member_list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.r-studio-detail--member_item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f9f9f9;
  border-radius: 8px;
  min-width: 180px;
  
  .r-studio-detail--member_avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .r-studio-detail--member_info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    
    .r-studio-detail--member_name {
      font-size: 14px;
      color: $text-color;
    }
  }
}

.r-studio-detail--my_works {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  min-height: 200px;
}

// 投稿作品弹窗:empty 状态居中
.r-studio-detail--empty_wrap {
  grid-column: 1 / -1;  // 占满所有列
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.r-studio-detail--my_work_item {
  display: flex;
  flex-direction: column;
  border: 1px solid $border-color;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: $primary-color;
  }
  
  img {
    width: 100%;
    height: 80px;
    object-fit: cover;
  }
  
  .r-studio-detail--my_work_name {
    padding: 8px;
    font-size: 13px;
    color: $text-color;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

:deep(.el-table) {
  .el-button + .el-button {
    margin-left: 8px;
  }
}

/* 工作室详情：开放式资料头 + 单一内容工作区 */
.r-studio-detail--page { position:relative; overflow:hidden; padding:34px 24px 80px; background:radial-gradient(circle at 8% 6%,rgba(255,205,92,.31),transparent 28rem),radial-gradient(circle at 92% 13%,rgba(108,190,255,.25),transparent 32rem),linear-gradient(145deg,#f5f8ff 0%,#fafbff 50%,#fff8eb 100%); }
.r-studio-detail--page::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.5; background-image:linear-gradient(rgba(95,125,170,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(95,125,170,.055) 1px,transparent 1px); background-size:44px 44px; mask-image:linear-gradient(to bottom,#000,transparent 82%); }
.r-studio-detail--container { position:relative; z-index:1; max-width:1220px; }
.r-studio-detail--header { position:relative; gap:28px; align-items:center; margin-bottom:20px; padding:28px; border:1px solid rgba(255,255,255,.94); border-radius:22px; background:linear-gradient(135deg,rgba(255,250,235,.9),rgba(255,255,255,.78) 48%,rgba(239,248,255,.88)); backdrop-filter:blur(18px); box-shadow:0 20px 55px rgba(39,55,82,.09); }
.r-studio-detail--header .r-studio-detail--cover { width:230px; height:142px; border-radius:16px; box-shadow:0 14px 32px rgba(35,48,70,.16); }
.r-studio-detail--header .r-studio-detail--info .r-studio-detail--title_row { margin-bottom:10px; }
.r-studio-detail--header .r-studio-detail--info .r-studio-detail--name { color:#172033; font-size:clamp(28px,3vw,38px); line-height:1.12; letter-spacing:-.04em; font-weight:800; }
.r-studio-detail--header .r-studio-detail--info .r-studio-detail--level { padding:4px 9px; border-radius:7px; }
.r-studio-detail--header .r-studio-detail--info .r-studio-detail--desc { max-width:680px; margin-bottom:15px; color:#667085; font-size:14px; }
.r-studio-detail--header .r-studio-detail--info .r-studio-detail--stats { gap:10px; flex-wrap:wrap; margin-bottom:18px; }
.r-studio-detail--header .r-studio-detail--info .r-studio-detail--stats span { padding:7px 10px; border:1px solid rgba(222,227,235,.78); border-radius:9px; background:rgba(255,255,255,.62); color:#5f6b7d; font-weight:600; }
.r-studio-detail--header .r-studio-detail--info .r-studio-detail--actions .el-button { height:40px; padding:0 17px; border-radius:11px!important; font-weight:700; }
.r-studio-detail--tabs { padding:0 24px 28px; border:1px solid rgba(255,255,255,.94); border-radius:20px; background:rgba(255,255,255,.8); backdrop-filter:blur(18px); box-shadow:0 20px 55px rgba(39,55,82,.08); }
.r-studio-detail--tabs :deep(.el-tabs__header) { margin:0 0 24px; }
.r-studio-detail--tabs :deep(.el-tabs__nav-wrap::after) { height:1px; background:#edf0f5; }
.r-studio-detail--tabs :deep(.el-tabs__item) { height:62px; padding:0 22px; color:#667085; font-size:15px; font-weight:700; }
.r-studio-detail--tabs :deep(.el-tabs__item.is-active) { color:#172033; }
.r-studio-detail--tabs :deep(.el-tabs__active-bar) { height:3px; border-radius:3px; background:#fec433; }
.r-studio-detail--work_grid { grid-template-columns:repeat(5,1fr); gap:18px; }
.r-studio-detail--work_card { border:1px solid #e8ecf2; border-radius:15px; box-shadow:0 7px 22px rgba(39,55,82,.055); }
.r-studio-detail--work_card:hover { transform:translateY(-5px); border-color:transparent; box-shadow:0 17px 36px rgba(39,55,82,.13); }
.r-studio-detail--work_card .r-studio-detail--work_preview .r-studio-detail--work_ide { top:8px; right:8px; padding:3px 7px; border-radius:6px; backdrop-filter:blur(8px); }
.r-studio-detail--work_card .r-studio-detail--work_info { padding:12px; }
.r-studio-detail--work_card .r-studio-detail--work_info .r-studio-detail--work_title_row h4 { color:#1b2436; font-size:13px; font-weight:700; }
.r-studio-detail--member_list { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.r-studio-detail--member_item { min-width:0; padding:14px; border:1px solid #e8ecf2; border-radius:14px; background:linear-gradient(145deg,#fff,#f8faff); box-shadow:0 6px 20px rgba(39,55,82,.045); }
.r-studio-detail--member_item .r-studio-detail--member_avatar { box-shadow:0 0 0 3px #fff,0 5px 13px rgba(35,48,70,.12); }
.r-studio-detail--my_work_item { border-color:#e5eaf1; border-radius:14px; }
.r-studio-detail--my_work_item:hover { transform:translateY(-3px); box-shadow:0 10px 24px rgba(39,55,82,.1); }
:deep(.el-dialog) { border-radius:20px!important; }
:deep(.el-dialog__header) { padding:22px 24px 16px; }
:deep(.el-dialog__body) { padding:20px 24px; }
@media(max-width:800px){.r-studio-detail--page{padding:20px 14px 56px}.r-studio-detail--header{align-items:flex-start;flex-direction:column;padding:20px}.r-studio-detail--header .r-studio-detail--cover{width:100%;height:auto;aspect-ratio:16/7}.r-studio-detail--header .r-studio-detail--info .r-studio-detail--stats{gap:7px}.r-studio-detail--tabs{padding:0 14px 20px}.r-studio-detail--member_list{grid-template-columns:repeat(2,1fr)}}
</style>
