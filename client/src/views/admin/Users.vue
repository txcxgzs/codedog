<template>
  <div class="r-admin-users--page">
    <!-- 搜索栏 -->
    <div class="r-admin-users--toolbar">
      <el-input 
        v-model="searchKeyword" 
        placeholder="搜索用户名/昵称/邮箱"
        clearable
        class="r-admin-users--search"
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>
      <el-button type="primary" @click="fetchUsers">刷新</el-button>
    </div>
    
    <!-- 用户列表 -->
    <el-table :data="users" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="头像" width="80">
        <template #default="{ row }">
          <img :src="row.avatar || defaultAvatar" class="r-admin-users--avatar" />
        </template>
      </el-table-column>
      <el-table-column prop="username" label="用户名" width="150" />
      <el-table-column prop="nickname" label="昵称" width="150" />
      <el-table-column prop="email" label="邮箱" min-width="200" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'danger' : 'info'">
            {{ row.role === 'admin' ? '管理员' : '用户' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
            {{ row.status === 'active' ? '正常' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="活跃大佬" width="100">
        <template #default="{ row }">
          <el-switch
            v-model="row.is_active_dalao"
            size="small"
            @change="(val) => handleToggleActiveDalao(row, val)"
          />
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="editUser(row)">编辑</el-button>
          <el-button 
            size="small" 
            :type="row.status === 'active' ? 'danger' : 'success'"
            @click="toggleStatus(row)"
          >
            {{ row.status === 'active' ? '禁用' : '启用' }}
          </el-button>
          <el-button size="small" type="warning" @click="impersonateUser(row)">一键登录</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <!-- 分页 -->
    <div class="r-admin-users--pagination">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="fetchUsers"
      />
    </div>
    
    <!-- 编辑对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑用户" width="500px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="用户名">
          <el-input :value="editForm.username" disabled />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="editForm.nickname" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="editForm.role">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
            <el-option label="超级管理员" value="superadmin" />
          </el-select>
        </el-form-item>
        <el-form-item label="活跃大佬">
          <el-switch v-model="editForm.is_active_dalao" active-text="显示在首页活跃大佬专区" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const users = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchKeyword = ref('')
const editDialogVisible = ref(false)
const editForm = ref({})

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const formatTime = (time) => {
  if (!time) return '-'
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fetchUsers = async () => {
  loading.value = true
  try {
    const res = await adminApi.getUsers({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value
    })
    if (res.code === 200) {
      users.value = res.data.list
      total.value = res.data.total
    }
  } catch (e) {
    console.error('获取用户失败:', e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchUsers()
}

const handleToggleActiveDalao = async (user, val) => {
  try {
    const res = await adminApi.updateUser(user.id, { is_active_dalao: val })
    if (res.code === 200) {
      ElMessage.success(val ? '已设为活跃大佬' : '已取消活跃大佬')
    } else {
      user.is_active_dalao = !val
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) {
    user.is_active_dalao = !val
    ElMessage.error('操作失败')
  }
}

const editUser = (user) => {
  editForm.value = { ...user }
  editDialogVisible.value = true
}

const saveUser = async () => {
  try {
    const res = await adminApi.updateUser(editForm.value.id, {
      nickname: editForm.value.nickname,
      email: editForm.value.email,
      role: editForm.value.role,
      is_active_dalao: editForm.value.is_active_dalao
    })
    if (res.code === 200) {
      ElMessage.success('保存成功')
      editDialogVisible.value = false
      fetchUsers()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const toggleStatus = async (user) => {
  const action = user.status === 'active' ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}该用户吗？`, '提示', { type: 'warning' })
    const res = await adminApi.updateUser(user.id, {
      status: user.status === 'active' ? 'disabled' : 'active'
    })
    if (res.code === 200) {
      ElMessage.success(`${action}成功`)
      fetchUsers()
    } else {
      ElMessage.error(res.msg || `${action}失败`)
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(`${action}失败`)
    }
  }
}

const impersonateUser = async (user) => {
  try {
    await ElMessageBox.confirm(`确定要以 ${user.nickname || user.username} 的身份登录吗？该操作将生成一个临时登录 Token。`, '一键登录', { type: 'warning' })
    const res = await adminApi.impersonateUser(user.id)
    if (res.code === 200) {
      // 保存 Token 并刷新页面实现真实登录
      localStorage.setItem('token', res.data.token)
      ElMessage.success(`正在以 ${user.nickname || user.username} 身份登录...`)
      
      // 强制刷新页面以更新所有状态
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    } else {
      ElMessage.error(res.msg || '一键登录失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

onMounted(fetchUsers)
</script>

<style lang="scss" scoped>
.r-admin-users--page {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}

.r-admin-users--toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  
  .r-admin-users--search {
    width: 300px;
  }
}

.r-admin-users--avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.r-admin-users--pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
