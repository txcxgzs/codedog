<template>
  <div class="r-admin-banners--page">
    <!-- 工具栏 -->
    <div class="r-admin-banners--toolbar">
      <el-button type="primary" @click="openDialog()">添加轮播图</el-button>
    </div>
    
    <!-- 列表 -->
    <el-table :data="banners" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="图片" width="200">
        <template #default="{ row }">
          <img :src="row.image_url" class="r-admin-banners--image" />
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column prop="link_url" label="链接" min-width="200" />
      <el-table-column prop="sort" label="排序" width="80" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'">
            {{ row.is_active ? '显示' : '隐藏' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteBanner(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editForm.id ? '编辑轮播图' : '添加轮播图'" width="500px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="图片URL">
          <el-input v-model="editForm.image_url" placeholder="输入图片URL" />
        </el-form-item>
        <el-form-item label="链接">
          <el-input v-model="editForm.link_url" placeholder="点击跳转链接" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editForm.sort" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.is_active">
            <el-option label="显示" :value="true" />
            <el-option label="隐藏" :value="false" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveBanner">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const banners = ref([])
const dialogVisible = ref(false)
const editForm = ref({
  title: '',
  image_url: '',
  link_url: '',
  sort: 0,
  is_active: true
})

const fetchBanners = async () => {
  loading.value = true
  try {
    const res = await adminApi.getBanners()
    if (res.code === 200) {
      banners.value = res.data
    }
  } catch (e) {
    console.error('获取轮播图失败:', e)
  } finally {
    loading.value = false
  }
}

const openDialog = (banner = null) => {
  if (banner) {
    editForm.value = { ...banner }
  } else {
    editForm.value = {
      title: '',
      image_url: '',
      link_url: '',
      sort: 0,
      is_active: true
    }
  }
  dialogVisible.value = true
}

const saveBanner = async () => {
  try {
    let res
    if (editForm.value.id) {
      res = await adminApi.updateBanner(editForm.value.id, editForm.value)
    } else {
      res = await adminApi.createBanner(editForm.value)
    }
    if (res.code === 200) {
      ElMessage.success('保存成功')
      dialogVisible.value = false
      fetchBanners()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const deleteBanner = async (banner) => {
  try {
    await ElMessageBox.confirm('确定要删除该轮播图吗？', '提示', { type: 'warning' })
    const res = await adminApi.deleteBanner(banner.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      fetchBanners()
    } else {
      ElMessage.error(res.msg || '删除失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(fetchBanners)
</script>

<style lang="scss" scoped>
.r-admin-banners--page {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}

.r-admin-banners--toolbar {
  margin-bottom: 20px;
}

.r-admin-banners--image {
  width: 160px;
  height: 90px;
  object-fit: cover;
  border-radius: 4px;
}
</style>
