<template>
  <div class="r-admin--page">
    <div class="r-admin--container">
      <!-- 侧边栏 -->
      <aside class="r-admin--sidebar">
        <div class="r-admin--logo">
          <span class="r-admin--logo_icon">🐕</span>
          <span class="r-admin--logo_text">后台管理</span>
        </div>
        <el-menu :default-active="activeMenu" @select="handleMenuSelect">
          <el-menu-item index="dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>数据大屏</span>
          </el-menu-item>
          <el-menu-item index="users">
            <el-icon><User /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
          <el-menu-item index="works">
            <el-icon><Document /></el-icon>
            <span>作品管理</span>
          </el-menu-item>
          <el-menu-item index="comments">
            <el-icon><ChatDotRound /></el-icon>
            <span>评论管理</span>
          </el-menu-item>
          <el-menu-item index="posts">
            <el-icon><Postcard /></el-icon>
            <span>帖子管理</span>
          </el-menu-item>
          <el-menu-item index="reports">
            <el-icon><Warning /></el-icon>
            <span>举报管理</span>
          </el-menu-item>
          <el-menu-item index="studios" v-if="['admin', 'superadmin'].includes(userStore.user?.role)">
            <el-icon><OfficeBuilding /></el-icon>
            <span>工作室管理</span>
          </el-menu-item>
          <el-menu-item index="roles" v-if="userStore.user?.role === 'superadmin'">
            <el-icon><UserFilled /></el-icon>
            <span>角色管理</span>
          </el-menu-item>
          <el-menu-item index="permissions" v-if="userStore.user?.role === 'superadmin'">
            <el-icon><Key /></el-icon>
            <span>权限设置</span>
          </el-menu-item>
          <el-menu-item index="banners">
            <el-icon><Picture /></el-icon>
            <span>轮播图管理</span>
          </el-menu-item>
          <el-menu-item index="ipbans">
            <el-icon><Lock /></el-icon>
            <span>IP封禁</span>
          </el-menu-item>
          <el-menu-item index="announcements" v-if="['admin', 'superadmin'].includes(userStore.user?.role)">
            <el-icon><Bell /></el-icon>
            <span>公告管理</span>
          </el-menu-item>
          <el-menu-item index="sensitive" v-if="['admin', 'superadmin'].includes(userStore.user?.role)">
            <el-icon><Filter /></el-icon>
            <span>敏感词管理</span>
          </el-menu-item>
          <el-menu-item index="configs" v-if="['admin', 'superadmin'].includes(userStore.user?.role)">
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </el-menu-item>
          <el-menu-item index="logs" v-if="['admin', 'superadmin'].includes(userStore.user?.role)">
            <el-icon><List /></el-icon>
            <span>操作日志</span>
          </el-menu-item>
          <el-menu-item index="realtime-logs" v-if="['admin', 'superadmin'].includes(userStore.user?.role)">
            <el-icon><Monitor /></el-icon>
            <span>实时日志</span>
          </el-menu-item>
          <el-menu-item index="security" v-if="['admin', 'superadmin'].includes(userStore.user?.role)">
            <el-icon><Lock /></el-icon>
            <span>安全验证</span>
          </el-menu-item>
          <el-menu-item index="crawl">
            <el-icon><Download /></el-icon>
            <span>作品爬取</span>
          </el-menu-item>
        </el-menu>
      </aside>
      
      <!-- 主内容 -->
      <main class="r-admin--main">
        <!-- 数据大屏 -->
        <div v-if="activeMenu === 'dashboard'" class="r-admin--section">
          <h2 class="r-admin--title">数据大屏</h2>
          <div class="r-admin--stats" v-loading="loadingStats">
            <div class="r-admin--stat_card">
              <div class="r-admin--stat_icon r-admin--stat_icon_users"></div>
              <div class="r-admin--stat_info">
                <span class="r-admin--stat_num">{{ stats.userCount }}</span>
                <span class="r-admin--stat_label">总用户数</span>
                <span class="r-admin--stat_sub">今日+{{ stats.todayUsers }}</span>
              </div>
            </div>
            <div class="r-admin--stat_card">
              <div class="r-admin--stat_icon r-admin--stat_icon_works"></div>
              <div class="r-admin--stat_info">
                <span class="r-admin--stat_num">{{ stats.workCount }}</span>
                <span class="r-admin--stat_label">总作品数</span>
                <span class="r-admin--stat_sub">今日+{{ stats.todayWorks }}</span>
              </div>
            </div>
            <div class="r-admin--stat_card">
              <div class="r-admin--stat_icon r-admin--stat_icon_comments"></div>
              <div class="r-admin--stat_info">
                <span class="r-admin--stat_num">{{ stats.commentCount }}</span>
                <span class="r-admin--stat_label">总评论数</span>
                <span class="r-admin--stat_sub">今日+{{ stats.todayComments }}</span>
              </div>
            </div>
            <div class="r-admin--stat_card">
              <div class="r-admin--stat_icon r-admin--stat_icon_reports"></div>
              <div class="r-admin--stat_info">
                <span class="r-admin--stat_num">{{ stats.pendingReports }}</span>
                <span class="r-admin--stat_label">待处理举报</span>
              </div>
            </div>
            <div class="r-admin--stat_card">
              <div class="r-admin--stat_icon r-admin--stat_icon_featured"></div>
              <div class="r-admin--stat_info">
                <span class="r-admin--stat_num">{{ stats.featuredWorks }}</span>
                <span class="r-admin--stat_label">精选作品</span>
              </div>
            </div>
            <div class="r-admin--stat_card">
              <div class="r-admin--stat_icon r-admin--stat_icon_disabled"></div>
              <div class="r-admin--stat_info">
                <span class="r-admin--stat_num">{{ stats.disabledUsers }}</span>
                <span class="r-admin--stat_label">禁用用户</span>
              </div>
            </div>
            <div class="r-admin--stat_card">
              <div class="r-admin--stat_icon r-admin--stat_icon_week"></div>
              <div class="r-admin--stat_info">
                <span class="r-admin--stat_num">{{ stats.newUsersWeek }}</span>
                <span class="r-admin--stat_label">本周新增用户</span>
              </div>
            </div>
            <div class="r-admin--stat_card">
              <div class="r-admin--stat_icon r-admin--stat_icon_ipban"></div>
              <div class="r-admin--stat_info">
                <span class="r-admin--stat_num">{{ stats.activeIpBans }}</span>
                <span class="r-admin--stat_label">封禁IP数</span>
              </div>
            </div>
          </div>
          
          <!-- 趋势图表 -->
          <div class="r-admin--chart_section">
            <h3>近7天数据趋势</h3>
            <div class="r-admin--chart" ref="chartRef"></div>
          </div>
        </div>
        
        <!-- 用户管理 -->
        <div v-if="activeMenu === 'users'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">用户管理</h2>
            <div class="r-admin--filters">
              <el-input v-model="userSearch" placeholder="搜索用户名/昵称/邮箱/编程猫ID" style="width: 220px" @keyup.enter="searchUsers" clearable>
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
              <el-select v-model="userRoleFilter" placeholder="角色" style="width: 120px" clearable @change="searchUsers">
                <el-option label="全部" value="" />
                <el-option label="超级管理员" value="superadmin" />
                <el-option label="管理员" value="admin" />
                <el-option label="版主" value="moderator" />
                <el-option label="审核员" value="reviewer" />
                <el-option label="用户" value="user" />
              </el-select>
              <el-select v-model="userStatusFilter" placeholder="状态" style="width: 100px" clearable @change="searchUsers">
                <el-option label="全部" value="" />
                <el-option label="正常" value="active" />
                <el-option label="禁用" value="banned" />
              </el-select>
              <el-button type="primary" @click="searchUsers">搜索</el-button>
              <el-button type="warning" @click="showBatchNotificationDialog">批量发信</el-button>
            </div>
          </div>
          <el-table :data="users" v-loading="loadingUsers" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="codemao_user_id" label="编程猫ID" width="100" />
            <el-table-column label="用户信息" min-width="150">
              <template #default="{ row }">
                <div class="r-admin--user_cell" @click="showUserDetail(row)" style="cursor: pointer;">
                  <img :src="row.avatar || defaultAvatar" class="r-admin--user_avatar" />
                  <div>
                    <div class="r-admin--user_name">{{ row.nickname || row.username }}</div>
                    <div class="r-admin--user_email">{{ row.email }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="role" label="角色" width="90">
              <template #default="{ row }">
                <el-tag :type="getRoleTagType(row.role)" size="small">
                  {{ getRoleName(row.role) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'active' ? '正常' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="活跃大佬" width="90">
              <template #default="{ row }">
                <el-switch
                  v-model="row.is_active_dalao"
                  size="small"
                  @change="(val) => handleToggleActiveDalao(row, val)"
                />
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="注册时间" width="110">
              <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
            </el-table-column>
            <el-table-column prop="last_login_at" label="最后登录" width="110">
              <template #default="{ row }">{{ formatDate(row.last_login_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="showUserDetail(row)">详情</el-button>
                <el-button size="small" :type="row.status === 'active' ? 'danger' : 'success'" @click="toggleUserStatus(row)">
                  {{ row.status === 'active' ? '禁用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="r-admin--pagination">
            <el-pagination
              v-model:current-page="userPage"
              v-model:page-size="userPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="userTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="fetchUsers"
              @size-change="fetchUsers"
            />
          </div>
        </div>
        
        <!-- 用户详情弹窗 -->
        <el-dialog v-model="userDetailVisible" title="用户详情" width="800px" destroy-on-close>
          <div v-if="userDetailLoading" style="text-align: center; padding: 40px;">
            <el-icon class="is-loading" :size="40"><Loading /></el-icon>
          </div>
          <div v-else-if="userDetail" class="r-admin--user_detail">
            <div class="r-admin--user_detail_header">
              <img :src="userDetail.user.avatar || defaultAvatar" class="r-admin--user_detail_avatar" />
              <div class="r-admin--user_detail_info">
                <h3>{{ userDetail.user.nickname || userDetail.user.username }}</h3>
                <p>@{{ userDetail.user.username }} · {{ userDetail.user.email }}</p>
                <div class="r-admin--user_detail_tags">
                  <el-tag :type="getRoleTagType(userDetail.user.role)">{{ getRoleName(userDetail.user.role) }}</el-tag>
                  <el-tag :type="userDetail.user.status === 'active' ? 'success' : 'danger'">
                    {{ userDetail.user.status === 'active' ? '正常' : '禁用' }}
                  </el-tag>
                  <el-tag v-if="userDetail.user.codemao_user_id" type="warning">编程猫ID: {{ userDetail.user.codemao_user_id }}</el-tag>
                </div>
              </div>
              <div class="r-admin--user_detail_actions">
                <el-button type="primary" @click="showPasswordDialog">修改密码</el-button>
                <el-button type="warning" @click="showSendNotificationDialog">发送站内信</el-button>
                <el-button :type="userDetail.user.status === 'active' ? 'danger' : 'success'" @click="toggleUserStatus(userDetail.user)">
                  {{ userDetail.user.status === 'active' ? '禁用账户' : '启用账户' }}
                </el-button>
              </div>
            </div>
            
            <div class="r-admin--user_stats">
              <div class="r-admin--user_stat">
                <span class="r-admin--stat_value">{{ userDetail.stats.worksCount }}</span>
                <span class="r-admin--stat_label">作品</span>
              </div>
              <div class="r-admin--user_stat">
                <span class="r-admin--stat_value">{{ userDetail.stats.commentsCount }}</span>
                <span class="r-admin--stat_label">评论</span>
              </div>
              <div class="r-admin--user_stat">
                <span class="r-admin--stat_value">{{ userDetail.stats.favoritesCount }}</span>
                <span class="r-admin--stat_label">收藏</span>
              </div>
              <div class="r-admin--user_stat">
                <span class="r-admin--stat_value">{{ userDetail.stats.followingCount }}</span>
                <span class="r-admin--stat_label">关注</span>
              </div>
              <div class="r-admin--user_stat">
                <span class="r-admin--stat_value">{{ userDetail.stats.followersCount }}</span>
                <span class="r-admin--stat_label">粉丝</span>
              </div>
              <div class="r-admin--user_stat">
                <span class="r-admin--stat_value">{{ userDetail.stats.likesReceived }}</span>
                <span class="r-admin--stat_label">获赞</span>
              </div>
            </div>
            
            <el-tabs>
              <el-tab-pane label="最近作品">
                <el-table :data="userDetail.recentWorks" size="small" max-height="300">
                  <el-table-column prop="id" label="ID" width="60" />
                  <el-table-column prop="name" label="名称" min-width="150" />
                  <el-table-column prop="praise_times" label="点赞" width="80" />
                  <el-table-column prop="view_times" label="浏览" width="80" />
                  <el-table-column prop="created_at" label="发布时间" width="110">
                    <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
                  </el-table-column>
                </el-table>
                <el-empty v-if="!userDetail.recentWorks?.length" description="暂无作品" />
              </el-tab-pane>
              <el-tab-pane label="最近评论">
                <el-table :data="userDetail.recentComments" size="small" max-height="300">
                  <el-table-column prop="id" label="ID" width="60" />
                  <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
                  <el-table-column prop="work.name" label="作品" width="120" show-overflow-tooltip />
                  <el-table-column prop="created_at" label="时间" width="110">
                    <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
                  </el-table-column>
                </el-table>
                <el-empty v-if="!userDetail.recentComments?.length" description="暂无评论" />
              </el-tab-pane>
              <el-tab-pane label="账户信息">
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item label="用户ID">{{ userDetail.user.id }}</el-descriptions-item>
                  <el-descriptions-item label="用户名">{{ userDetail.user.username }}</el-descriptions-item>
                  <el-descriptions-item label="邮箱">{{ userDetail.user.email }}</el-descriptions-item>
                  <el-descriptions-item label="昵称">{{ userDetail.user.nickname || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="编程猫ID">{{ userDetail.user.codemao_user_id || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="角色">{{ getRoleName(userDetail.user.role) }}</el-descriptions-item>
                  <el-descriptions-item label="注册时间">{{ formatDateTime(userDetail.user.created_at) }}</el-descriptions-item>
                  <el-descriptions-item label="最后登录">{{ formatDateTime(userDetail.user.last_login_at) }}</el-descriptions-item>
                  <el-descriptions-item label="最后登录IP">{{ userDetail.user.last_login_ip || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="个人简介">{{ userDetail.user.bio || '-' }}</el-descriptions-item>
                </el-descriptions>
                
                <div v-if="userDetail.user.codemao_token && userStore.user?.role === 'superadmin'" class="r-admin--token_info">
                  <h4>编程猫Token信息 <el-tag type="danger" size="small">仅超级管理员可见</el-tag></h4>
                  <el-input 
                    :model-value="userDetail.user.codemao_token" 
                    type="textarea" 
                    :rows="3" 
                    readonly 
                    show-word-limit
                  />
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-dialog>
        
        <!-- 修改密码弹窗 -->
        <el-dialog v-model="passwordDialogVisible" title="修改用户密码" width="400px">
          <el-form :model="passwordForm" label-width="80px">
            <el-form-item label="新密码">
              <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码" show-password />
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入密码" show-password />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="passwordDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleUpdatePassword" :loading="passwordLoading">确认修改</el-button>
          </template>
        </el-dialog>
        
        <!-- 发送站内信弹窗 -->
        <el-dialog v-model="notificationDialogVisible" title="发送站内信" width="500px">
          <el-form :model="notificationForm" label-width="80px">
            <el-form-item label="接收用户">
              <span v-if="notificationForm.targetUser">{{ notificationForm.targetUser.nickname || notificationForm.targetUser.username }}</span>
              <span v-else-if="notificationForm.targetUsers">已选择 {{ notificationForm.targetUsers.length }} 个用户</span>
              <span v-else>全部用户</span>
            </el-form-item>
            <el-form-item label="标题">
              <el-input v-model="notificationForm.title" placeholder="请输入标题" maxlength="100" show-word-limit />
            </el-form-item>
            <el-form-item label="内容">
              <el-input v-model="notificationForm.content" type="textarea" :rows="4" placeholder="请输入内容" maxlength="500" show-word-limit />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="notificationDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSendNotification" :loading="notificationLoading">发送</el-button>
          </template>
        </el-dialog>
        
        <!-- 批量发送站内信弹窗 -->
        <el-dialog v-model="batchNotificationDialogVisible" title="批量发送站内信" width="600px">
          <el-alert type="info" :closable="false" style="margin-bottom: 16px;">
            选择用户后发送站内信，或点击"发送给全部用户"
          </el-alert>
          <div style="margin-bottom: 16px;">
            <el-button type="primary" @click="selectAllUsers">全选当前页</el-button>
            <el-button @click="clearSelectedUsers">清除选择</el-button>
            <el-button type="warning" @click="showAllUsersNotificationDialog">发送给全部用户</el-button>
            <span style="margin-left: 16px; color: #666;">已选择 {{ selectedUserIds.length }} 个用户</span>
          </div>
          <el-table :data="users" @selection-change="handleUserSelection" max-height="300">
            <el-table-column type="selection" width="50" />
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column label="用户信息" min-width="150">
              <template #default="{ row }">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <img :src="row.avatar || defaultAvatar" style="width: 32px; height: 32px; border-radius: 50%;" />
                  <span>{{ row.nickname || row.username }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="role" label="角色" width="90">
              <template #default="{ row }">
                <el-tag :type="getRoleTagType(row.role)" size="small">{{ getRoleName(row.role) }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-form :model="notificationForm" label-width="80px" style="margin-top: 16px;">
            <el-form-item label="标题">
              <el-input v-model="notificationForm.title" placeholder="请输入标题" maxlength="100" show-word-limit />
            </el-form-item>
            <el-form-item label="内容">
              <el-input v-model="notificationForm.content" type="textarea" :rows="3" placeholder="请输入内容" maxlength="500" show-word-limit />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="batchNotificationDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleBatchNotification" :loading="notificationLoading" :disabled="selectedUserIds.length === 0">发送给选中用户</el-button>
          </template>
        </el-dialog>
        
        <!-- 作品管理 -->
        <div v-if="activeMenu === 'works'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">作品管理</h2>
            <div class="r-admin--filters">
              <el-input v-model="workSearch" placeholder="搜索作品名/ID/作者" style="width: 180px" @keyup.enter="searchWorks" clearable>
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
              <el-select v-model="workTypeFilter" placeholder="类型" style="width: 100px" clearable @change="searchWorks">
                <el-option label="全部" value="" />
                <el-option label="游戏" value="游戏" />
                <el-option label="动画" value="动画" />
                <el-option label="小说" value="小说" />
                <el-option label="其他" value="其他" />
              </el-select>
              <el-select v-model="workFeaturedFilter" placeholder="精选" style="width: 100px" clearable @change="searchWorks">
                <el-option label="全部" value="" />
                <el-option label="已精选" value="true" />
                <el-option label="未精选" value="false" />
              </el-select>
              <el-button type="primary" @click="searchWorks">搜索</el-button>
              <el-button type="warning" plain @click="recalibrateWorks" :loading="recalibrating">校准数据</el-button>
            </div>
          </div>
          <el-table :data="works" v-loading="loadingWorks" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="codemao_work_id" label="编程猫ID" width="100" />
            <el-table-column label="作品" min-width="200">
              <template #default="{ row }">
                <div class="r-admin--work_cell">
                  <img :src="row.preview" class="r-admin--work_cover" />
                  <div>
                    <div class="r-admin--work_name">{{ row.name }}</div>
                    <div class="r-admin--work_author">{{ row.codemao_author_name }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="作品类型" width="150">
              <template #default="{ row }">
                <el-tag size="small">{{ getTypeName(row.type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="view_times" label="浏览" width="80" sortable />
            <el-table-column prop="praise_times" label="点赞" width="80" sortable />
            <el-table-column prop="is_featured" label="精选" width="80">
              <template #default="{ row }">
                <el-tag :type="row.is_featured ? 'warning' : 'info'" size="small">
                  {{ row.is_featured ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="发布时间" width="110">
              <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button size="small" :type="row.is_featured ? 'info' : 'warning'" @click="toggleWorkFeatured(row)">
                  {{ row.is_featured ? '取消精选' : '设为精选' }}
                </el-button>
                <el-button size="small" type="danger" @click="handleDeleteWork(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="r-admin--pagination">
            <el-pagination
              v-model:current-page="workPage"
              v-model:page-size="workPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="workTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="fetchWorks"
              @size-change="fetchWorks"
            />
          </div>
        </div>
        
        <!-- 评论管理 -->
        <div v-if="activeMenu === 'comments'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">评论管理</h2>
            <div class="r-admin--filters">
              <el-input v-model="commentSearch" placeholder="搜索评论内容" style="width: 200px" @keyup.enter="searchComments" clearable>
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
              <el-input v-model="commentUserId" placeholder="用户ID" style="width: 100px" @keyup.enter="searchComments" clearable />
              <el-input v-model="commentWorkId" placeholder="作品ID" style="width: 100px" @keyup.enter="searchComments" clearable />
              <el-select v-model="commentStatusFilter" placeholder="状态" style="width: 100px" clearable @change="searchComments">
                <el-option label="全部" value="" />
                <el-option label="正常" value="active" />
                <el-option label="隐藏" value="hidden" />
                <el-option label="已删除" value="deleted" />
              </el-select>
              <el-button type="primary" @click="searchComments">搜索</el-button>
            </div>
          </div>
          <el-table :data="comments" v-loading="loadingComments" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column label="用户" width="120">
              <template #default="{ row }">
                <div class="r-admin--user_cell" v-if="row.user">
                  <img :src="row.user.avatar || defaultAvatar" class="r-admin--user_avatar" />
                  <span>{{ row.user.nickname || row.user.username }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="评论内容" min-width="250">
              <template #default="{ row }">
                <div class="r-admin--comment_content">{{ row.content }}</div>
              </template>
            </el-table-column>
            <el-table-column label="所属作品" width="150">
              <template #default="{ row }">
                <span v-if="row.work">{{ row.work.name }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="like_count" label="点赞" width="70" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : row.status === 'hidden' ? 'warning' : 'danger'" size="small">
                  {{ row.status === 'active' ? '正常' : row.status === 'hidden' ? '隐藏' : '已删除' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="时间" width="110">
              <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button size="small" :type="row.status === 'active' ? 'warning' : 'success'" @click="toggleCommentStatus(row)">
                  {{ row.status === 'active' ? '隐藏' : '显示' }}
                </el-button>
                <el-button size="small" type="danger" @click="handleDeleteComment(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="r-admin--pagination">
            <el-pagination
              v-model:current-page="commentPage"
              v-model:page-size="commentPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="commentTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="fetchComments"
              @size-change="fetchComments"
            />
          </div>
        </div>
        
        <!-- 帖子管理 -->
        <div v-if="activeMenu === 'posts'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">帖子管理</h2>
          </div>
          <Posts />
        </div>
        
        <!-- 举报管理 -->
        <div v-if="activeMenu === 'reports'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">举报管理</h2>
            <div class="r-admin--filters">
              <el-select v-model="reportTypeFilter" placeholder="类型" style="width: 100px" clearable @change="searchReports">
                <el-option label="全部" value="" />
                <el-option label="作品" value="work" />
                <el-option label="评论" value="comment" />
                <el-option label="用户" value="user" />
              </el-select>
              <el-select v-model="reportStatusFilter" placeholder="状态" style="width: 100px" clearable @change="searchReports">
                <el-option label="全部" value="" />
                <el-option label="待处理" value="pending" />
                <el-option label="处理中" value="processing" />
                <el-option label="已解决" value="resolved" />
                <el-option label="已驳回" value="rejected" />
              </el-select>
              <el-button type="primary" @click="searchReports">搜索</el-button>
              <el-button type="success" @click="batchAIReview" :loading="batchAILoading" :disabled="selectedReports.length === 0">
                <el-icon><Cpu /></el-icon> 批量AI审核 ({{ selectedReports.length }})
              </el-button>
              <el-button type="warning" @click="autoHandleByAI" :loading="autoHandleLoading" :disabled="reports.filter(r => r.aiResult && r.status === 'pending').length === 0">
                一键按AI处理
              </el-button>
            </div>
          </div>
          <el-table :data="reports" v-loading="loadingReports" stripe @selection-change="handleReportSelection">
            <el-table-column type="selection" width="50" />
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="type" label="类型" width="80">
              <template #default="{ row }">
                <el-tag size="small">{{ row.type === 'work' ? '作品' : row.type === 'comment' ? '评论' : '用户' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="举报目标" min-width="150">
              <template #default="{ row }">
                <div v-if="row.target">
                  <span v-if="row.type === 'work'">{{ row.target.name }}</span>
                  <span v-else-if="row.type === 'comment'">{{ row.target.content?.substring(0, 30) }}...</span>
                  <span v-else>{{ row.target.nickname || row.target.username }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="举报人" width="120">
              <template #default="{ row }">
                <span v-if="row.reporter">{{ row.reporter.nickname || row.reporter.username }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="原因" min-width="120" />
            <el-table-column label="AI审核" width="140">
              <template #default="{ row }">
                <div v-if="row.aiResult">
                  <el-tag :type="row.aiResult.riskLevel === 'high' ? 'danger' : row.aiResult.riskLevel === 'medium' ? 'warning' : 'success'" size="small">
                    {{ row.aiResult.riskLevel === 'high' ? '高风险' : row.aiResult.riskLevel === 'medium' ? '中风险' : '低风险' }}
                  </el-tag>
                  <div style="font-size: 12px; color: #666;">{{ row.aiResult.recommendation === 'delete' ? '建议删除' : row.aiResult.recommendation === 'review' ? '需审核' : '正常' }}</div>
                  <el-button size="small" link @click="quickAIReview(row)" :loading="row.aiLoading" style="padding: 0;">重新审核</el-button>
                </div>
                <el-button v-else size="small" @click="quickAIReview(row)" :loading="row.aiLoading">审核</el-button>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="reportStatusMap[row.status]" size="small">
                  {{ reportStatusText[row.status] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="时间" width="110">
              <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="showReportDialog(row)" :disabled="row.status !== 'pending'">处理</el-button>
                <el-button size="small" type="danger" @click="quickHandle(row, 'delete')" :disabled="row.status !== 'pending'">删除</el-button>
                <el-button size="small" type="info" @click="quickHandle(row, 'reject')" :disabled="row.status !== 'pending'">驳回</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="r-admin--pagination">
            <el-pagination
              v-model:current-page="reportPage"
              v-model:page-size="reportPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="reportTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="fetchReports"
              @size-change="fetchReports"
            />
          </div>
        </div>
        
        <!-- 角色管理 -->
        <div v-if="activeMenu === 'roles'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">角色管理</h2>
          </div>
          
          <h3 style="margin-bottom: 16px;">角色权限说明</h3>
          <el-table :data="roles" stripe style="margin-bottom: 24px;">
            <el-table-column prop="name" label="角色名称" width="120" />
            <el-table-column prop="key" label="角色标识" width="120" />
            <el-table-column prop="level" label="等级" width="80" />
            <el-table-column label="权限列表">
              <template #default="{ row }">
                <el-tag v-for="p in row.permissions.slice(0, 5)" :key="p" size="small" style="margin-right: 4px; margin-bottom: 4px;">{{ p }}</el-tag>
                <el-tag v-if="row.permissions.length > 5" size="small" type="info">+{{ row.permissions.length - 5 }} 更多</el-tag>
              </template>
            </el-table-column>
          </el-table>
          
          <h3 style="margin-bottom: 16px;">管理员列表</h3>
          <el-table :data="adminUsers" v-loading="loadingAdminUsers" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column label="用户" min-width="150">
              <template #default="{ row }">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <img :src="row.avatar || defaultAvatar" style="width: 32px; height: 32px; border-radius: 50%;" />
                  <span>{{ row.nickname || row.username }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="role" label="角色" width="120">
              <template #default="{ row }">
                <el-tag :type="getRoleTagType(row.role)">{{ getRoleName(row.role) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'active' ? '正常' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" @click="showRoleDialog(row)" :disabled="row.id === userStore.user?.id">修改角色</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <!-- 权限设置 -->
        <div v-if="activeMenu === 'permissions'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">权限设置</h2>
            <el-button @click="fetchRolePermissions">刷新</el-button>
          </div>
          
          <el-alert type="info" :closable="false" style="margin-bottom: 16px;">
            超级管理员可以自定义各角色的权限。修改权限后立即生效。
          </el-alert>
          
          <el-tabs v-model="activeRoleTab" @tab-change="handleRoleTabChange">
            <el-tab-pane v-for="role in rolePermissionsList" :key="role.key" :label="role.name" :name="role.key" :disabled="role.key === 'superadmin'">
              <div v-if="role.key !== 'superadmin'" style="padding: 16px 0;">
                <div style="margin-bottom: 16px; display: flex; gap: 16px; align-items: center;">
                  <span>角色名称：</span>
                  <el-input v-model="editingRole.name" style="width: 150px;" />
                  <span>等级：</span>
                  <el-input-number v-model="editingRole.level" :min="0" :max="10" />
                  <el-button type="primary" @click="saveRolePermissions">保存修改</el-button>
                  <el-button @click="resetRolePermissions(role.key)">重置默认</el-button>
                </div>
                
                <el-divider>权限列表</el-divider>
                
                <div v-for="category in permissionCategories" :key="category" style="margin-bottom: 16px;">
                  <h4 style="margin-bottom: 8px; color: #666;">{{ category }}</h4>
                  <el-checkbox-group v-model="editingRole.permissions">
                    <el-checkbox v-for="perm in getPermissionsByCategory(category)" :key="perm.key" :label="perm.key">
                      {{ perm.name }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
              <div v-else style="padding: 16px 0; color: #999;">
                超级管理员拥有所有权限，无需配置。
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
        
        <!-- 轮播图管理 -->
        <div v-if="activeMenu === 'banners'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">轮播图管理</h2>
            <div>
              <el-button type="success" @click="crawlBanners" :loading="crawlingBanners">从编程猫爬取</el-button>
              <el-button type="primary" @click="showBannerDialog()">添加轮播图</el-button>
            </div>
          </div>
          <el-table :data="banners" v-loading="loadingBanners" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column label="图片" width="150">
              <template #default="{ row }">
                <img :src="row.image_url" style="width: 120px; height: 60px; object-fit: cover; border-radius: 4px;" />
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="150" />
            <el-table-column prop="link_url" label="链接" min-width="200">
              <template #default="{ row }">
                <a :href="row.link_url" target="_blank" style="color: #409eff;">{{ row.link_url }}</a>
              </template>
            </el-table-column>
            <el-table-column prop="sort_order" label="排序" width="80" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
                  {{ row.status === 'active' ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="showBannerDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDeleteBanner(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <!-- IP封禁 -->
        <div v-if="activeMenu === 'ipbans'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">IP封禁管理</h2>
            <el-button type="primary" @click="showIpBanDialog()">添加封禁</el-button>
          </div>
          <el-table :data="ipBans" v-loading="loadingIpBans" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="ip_address" label="IP地址" width="150" />
            <el-table-column prop="reason" label="封禁原因" min-width="200" />
            <el-table-column label="操作人" width="120">
              <template #default="{ row }">
                <span v-if="row.banner">{{ row.banner.nickname || row.banner.username }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="expires_at" label="过期时间" width="150">
              <template #default="{ row }">
                {{ row.expires_at ? formatDate(row.expires_at) : '永久' }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'danger' : 'success'" size="small">
                  {{ row.status === 'active' ? '生效中' : '已过期' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="110">
              <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="danger" @click="handleRemoveIpBan(row)" :disabled="row.status !== 'active'">解封</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="r-admin--pagination">
            <el-pagination
              v-model:current-page="ipBanPage"
              v-model:page-size="ipBanPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="ipBanTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="fetchIpBans"
              @size-change="fetchIpBans"
            />
          </div>
        </div>
        
        <!-- 工作室管理 -->
        <div v-if="activeMenu === 'studios'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">工作室管理</h2>
          </div>
          
          <el-table :data="studios" v-loading="loadingStudios" stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="name" label="名称" min-width="150" />
            <el-table-column prop="owner" label="创建者" width="120">
              <template #default="{ row }">
                {{ row.owner?.nickname || row.owner?.username }}
              </template>
            </el-table-column>
            <el-table-column prop="member_count" label="成员数" width="80" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
                  {{ row.status === 'active' ? '正常' : '已禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="160">
              <template #default="{ row }">
                {{ new Date(row.created_at).toLocaleString() }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="showStudioDetail(row)">详情</el-button>
                <el-button 
                  size="small" 
                  :type="row.status === 'active' ? 'warning' : 'success'"
                  @click="handleStudioStatus(row)"
                >
                  {{ row.status === 'active' ? '禁用' : '启用' }}
                </el-button>
                <el-button size="small" type="danger" @click="handleDeleteStudio(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          
          <el-pagination
            v-model:current-page="studiosPage"
            :page-size="20"
            :total="studiosTotal"
            layout="total, prev, pager, next"
            @current-change="fetchStudios"
            style="margin-top: 20px; justify-content: flex-end;"
          />
        </div>
        
        <!-- 工作室详情弹窗 -->
        <el-dialog v-model="studioDetailVisible" title="工作室详情" width="900px" destroy-on-close>
          <div v-if="studioDetailLoading" style="text-align: center; padding: 40px;">
            <el-icon class="is-loading" :size="40"><Loading /></el-icon>
          </div>
          <div v-else-if="studioDetail" class="r-admin--studio_detail">
            <div class="r-admin--studio_detail_header">
              <img :src="studioDetail.studio.logo || defaultStudioCover" class="r-admin--studio_detail_logo" />
              <div class="r-admin--studio_detail_info">
                <h3>{{ studioDetail.studio.name }}</h3>
                <p>{{ studioDetail.studio.description || '暂无描述' }}</p>
                <div class="r-admin--studio_detail_tags">
                  <el-tag :type="studioDetail.studio.status === 'active' ? 'success' : 'danger'">
                    {{ studioDetail.studio.status === 'active' ? '正常' : '已禁用' }}
                  </el-tag>
                  <el-tag type="info">成员: {{ studioDetail.studio.member_count }}</el-tag>
                  <el-tag type="info">作品: {{ studioDetail.studio.work_count }}</el-tag>
                </div>
              </div>
              <div class="r-admin--studio_detail_actions">
                <el-button :type="studioDetail.studio.status === 'active' ? 'danger' : 'success'" @click="handleStudioStatus(studioDetail.studio); studioDetailVisible = false;">
                  {{ studioDetail.studio.status === 'active' ? '禁用工作室' : '启用工作室' }}
                </el-button>
                <el-button type="danger" @click="handleDeleteStudio(studioDetail.studio); studioDetailVisible = false;">删除工作室</el-button>
              </div>
            </div>
            
            <el-tabs>
              <el-tab-pane label="成员管理">
                <el-table :data="studioDetail.members" size="small" max-height="400">
                  <el-table-column prop="user.id" label="用户ID" width="80" />
                  <el-table-column prop="user.nickname" label="昵称" width="120">
                    <template #default="{ row }">{{ row.user?.nickname || row.user?.username }}</template>
                  </el-table-column>
                  <el-table-column prop="user.username" label="用户名" width="120" />
                  <el-table-column prop="role" label="角色" width="100">
                    <template #default="{ row }">
                      <el-tag :type="row.role === 'owner' ? 'danger' : row.role === 'admin' ? 'warning' : 'info'">
                        {{ row.role === 'owner' ? '室长' : row.role === 'admin' ? '管理员' : '成员' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" label="状态" width="80">
                    <template #default="{ row }">
                      <el-tag :type="row.status === 'active' ? 'success' : 'warning'" size="small">
                        {{ row.status === 'active' ? '正常' : '待审核' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="joined_at" label="加入时间" width="110">
                    <template #default="{ row }">{{ formatDate(row.joined_at) }}</template>
                  </el-table-column>
                  <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                      <el-button v-if="row.role !== 'owner'" size="small" type="primary" @click="changeMemberRole(row)">改角色</el-button>
                      <el-button v-if="row.role !== 'owner'" size="small" type="danger" @click="removeMember(row)">移除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty v-if="!studioDetail.members?.length" description="暂无成员" />
              </el-tab-pane>
              <el-tab-pane label="工作室作品">
                <el-table :data="studioDetail.works" size="small" max-height="400">
                  <el-table-column prop="id" label="ID" width="60" />
                  <el-table-column prop="name" label="作品名称" min-width="150" show-overflow-tooltip />
                  <el-table-column prop="author.nickname" label="作者" width="100" />
                  <el-table-column prop="view_times" label="浏览" width="80" />
                  <el-table-column prop="praise_times" label="点赞" width="80" />
                  <el-table-column prop="created_at" label="添加时间" width="110">
                    <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
                  </el-table-column>
                  <el-table-column label="操作" width="80">
                    <template #default="{ row }">
                      <el-button size="small" type="danger" @click="removeStudioWork(row)">移除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty v-if="!studioDetail.works?.length" description="暂无作品" />
              </el-tab-pane>
              <el-tab-pane label="基本信息">
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item label="工作室ID">{{ studioDetail.studio.id }}</el-descriptions-item>
                  <el-descriptions-item label="名称">{{ studioDetail.studio.name }}</el-descriptions-item>
                  <el-descriptions-item label="室长">{{ studioDetail.owner?.nickname || studioDetail.owner?.username }}</el-descriptions-item>
                  <el-descriptions-item label="成员数">{{ studioDetail.studio.member_count }}</el-descriptions-item>
                  <el-descriptions-item label="作品数">{{ studioDetail.studio.work_count }}</el-descriptions-item>
                  <el-descriptions-item label="状态">{{ studioDetail.studio.status === 'active' ? '正常' : '已禁用' }}</el-descriptions-item>
                  <el-descriptions-item label="创建时间">{{ formatDateTime(studioDetail.studio.created_at) }}</el-descriptions-item>
                  <el-descriptions-item label="更新时间">{{ formatDateTime(studioDetail.studio.updated_at) }}</el-descriptions-item>
                  <el-descriptions-item label="描述" :span="2">{{ studioDetail.studio.description || '暂无描述' }}</el-descriptions-item>
                </el-descriptions>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-dialog>
        
        <!-- 作品爬取 -->
        <div v-if="activeMenu === 'crawl'" class="r-admin--section">
          <h2 class="r-admin--title">作品爬取</h2>
          
          <div class="r-admin--crawl_section">
            <h3>单个作品爬取</h3>
            <div class="r-admin--crawl_form">
              <el-input v-model="crawlWorkId" placeholder="输入编程猫作品ID" style="width: 200px" />
              <el-button type="primary" @click="handleCrawlWork" :loading="crawling">爬取</el-button>
            </div>
          </div>
          
          <div class="r-admin--crawl_section">
            <h3>按用户ID爬取</h3>
            <p class="r-admin--crawl_desc">爬取指定用户的所有作品（最多100个）</p>
            <div class="r-admin--crawl_form">
              <el-input v-model="crawlUserId" placeholder="输入编程猫用户ID" style="width: 200px" />
              <el-button type="primary" @click="handleCrawlUser" :loading="crawlingUser">爬取用户作品</el-button>
            </div>
          </div>
          
          <div class="r-admin--crawl_section">
            <h3>批量爬取热门作品</h3>
            <p class="r-admin--crawl_desc">从编程猫热门、最新、发现板块获取作品</p>
            <div class="r-admin--crawl_form">
              <el-input-number v-model="crawlCount" :min="1" :max="1000" />
              <el-button type="primary" @click="handleCrawlHot" :loading="crawlingHot">一键爬取</el-button>
            </div>
          </div>
          
          <div class="r-admin--crawl_section">
            <h3>爬取论坛帖子作品</h3>
            <p class="r-admin--crawl_desc">搜索论坛帖子，从帖子中提取作品ID并爬取</p>
            <div class="r-admin--crawl_form">
              <el-input v-model="crawlKeyword" placeholder="搜索关键词" style="width: 150px" />
              <el-button type="primary" @click="handleCrawlPosts" :loading="crawlingPosts">爬取帖子作品</el-button>
            </div>
          </div>
          
          <div v-if="crawlResult" class="r-admin--crawl_result">
            <el-alert :title="crawlResult" :type="crawlResultType" show-icon />
          </div>
          
          <div v-if="crawlLogs.length > 0" class="r-admin--crawl_logs">
            <div class="r-admin--crawl_logs_header">
              <h3>爬取日志</h3>
              <el-button size="small" @click="crawlLogs = []">清空</el-button>
            </div>
            <div class="r-admin--crawl_logs_content" ref="crawlLogsRef">
              <div v-for="(log, index) in crawlLogs" :key="index" 
                   :class="['r-admin--crawl_log_item', 'r-admin--crawl_log_' + log.type]">
                <span class="r-admin--crawl_log_time">{{ formatLogTime(log.time) }}</span>
                <span class="r-admin--crawl_log_msg">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 公告管理 -->
        <div v-if="activeMenu === 'announcements'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">公告管理</h2>
            <el-button type="primary" @click="showAnnouncementDialog()">发布公告</el-button>
          </div>
          <el-table :data="announcements" v-loading="loadingAnnouncements" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="title" label="标题" min-width="200" />
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="row.type === 'important' ? 'danger' : 'info'">{{ row.type === 'important' ? '重要' : '普通' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '显示' : '隐藏' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="author" label="发布者" width="120">
              <template #default="{ row }">{{ row.author?.nickname || row.author?.username }}</template>
            </el-table-column>
            <el-table-column prop="created_at" label="发布时间" width="150">
              <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" @click="showAnnouncementDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDeleteAnnouncement(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <!-- 敏感词管理 -->
        <div v-if="activeMenu === 'sensitive'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">敏感词管理</h2>
            <div>
              <el-button @click="showSensitiveImportDialog">批量导入</el-button>
              <el-button type="primary" @click="showSensitiveDialog()">添加敏感词</el-button>
            </div>
          </div>
          <el-table :data="sensitiveWords" v-loading="loadingSensitiveWords" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="word" label="敏感词" min-width="150" />
            <el-table-column prop="category" label="分类" width="100" />
            <el-table-column prop="level" label="等级" width="100">
              <template #default="{ row }">
                <el-tag :type="row.level === 'high' ? 'danger' : (row.level === 'medium' ? 'warning' : 'info')">
                  {{ row.level === 'high' ? '高' : (row.level === 'medium' ? '中' : '低') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="replacement" label="替换词" width="100" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" @click="showSensitiveDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDeleteSensitiveWord(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <!-- 系统设置 -->
        <div v-if="activeMenu === 'configs'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">系统设置</h2>
            <el-button type="primary" @click="saveConfigs" :loading="savingConfigs">保存设置</el-button>
          </div>
          <el-form :model="configForm" label-width="120px" v-loading="loadingConfigs">
            <el-form-item label="网站名称">
              <el-input v-model="configForm.site_name" placeholder="编程猫社区" />
            </el-form-item>
            <el-form-item label="网站描述">
              <el-input v-model="configForm.site_description" type="textarea" :rows="2" placeholder="网站简介" />
            </el-form-item>
            <el-form-item label="网站关键词">
              <el-input v-model="configForm.site_keywords" placeholder="SEO关键词，逗号分隔" />
            </el-form-item>
            <el-form-item label="联系邮箱">
              <el-input v-model="configForm.contact_email" placeholder="admin@example.com" />
            </el-form-item>
            <el-form-item label="备案号">
              <el-input v-model="configForm.icp_number" placeholder="京ICP备xxx号" />
            </el-form-item>
            
            <el-divider>AI审核配置</el-divider>
            <el-form-item label="启用AI审核">
              <el-switch v-model="configForm.ai_enabled" active-text="开启" inactive-text="关闭" active-value="true" inactive-value="false" />
            </el-form-item>
            <el-form-item label="API地址">
              <el-input v-model="configForm.ai_api_url" placeholder="如: https://api.openai.com/v1/chat/completions" />
            </el-form-item>
            <el-form-item label="API密钥">
              <el-input v-model="configForm.ai_api_key" placeholder="API Key" show-password />
            </el-form-item>
            <el-form-item label="模型名称">
              <el-input v-model="configForm.ai_model" placeholder="如: gpt-3.5-turbo, deepseek-chat" />
            </el-form-item>
            <el-form-item label="审核提示词">
              <div class="r-admin--prompt_actions">
                <el-button size="small" @click="useDefaultPrompt">使用默认提示词</el-button>
                <el-button size="small" @click="showPromptHelp = true">查看帮助</el-button>
              </div>
              <el-input v-model="configForm.ai_prompt" type="textarea" :rows="12" placeholder="自定义审核提示词，使用{{type}}和{{content}}作为占位符" />
            </el-form-item>
            
            <el-dialog v-model="showPromptHelp" title="AI审核提示词帮助" width="700px">
              <div class="r-admin--prompt_help">
                <h4>占位符说明</h4>
                <ul>
                  <li><code>{{type}}</code> - 审核类型（作品/评论/帖子/用户）</li>
                  <li><code>{{content}}</code> - 待审核的内容文本</li>
                </ul>
                
                <h4>返回格式要求</h4>
                <p>AI必须返回JSON格式：</p>
                <pre>{
  "riskLevel": "low|medium|high",
  "violations": ["违规类型1", "违规类型2"],
  "reason": "判断理由",
  "recommendation": "pass|review|delete",
  "confidence": 0.95
}</pre>
                
                <h4>字段说明</h4>
                <ul>
                  <li><b>riskLevel</b>: low(正常), medium(轻微违规), high(严重违规)</li>
                  <li><b>violations</b>: 违规类型数组，如["广告", "辱骂"]</li>
                  <li><b>reason</b>: 判断理由说明</li>
                  <li><b>recommendation</b>: pass(通过), review(人工审核), delete(建议删除)</li>
                  <li><b>confidence</b>: 置信度 0-1</li>
                </ul>
                
                <h4>审核类型</h4>
                <ul>
                  <li>涉政、涉黄、涉暴、涉赌、诈骗、广告、辱骂、其他</li>
                </ul>
              </div>
            </el-dialog>
            
            <el-divider>极验验证码配置</el-divider>
            <el-form-item label="启用验证码">
              <el-switch v-model="configForm.geetest_enabled" active-text="开启" inactive-text="关闭" active-value="true" inactive-value="false" />
            </el-form-item>
            <el-form-item label="极验ID">
              <el-input v-model="configForm.geetest_id" placeholder="极验后台获取的ID" />
            </el-form-item>
            <el-form-item label="极验KEY">
              <el-input v-model="configForm.geetest_key" placeholder="极验后台获取的KEY" show-password />
            </el-form-item>
            <el-form-item label="展现形式">
              <el-select v-model="configForm.geetest_product" placeholder="选择验证码展现形式">
                <el-option label="弹出式 (popup)" value="popup" />
                <el-option label="浮动式 (float)" value="float" />
                <el-option label="隐藏按钮式 (bind)" value="bind" />
              </el-select>
            </el-form-item>
            
            <el-divider content-position="left">验证场景开关</el-divider>
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="登录验证">
                  <el-switch v-model="configForm.geetest_login" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="注册验证">
                  <el-switch v-model="configForm.geetest_register" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="点赞验证">
                  <el-switch v-model="configForm.geetest_like" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="评论验证">
                  <el-switch v-model="configForm.geetest_comment" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="回复验证">
                  <el-switch v-model="configForm.geetest_reply" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="举报验证">
                  <el-switch v-model="configForm.geetest_report" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="发布作品验证">
                  <el-switch v-model="configForm.geetest_publish_work" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="发布帖子验证">
                  <el-switch v-model="configForm.geetest_publish_post" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="收藏验证">
                  <el-switch v-model="configForm.geetest_favorite" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="修改个人信息验证">
                  <el-switch v-model="configForm.geetest_update_profile" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
            </el-row>
            
            <el-divider content-position="left">工作室验证场景</el-divider>
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="创建工作室验证">
                  <el-switch v-model="configForm.geetest_create_studio" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="加入工作室验证">
                  <el-switch v-model="configForm.geetest_join_studio" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="投稿作品验证">
                  <el-switch v-model="configForm.geetest_submit_work" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="审核成员验证">
                  <el-switch v-model="configForm.geetest_review_member" active-value="true" inactive-value="false" />
                </el-form-item>
              </el-col>
            </el-row>
            
            <el-divider>数据库配置</el-divider>
            <el-form-item label="数据库类型">
              <el-select v-model="configForm.db_type" placeholder="选择数据库类型">
                <el-option label="SQLite" value="sqlite" />
                <el-option label="MySQL" value="mysql" />
              </el-select>
            </el-form-item>
            <el-form-item label="MySQL主机" v-if="configForm.db_type === 'mysql'">
              <el-input v-model="configForm.mysql_host" placeholder="MySQL服务器地址" />
            </el-form-item>
            <el-form-item label="MySQL端口" v-if="configForm.db_type === 'mysql'">
              <el-input v-model="configForm.mysql_port" placeholder="MySQL端口，默认3306" />
            </el-form-item>
            <el-form-item label="MySQL数据库" v-if="configForm.db_type === 'mysql'">
              <el-input v-model="configForm.mysql_database" placeholder="MySQL数据库名称" />
            </el-form-item>
            <el-form-item label="MySQL用户名" v-if="configForm.db_type === 'mysql'">
              <el-input v-model="configForm.mysql_username" placeholder="MySQL用户名" />
            </el-form-item>
            <el-form-item label="MySQL密码" v-if="configForm.db_type === 'mysql'">
              <el-input v-model="configForm.mysql_password" type="password" placeholder="MySQL密码" show-password />
            </el-form-item>
            
            <el-divider>数据库迁移</el-divider>
            <el-alert type="warning" :closable="false" style="margin-bottom: 20px;">
              <template #title>
                <strong>⚠️ 注意事项</strong>
              </template>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>数据库迁移会将源数据库的数据复制到目标数据库</li>
                <li>如果勾选"清空目标数据库"，目标数据库的所有数据将被删除</li>
                <li>迁移操作不会自动执行，需要手动点击"开始迁移"按钮</li>
                <li>迁移完成后需要手动修改数据库配置并重启服务器</li>
              </ul>
            </el-alert>
            
            <el-row :gutter="20">
              <el-col :span="12">
                <el-card shadow="hover" class="migration-card">
                  <template #header>
                    <span>📥 源数据库</span>
                  </template>
                  <el-form-item label="数据库类型">
                    <el-select v-model="migrationForm.sourceType" placeholder="选择源数据库">
                      <el-option label="SQLite" value="sqlite" />
                      <el-option label="MySQL" value="mysql" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="SQLite路径" v-if="migrationForm.sourceType === 'sqlite'">
                    <el-input v-model="migrationForm.sourceConfig.path" placeholder="./database.sqlite" />
                  </el-form-item>
                  <template v-if="migrationForm.sourceType === 'mysql'">
                    <el-form-item label="主机地址">
                      <el-input v-model="migrationForm.sourceConfig.host" placeholder="localhost" />
                    </el-form-item>
                    <el-form-item label="端口">
                      <el-input v-model="migrationForm.sourceConfig.port" placeholder="3306" />
                    </el-form-item>
                    <el-form-item label="数据库名">
                      <el-input v-model="migrationForm.sourceConfig.database" placeholder="coding_dog" />
                    </el-form-item>
                    <el-form-item label="用户名">
                      <el-input v-model="migrationForm.sourceConfig.user" placeholder="root" />
                    </el-form-item>
                    <el-form-item label="密码">
                      <el-input v-model="migrationForm.sourceConfig.password" type="password" show-password placeholder="密码" />
                    </el-form-item>
                  </template>
                  <el-button type="primary" size="small" @click="testSourceConnection" :loading="testingSource">
                    测试连接
                  </el-button>
                </el-card>
              </el-col>
              <el-col :span="12">
                <el-card shadow="hover" class="migration-card">
                  <template #header>
                    <span>📤 目标数据库</span>
                  </template>
                  <el-form-item label="数据库类型">
                    <el-select v-model="migrationForm.targetType" placeholder="选择目标数据库">
                      <el-option label="SQLite" value="sqlite" />
                      <el-option label="MySQL" value="mysql" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="SQLite路径" v-if="migrationForm.targetType === 'sqlite'">
                    <el-input v-model="migrationForm.targetConfig.path" placeholder="./database.sqlite" />
                  </el-form-item>
                  <template v-if="migrationForm.targetType === 'mysql'">
                    <el-form-item label="主机地址">
                      <el-input v-model="migrationForm.targetConfig.host" placeholder="localhost" />
                    </el-form-item>
                    <el-form-item label="端口">
                      <el-input v-model="migrationForm.targetConfig.port" placeholder="3306" />
                    </el-form-item>
                    <el-form-item label="数据库名">
                      <el-input v-model="migrationForm.targetConfig.database" placeholder="coding_dog" />
                    </el-form-item>
                    <el-form-item label="用户名">
                      <el-input v-model="migrationForm.targetConfig.user" placeholder="root" />
                    </el-form-item>
                    <el-form-item label="密码">
                      <el-input v-model="migrationForm.targetConfig.password" type="password" show-password placeholder="密码" />
                    </el-form-item>
                  </template>
                  <el-button type="primary" size="small" @click="testTargetConnection" :loading="testingTarget">
                    测试连接
                  </el-button>
                </el-card>
              </el-col>
            </el-row>
            
            <el-form-item style="margin-top: 20px;">
              <el-checkbox v-model="migrationForm.clearExisting">
                清空目标数据库（删除所有现有数据）
              </el-checkbox>
            </el-form-item>
            
            <el-form-item>
              <el-button type="danger" @click="startMigration" :loading="migrating" :disabled="!migrationForm.sourceType || !migrationForm.targetType">
                🚀 开始迁移
              </el-button>
              <el-button @click="getMigrationStats" :loading="loadingStats">
                查看数据统计
              </el-button>
            </el-form-item>
            
            <el-card v-if="migrationResult" shadow="hover" style="margin-top: 20px;">
              <template #header>
                <span>📊 迁移结果</span>
              </template>
              <el-descriptions :column="4" border>
                <el-descriptions-item label="用户">{{ migrationResult.users || 0 }}</el-descriptions-item>
                <el-descriptions-item label="作品">{{ migrationResult.works || 0 }}</el-descriptions-item>
                <el-descriptions-item label="评论">{{ migrationResult.comments || 0 }}</el-descriptions-item>
                <el-descriptions-item label="通知">{{ migrationResult.notifications || 0 }}</el-descriptions-item>
                <el-descriptions-item label="系统配置">{{ migrationResult.systemConfigs || 0 }}</el-descriptions-item>
                <el-descriptions-item label="轮播图">{{ migrationResult.banners || 0 }}</el-descriptions-item>
                <el-descriptions-item label="公告">{{ migrationResult.announcements || 0 }}</el-descriptions-item>
                <el-descriptions-item label="IP封禁">{{ migrationResult.ipBans || 0 }}</el-descriptions-item>
                <el-descriptions-item label="举报">{{ migrationResult.reports || 0 }}</el-descriptions-item>
                <el-descriptions-item label="工作室">{{ migrationResult.studios || 0 }}</el-descriptions-item>
                <el-descriptions-item label="工作室成员">{{ migrationResult.studioMembers || 0 }}</el-descriptions-item>
                <el-descriptions-item label="收藏">{{ migrationResult.favorites || 0 }}</el-descriptions-item>
                <el-descriptions-item label="关注">{{ migrationResult.follows || 0 }}</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-form>
        </div>
        
        <!-- hCaptcha配置 -->
        <div v-if="activeMenu === 'security'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">hCaptcha 安全验证</h2>
            <p class="r-admin--subtitle">开启后，用户访问社区需先通过hCaptcha验证，验证过期后需重新验证</p>
          </div>
          <el-form :model="configForm" label-width="120px" class="r-admin--form">
            <el-form-item label="启用hCaptcha">
              <el-switch v-model="configForm.hcaptcha_enabled" active-value="true" inactive-value="false" />
            </el-form-item>
            <el-form-item label="Site Key">
              <el-input v-model="configForm.hcaptcha_site_key" placeholder="hCaptcha Site Key" />
            </el-form-item>
            <el-form-item label="Secret Key">
              <el-input v-model="configForm.hcaptcha_secret_key" type="password" show-password placeholder="hCaptcha Secret Key" />
            </el-form-item>
            <el-form-item label="验证有效期">
              <el-input-number v-model="hcaptchaExpireMinutes" :min="1" :max="1440" />
              <span style="margin-left: 10px; color: #999;">分钟（1-1440分钟，即最长24小时）</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveConfig">保存配置</el-button>
            </el-form-item>
          </el-form>
          
          <!-- 验证码统计 -->
          <div class="r-admin--captcha-stats">
            <h3 class="r-admin--stats-title">验证码统计（近7天）</h3>
            <el-row :gutter="20" v-if="captchaStats">
              <el-col :span="12">
                <div class="r-admin--stat-card">
                  <h4>极验验证码</h4>
                  <div class="r-admin--stat-row">
                    <span class="r-admin--stat-label">展示次数</span>
                    <span class="r-admin--stat-value">{{ captchaStats.geetest?.show || 0 }}</span>
                  </div>
                  <div class="r-admin--stat-row">
                    <span class="r-admin--stat-label">通过次数</span>
                    <span class="r-admin--stat-value success">{{ captchaStats.geetest?.pass || 0 }}</span>
                  </div>
                  <div class="r-admin--stat-row">
                    <span class="r-admin--stat-label">拦截次数</span>
                    <span class="r-admin--stat-value danger">{{ captchaStats.geetest?.block || 0 }}</span>
                  </div>
                  <div class="r-admin--stat-row">
                    <span class="r-admin--stat-label">通过率</span>
                    <span class="r-admin--stat-value">{{ geetestPassRate }}%</span>
                  </div>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="r-admin--stat-card">
                  <h4>hCaptcha验证码</h4>
                  <div class="r-admin--stat-row">
                    <span class="r-admin--stat-label">展示次数</span>
                    <span class="r-admin--stat-value">{{ captchaStats.hcaptcha?.show || 0 }}</span>
                  </div>
                  <div class="r-admin--stat-row">
                    <span class="r-admin--stat-label">通过次数</span>
                    <span class="r-admin--stat-value success">{{ captchaStats.hcaptcha?.pass || 0 }}</span>
                  </div>
                  <div class="r-admin--stat-row">
                    <span class="r-admin--stat-label">拦截次数</span>
                    <span class="r-admin--stat-value danger">{{ captchaStats.hcaptcha?.block || 0 }}</span>
                  </div>
                  <div class="r-admin--stat-row">
                    <span class="r-admin--stat-label">通过率</span>
                    <span class="r-admin--stat-value">{{ hcaptchaPassRate }}%</span>
                  </div>
                </div>
              </el-col>
            </el-row>
          </div>
        </div>
        
        <!-- 操作日志 -->
        <div v-if="activeMenu === 'logs'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">操作日志</h2>
          </div>
          <el-table :data="operationLogs" v-loading="loadingOperationLogs" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="user" label="操作者" width="150">
              <template #default="{ row }">
                <span>{{ row.user?.nickname || row.user?.username || '系统' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="action" label="操作" width="140">
              <template #default="{ row }">
                <span>{{ getActionName(row.action) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="target_type" label="目标类型" width="90">
              <template #default="{ row }">
                <el-tag size="small">{{ getTargetTypeName(row.target_type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="target_id" label="目标ID" width="80" />
            <el-table-column prop="ip_address" label="IP地址" width="130" />
            <el-table-column prop="created_at" label="操作时间" width="160">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="详情" min-width="80">
              <template #default="{ row }">
                <el-button size="small" text @click="showLogDetail(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="r-admin--pagination">
            <el-pagination
              v-model:current-page="logPage"
              :page-size="20"
              :total="logTotal"
              layout="prev, pager, next"
              @current-change="fetchOperationLogs"
            />
          </div>
        </div>
        
        <!-- 实时日志 -->
        <div v-if="activeMenu === 'realtime-logs'" class="r-admin--section">
          <div class="r-admin--header">
            <h2 class="r-admin--title">实时日志</h2>
            <div class="r-admin--header_actions">
              <el-switch v-model="autoRefreshLogs" active-text="自动刷新" @change="toggleAutoRefresh" />
              <el-button @click="fetchRealtimeLogs" :loading="loadingRealtimeLogs">刷新</el-button>
              <el-button @click="clearRealtimeLogs" type="danger">清空</el-button>
            </div>
          </div>
          <div class="r-admin--realtime_logs" ref="realtimeLogsRef">
            <div v-if="realtimeLogs.length === 0" class="r-admin--realtime_logs_empty">
              暂无日志
            </div>
            <div v-for="(log, index) in realtimeLogs" :key="index" 
                 :class="['r-admin--realtime_log_item', 'r-admin--realtime_log_' + log.level]">
              <span class="r-admin--realtime_log_time">{{ formatLogTime(log.time) }}</span>
              <span class="r-admin--realtime_log_level">{{ log.level.toUpperCase() }}</span>
              <span class="r-admin--realtime_log_msg">{{ log.message }}</span>
            </div>
          </div>
          <div class="r-admin--realtime_logs_footer">
            <span>共 {{ realtimeLogs.length }} 条日志</span>
          </div>
        </div>
      </main>
    </div>
    
    <!-- 轮播图编辑对话框 -->
    <el-dialog v-model="bannerDialogVisible" :title="editingBanner ? '编辑轮播图' : '添加轮播图'" width="500px">
      <el-form :model="bannerForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="bannerForm.title" placeholder="轮播图标题" />
        </el-form-item>
        <el-form-item label="图片URL">
          <el-input v-model="bannerForm.image_url" placeholder="图片链接地址" />
        </el-form-item>
        <el-form-item label="跳转链接">
          <el-input v-model="bannerForm.link_url" placeholder="点击跳转的链接" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="bannerForm.sort_order" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="bannerForm.is_active" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bannerDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveBanner">保存</el-button>
      </template>
    </el-dialog>
    
    <!-- IP封禁对话框 -->
    <el-dialog v-model="ipBanDialogVisible" title="添加IP封禁" width="400px">
      <el-form :model="ipBanForm" label-width="80px">
        <el-form-item label="IP地址">
          <el-input v-model="ipBanForm.ip_address" placeholder="输入要封禁的IP地址" />
        </el-form-item>
        <el-form-item label="封禁原因">
          <el-input v-model="ipBanForm.reason" type="textarea" placeholder="封禁原因" />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker v-model="ipBanForm.expires_at" type="datetime" placeholder="留空则永久封禁" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ipBanDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddIpBan">封禁</el-button>
      </template>
    </el-dialog>
    
    <!-- 举报处理对话框 -->
    <el-dialog v-model="reportDialogVisible" title="处理举报" width="600px">
      <el-form :model="reportForm" label-width="80px" v-if="editingReport">
        <el-form-item label="举报类型">
          <el-tag>{{ editingReport.type === 'work' ? '作品' : editingReport.type === 'comment' ? '评论' : '用户' }}</el-tag>
        </el-form-item>
        <el-form-item label="举报原因">
          <span>{{ editingReport.reason }}</span>
        </el-form-item>
        <el-form-item label="详细描述">
          <span>{{ editingReport.description || '无' }}</span>
        </el-form-item>
        
        <!-- AI审核结果 -->
        <el-divider>
          <el-button type="primary" size="small" @click="runAIReview" :loading="aiReviewLoading">
            <el-icon><Cpu /></el-icon> AI审核
          </el-button>
        </el-divider>
        <div v-if="aiReviewResult" class="r-admin--ai_result">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="风险等级">
              <el-tag :type="aiReviewResult.riskLevel === 'high' ? 'danger' : aiReviewResult.riskLevel === 'medium' ? 'warning' : 'success'">
                {{ aiReviewResult.riskLevel === 'high' ? '高风险' : aiReviewResult.riskLevel === 'medium' ? '中风险' : '低风险' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="置信度">{{ (aiReviewResult.confidence * 100).toFixed(0) }}%</el-descriptions-item>
            <el-descriptions-item label="违规类型" :span="2">
              <el-tag v-for="v in aiReviewResult.violations" :key="v" size="small" type="danger" style="margin-right: 4px;">{{ v }}</el-tag>
              <span v-if="!aiReviewResult.violations?.length">无</span>
            </el-descriptions-item>
            <el-descriptions-item label="判定原因" :span="2">{{ aiReviewResult.reason }}</el-descriptions-item>
            <el-descriptions-item label="处理建议" :span="2">
              <el-tag :type="aiReviewResult.recommendation === 'delete' ? 'danger' : aiReviewResult.recommendation === 'review' ? 'warning' : 'success'">
                {{ aiReviewResult.recommendation === 'delete' ? '建议删除' : aiReviewResult.recommendation === 'review' ? '需人工审核' : '内容正常' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>
        
        <el-divider>人工处理</el-divider>
        <el-form-item label="处理结果">
          <el-select v-model="reportForm.status" style="width: 100%">
            <el-option label="处理中" value="processing" />
            <el-option label="已解决" value="resolved" />
            <el-option label="驳回" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理备注">
          <el-input v-model="reportForm.handleNote" type="textarea" placeholder="处理说明" />
        </el-form-item>
        <el-form-item label="执行操作" v-if="reportForm.status === 'resolved'">
          <el-checkbox v-model="reportForm.takeAction">同时删除/封禁被举报内容</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleProcessReport">提交处理</el-button>
      </template>
    </el-dialog>
    
    <!-- 角色修改对话框 -->
    <el-dialog v-model="roleDialogVisible" title="修改用户角色" width="400px">
      <el-form label-width="80px" v-if="editingUser">
        <el-form-item label="用户">
          <span>{{ editingUser.nickname || editingUser.username }}</span>
        </el-form-item>
        <el-form-item label="当前角色">
          <el-tag :type="getRoleTagType(editingUser.role)">{{ getRoleName(editingUser.role) }}</el-tag>
        </el-form-item>
        <el-form-item label="新角色">
          <el-select v-model="selectedRole" style="width: 100%">
            <el-option label="普通用户" value="user" />
            <el-option label="审核员" value="reviewer" />
            <el-option label="版主" value="moderator" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="updateUserRole">确认修改</el-button>
      </template>
    </el-dialog>
    
    <!-- 公告编辑对话框 -->
    <el-dialog v-model="announcementDialogVisible" :title="editingAnnouncement ? '编辑公告' : '发布公告'" width="600px">
      <el-form :model="announcementForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="announcementForm.title" placeholder="公告标题" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="announcementForm.content" type="textarea" :rows="5" placeholder="公告内容" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="announcementForm.type">
            <el-radio label="normal">普通</el-radio>
            <el-radio label="important">重要</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="announcementForm.status">
            <el-radio label="active">显示</el-radio>
            <el-radio label="inactive">隐藏</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="announcementDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveAnnouncement">保存</el-button>
      </template>
    </el-dialog>
    
    <!-- 敏感词编辑对话框 -->
    <el-dialog v-model="sensitiveDialogVisible" :title="editingSensitiveWord ? '编辑敏感词' : '添加敏感词'" width="450px">
      <el-form :model="sensitiveForm" label-width="80px">
        <el-form-item label="敏感词">
          <el-input v-model="sensitiveForm.word" placeholder="敏感词" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="sensitiveForm.category" style="width: 100%">
            <el-option label="政治" value="politics" />
            <el-option label="色情" value="porn" />
            <el-option label="暴力" value="violence" />
            <el-option label="广告" value="ad" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="等级">
          <el-radio-group v-model="sensitiveForm.level">
            <el-radio label="low">低</el-radio>
            <el-radio label="medium">中</el-radio>
            <el-radio label="high">高</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="替换词">
          <el-input v-model="sensitiveForm.replacement" placeholder="可选，留空则用***替换" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sensitiveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveSensitiveWord">保存</el-button>
      </template>
    </el-dialog>
    
    <!-- 批量导入敏感词对话框 -->
    <el-dialog v-model="sensitiveImportDialogVisible" title="批量导入敏感词" width="500px">
      <el-form label-width="80px">
        <el-form-item label="分类">
          <el-select v-model="importCategory" style="width: 100%">
            <el-option label="政治" value="politics" />
            <el-option label="色情" value="porn" />
            <el-option label="暴力" value="violence" />
            <el-option label="广告" value="ad" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="等级">
          <el-radio-group v-model="importLevel">
            <el-radio label="low">低</el-radio>
            <el-radio label="medium">中</el-radio>
            <el-radio label="high">高</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="敏感词">
          <el-input v-model="importWords" type="textarea" :rows="8" placeholder="每行一个敏感词" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sensitiveImportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleBatchImportSensitiveWords">导入</el-button>
      </template>
    </el-dialog>
    
    <!-- 日志详情对话框 -->
    <el-dialog v-model="logDetailDialogVisible" title="操作详情" width="500px">
      <pre style="white-space: pre-wrap; word-break: break-all; background: #f5f5f5; padding: 16px; border-radius: 8px;">{{ logDetailContent }}</pre>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { adminApi } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataAnalysis, User, UserFilled, Document, Download, Search, Picture, ChatDotRound, Warning, Lock, Bell, Filter, Setting, List, Key, OfficeBuilding, Loading, Cpu, Postcard, Monitor } from '@element-plus/icons-vue'
import Posts from './admin/Posts.vue'

const router = useRouter()
const userStore = useUserStore()

const activeMenu = ref('dashboard')
const loadingStats = ref(false)
const loadingUsers = ref(false)
const loadingWorks = ref(false)
const loadingComments = ref(false)
const loadingReports = ref(false)
const loadingBanners = ref(false)
const loadingIpBans = ref(false)
const crawling = ref(false)
const crawlingHot = ref(false)
const crawlingUser = ref(false)
const crawlingPosts = ref(false)
const recalibrating = ref(false)

const userDetailVisible = ref(false)
const userDetailLoading = ref(false)
const userDetail = ref(null)
const passwordDialogVisible = ref(false)
const passwordLoading = ref(false)
const passwordForm = ref({ newPassword: '', confirmPassword: '' })
const notificationDialogVisible = ref(false)
const batchNotificationDialogVisible = ref(false)
const notificationLoading = ref(false)
const notificationForm = ref({ title: '', content: '', targetUser: null, targetUsers: null, isAll: false })
const selectedUserIds = ref([])

const chartRef = ref(null)

const stats = ref({ 
  userCount: 0, workCount: 0, commentCount: 0, 
  todayUsers: 0, todayWorks: 0, todayComments: 0,
  pendingReports: 0, activeIpBans: 0, featuredWorks: 0, 
  disabledUsers: 0, newUsersWeek: 0, newWorksWeek: 0 
})

const users = ref([])
const userSearch = ref('')
const userPage = ref(1)
const userPageSize = ref(20)
const userTotal = ref(0)
const userRoleFilter = ref('')
const userStatusFilter = ref('')

const works = ref([])
const workSearch = ref('')
const workPage = ref(1)
const workPageSize = ref(20)
const workTotal = ref(0)
const workTypeFilter = ref('')
const workFeaturedFilter = ref('')

const comments = ref([])
const commentSearch = ref('')
const commentPage = ref(1)
const commentPageSize = ref(20)
const commentTotal = ref(0)
const commentStatusFilter = ref('')
const commentUserId = ref('')
const commentWorkId = ref('')

const reports = ref([])
const reportPage = ref(1)
const reportPageSize = ref(20)
const reportTotal = ref(0)
const reportTypeFilter = ref('')
const reportStatusFilter = ref('')
const editingReport = ref(null)
const reportDialogVisible = ref(false)
const reportForm = ref({ status: 'processing', handleNote: '', takeAction: false })
const aiReviewLoading = ref(false)
const aiReviewResult = ref(null)
const selectedReports = ref([])
const batchAILoading = ref(false)
const autoHandleLoading = ref(false)

const handleReportSelection = (selection) => {
  selectedReports.value = selection
}

const quickAIReview = async (row) => {
  row.aiLoading = true
  try {
    const res = await fetch(`/api/admin/ai/review/${row.id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userStore.token}` }
    }).then(r => r.json())
    if (res.code === 200) {
      row.aiResult = res.data
    } else {
      ElMessage.error(res.msg || 'AI审核失败')
    }
  } catch (e) {
    ElMessage.error('AI审核请求失败')
  } finally {
    row.aiLoading = false
  }
}

const batchAIReview = async () => {
  if (selectedReports.value.length === 0) return
  batchAILoading.value = true
  let success = 0
  for (const row of selectedReports.value) {
    try {
      const res = await fetch(`/api/admin/ai/review/${row.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userStore.token}` }
      }).then(r => r.json())
      if (res.code === 200) {
        row.aiResult = res.data
        success++
      }
    } catch (e) {}
  }
  batchAILoading.value = false
  ElMessage.success(`批量审核完成，成功 ${success}/${selectedReports.value.length}`)
}

const quickHandle = async (row, action) => {
  const actionText = action === 'delete' ? '删除内容' : '驳回举报'
  try {
    await ElMessageBox.confirm(`确定要${actionText}吗？`, '确认操作')
    const res = await fetch(`/api/admin/reports/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
      body: JSON.stringify({
        status: action === 'delete' ? 'resolved' : 'rejected',
        handleNote: action === 'delete' ? 'AI审核建议删除' : 'AI审核建议通过',
        takeAction: action === 'delete'
      })
    }).then(r => r.json())
    if (res.code === 200) {
      ElMessage.success('处理成功')
      fetchReports()
    } else {
      ElMessage.error(res.msg || '处理失败')
    }
  } catch (e) {}
}

const autoHandleByAI = async () => {
  const pendingWithAI = reports.value.filter(r => r.aiResult && r.status === 'pending')
  if (pendingWithAI.length === 0) {
    ElMessage.warning('没有已审核且待处理的举报')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `将处理 ${pendingWithAI.length} 条举报：\n高风险/中风险 → 删除内容\n低风险 → 驳回举报`,
      '确认一键处理'
    )
    
    autoHandleLoading.value = true
    let success = 0
    
    for (const row of pendingWithAI) {
      const isHighOrMedium = row.aiResult.riskLevel === 'high' || row.aiResult.riskLevel === 'medium'
      const action = isHighOrMedium ? 'delete' : 'reject'
      
      try {
        const res = await fetch(`/api/admin/reports/${row.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userStore.token}` },
          body: JSON.stringify({
            status: action === 'delete' ? 'resolved' : 'rejected',
            handleNote: `AI审核: ${row.aiResult.reason}`,
            takeAction: action === 'delete'
          })
        }).then(r => r.json())
        if (res.code === 200) success++
      } catch (e) {}
    }
    
    autoHandleLoading.value = false
    ElMessage.success(`处理完成，成功 ${success}/${pendingWithAI.length}`)
    fetchReports()
  } catch (e) {
    autoHandleLoading.value = false
  }
}

const runAIReview = async () => {
  if (!editingReport.value) return
  aiReviewLoading.value = true
  try {
    const res = await fetch(`/api/admin/ai/review/${editingReport.value.id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userStore.token}` }
    }).then(r => r.json())
    if (res.code === 200) {
      aiReviewResult.value = res.data
    } else {
      ElMessage.error(res.msg || 'AI审核失败')
    }
  } catch (e) {
    ElMessage.error('AI审核请求失败')
  } finally {
    aiReviewLoading.value = false
  }
}

const reportStatusMap = { pending: 'warning', processing: 'primary', resolved: 'success', rejected: 'danger' }
const reportStatusText = { pending: '待处理', processing: '处理中', resolved: '已解决', rejected: '已驳回' }

const crawlWorkId = ref('')
const crawlUserId = ref('')
const crawlCount = ref(20)
const crawlKeyword = ref('精选')
const crawlResult = ref('')
const crawlResultType = ref('success')
const crawlLogs = ref([])
const crawlLogsRef = ref(null)
const currentTaskId = ref(null)

const studios = ref([])
const studiosPage = ref(1)
const studiosTotal = ref(0)
const loadingStudios = ref(false)
const studioDetailVisible = ref(false)
const studioDetailLoading = ref(false)
const studioDetail = ref(null)
const defaultStudioCover = 'https://via.placeholder.com/100x100?text=Studio'

const banners = ref([])
const bannerDialogVisible = ref(false)
const editingBanner = ref(null)
const crawlingBanners = ref(false)
const bannerForm = ref({
  title: '',
  image_url: '',
  link_url: '',
  sort_order: 0,
  status: 'active'
})

const ipBans = ref([])
const ipBanPage = ref(1)
const ipBanPageSize = ref(20)
const ipBanTotal = ref(0)
const ipBanDialogVisible = ref(false)
const ipBanForm = ref({ ip_address: '', reason: '', expires_at: null })

const roles = ref([])
const adminUsers = ref([])
const loadingAdminUsers = ref(false)
const roleDialogVisible = ref(false)
const editingUser = ref(null)
const selectedRole = ref('')

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const roleNames = {
  user: '普通用户',
  reviewer: '审核员',
  moderator: '版主',
  admin: '管理员',
  superadmin: '超级管理员'
}

const getRoleName = (role) => roleNames[role] || role

const getRoleTagType = (role) => {
  const types = {
    user: 'info',
    reviewer: 'primary',
    moderator: 'warning',
    admin: 'danger',
    superadmin: 'danger'
  }
  return types[role] || 'info'
}

const fetchRoles = async () => {
  try {
    const res = await adminApi.getRoles()
    if (res.code === 200) roles.value = res.data
  } catch (e) {}
}

const fetchAdminUsers = async () => {
  loadingAdminUsers.value = true
  try {
    const res = await adminApi.getAdminUsers()
    if (res.code === 200) adminUsers.value = res.data.list
  } catch (e) {}
  finally { loadingAdminUsers.value = false }
}

const showRoleDialog = (user) => {
  editingUser.value = user
  selectedRole.value = user.role
  roleDialogVisible.value = true
}

const updateUserRole = async () => {
  try {
    const res = await adminApi.updateUserRole(editingUser.value.id, selectedRole.value)
    if (res.code === 200) {
      ElMessage.success('角色更新成功')
      roleDialogVisible.value = false
      fetchAdminUsers()
    } else {
      ElMessage.error(res.msg || '更新失败')
    }
  } catch (e) {
    ElMessage.error('更新失败')
  }
}

// 公告管理
const announcements = ref([])
const loadingAnnouncements = ref(false)
const announcementDialogVisible = ref(false)
const editingAnnouncement = ref(null)
const announcementForm = ref({ title: '', content: '', type: 'normal', status: 'active' })

const fetchAnnouncements = async () => {
  loadingAnnouncements.value = true
  try {
    const res = await adminApi.getAnnouncements()
    if (res.code === 200) announcements.value = res.data.list
  } catch (e) {}
  finally { loadingAnnouncements.value = false }
}

const showAnnouncementDialog = (announcement = null) => {
  editingAnnouncement.value = announcement
  if (announcement) {
    announcementForm.value = { ...announcement }
  } else {
    announcementForm.value = { title: '', content: '', type: 'normal', status: 'active' }
  }
  announcementDialogVisible.value = true
}

const handleSaveAnnouncement = async () => {
  try {
    let res
    if (editingAnnouncement.value) {
      res = await adminApi.updateAnnouncement(editingAnnouncement.value.id, announcementForm.value)
    } else {
      res = await adminApi.createAnnouncement(announcementForm.value)
    }
    if (res.code === 200) {
      ElMessage.success('保存成功')
      announcementDialogVisible.value = false
      fetchAnnouncements()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const handleDeleteAnnouncement = async (announcement) => {
  try {
    await ElMessageBox.confirm('确定删除该公告吗？', '提示', { type: 'warning' })
    const res = await adminApi.deleteAnnouncement(announcement.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      fetchAnnouncements()
    }
  } catch (e) {}
}

// 敏感词管理
const sensitiveWords = ref([])
const loadingSensitiveWords = ref(false)
const sensitiveDialogVisible = ref(false)
const sensitiveImportDialogVisible = ref(false)
const editingSensitiveWord = ref(null)
const sensitiveForm = ref({ word: '', category: 'other', level: 'medium', replacement: '' })
const importCategory = ref('other')
const importLevel = ref('medium')
const importWords = ref('')

const fetchSensitiveWords = async () => {
  loadingSensitiveWords.value = true
  try {
    const res = await adminApi.getSensitiveWords()
    if (res.code === 200) sensitiveWords.value = res.data.list
  } catch (e) {}
  finally { loadingSensitiveWords.value = false }
}

const showSensitiveDialog = (word = null) => {
  editingSensitiveWord.value = word
  if (word) {
    sensitiveForm.value = { ...word }
  } else {
    sensitiveForm.value = { word: '', category: 'other', level: 'medium', replacement: '' }
  }
  sensitiveDialogVisible.value = true
}

const showSensitiveImportDialog = () => {
  importWords.value = ''
  sensitiveImportDialogVisible.value = true
}

const handleSaveSensitiveWord = async () => {
  try {
    let res
    if (editingSensitiveWord.value) {
      res = await adminApi.updateSensitiveWord(editingSensitiveWord.value.id, sensitiveForm.value)
    } else {
      res = await adminApi.addSensitiveWord(sensitiveForm.value)
    }
    if (res.code === 200) {
      ElMessage.success('保存成功')
      sensitiveDialogVisible.value = false
      fetchSensitiveWords()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const handleDeleteSensitiveWord = async (word) => {
  try {
    await ElMessageBox.confirm('确定删除该敏感词吗？', '提示', { type: 'warning' })
    const res = await adminApi.deleteSensitiveWord(word.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      fetchSensitiveWords()
    }
  } catch (e) {}
}

const handleBatchImportSensitiveWords = async () => {
  const words = importWords.value.split('\n').map(w => w.trim()).filter(w => w)
  if (words.length === 0) {
    ElMessage.warning('请输入敏感词')
    return
  }
  try {
    const res = await adminApi.batchImportSensitiveWords(words, importCategory.value, importLevel.value)
    if (res.code === 200) {
      ElMessage.success(res.msg)
      sensitiveImportDialogVisible.value = false
      fetchSensitiveWords()
    }
  } catch (e) {
    ElMessage.error('导入失败')
  }
}

// 系统设置
const showPromptHelp = ref(false)
const configForm = ref({
  site_name: '',
  site_description: '',
  site_keywords: '',
  contact_email: '',
  icp_number: '',
  ai_enabled: 'false',
  ai_api_url: '',
  ai_api_key: '',
  ai_model: 'gpt-3.5-turbo',
  ai_prompt: '',
  geetest_enabled: 'false',
  geetest_id: '',
  geetest_key: '',
  geetest_product: 'popup',
  geetest_login: 'false',
  geetest_register: 'false',
  geetest_like: 'false',
  geetest_comment: 'false',
  geetest_reply: 'false',
  geetest_report: 'false',
  geetest_publish_work: 'false',
  geetest_publish_post: 'false',
  geetest_favorite: 'false',
  geetest_update_profile: 'false',
  geetest_create_studio: 'false',
  geetest_join_studio: 'false',
  geetest_submit_work: 'false',
  geetest_review_member: 'false',
  hcaptcha_enabled: 'false',
  hcaptcha_site_key: '',
  hcaptcha_secret_key: '',
  hcaptcha_expire_minutes: '20',
  db_type: 'sqlite',
  mysql_host: '',
  mysql_port: '',
  mysql_database: '',
  mysql_username: '',
  mysql_password: ''
})
const loadingConfigs = ref(false)
const hcaptchaExpireMinutes = ref(20)
const captchaStats = ref(null)

// 数据库迁移
const migrationForm = ref({
  sourceType: 'sqlite',
  targetType: 'mysql',
  sourceConfig: {
    path: './database.sqlite',
    host: 'localhost',
    port: '3306',
    database: 'coding_dog',
    user: 'root',
    password: ''
  },
  targetConfig: {
    path: './database_new.sqlite',
    host: 'localhost',
    port: '3306',
    database: 'coding_dog',
    user: 'root',
    password: ''
  },
  clearExisting: false
})
const testingSource = ref(false)
const testingTarget = ref(false)
const migrating = ref(false)
const migrationResult = ref(null)

// 测试源数据库连接
const testSourceConnection = async () => {
  testingSource.value = true
  try {
    const res = await request.post('/admin/db-migration/test-connection', {
      dbType: migrationForm.value.sourceType,
      config: migrationForm.value.sourceConfig
    })
    if (res.code === 200) {
      ElMessage.success('源数据库连接成功！')
    } else {
      ElMessage.error(res.msg || '连接失败')
    }
  } catch (error) {
    ElMessage.error('连接失败：' + (error.message || '未知错误'))
  } finally {
    testingSource.value = false
  }
}

// 测试目标数据库连接
const testTargetConnection = async () => {
  testingTarget.value = true
  try {
    const res = await request.post('/admin/db-migration/test-connection', {
      dbType: migrationForm.value.targetType,
      config: migrationForm.value.targetConfig
    })
    if (res.code === 200) {
      ElMessage.success('目标数据库连接成功！')
    } else {
      ElMessage.error(res.msg || '连接失败')
    }
  } catch (error) {
    ElMessage.error('连接失败：' + (error.message || '未知错误'))
  } finally {
    testingTarget.value = false
  }
}

// 开始迁移
const startMigration = async () => {
  if (!migrationForm.value.sourceType || !migrationForm.value.targetType) {
    ElMessage.warning('请选择源数据库和目标数据库')
    return
  }
  
  const confirmMsg = migrationForm.value.clearExisting 
    ? '确定要执行数据库迁移吗？目标数据库的所有数据将被删除！' 
    : '确定要执行数据库迁移吗？'
  
  try {
    await ElMessageBox.confirm(confirmMsg, '确认迁移', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  
  migrating.value = true
  migrationResult.value = null
  
  try {
    const res = await request.post('/admin/db-migration/migrate', {
      sourceType: migrationForm.value.sourceType,
      sourceConfig: migrationForm.value.sourceConfig,
      targetType: migrationForm.value.targetType,
      targetConfig: migrationForm.value.targetConfig,
      clearExisting: migrationForm.value.clearExisting
    })
    
    if (res.code === 200) {
      ElMessage.success('数据库迁移成功！')
      migrationResult.value = res.data
    } else {
      ElMessage.error(res.msg || '迁移失败')
    }
  } catch (error) {
    ElMessage.error('迁移失败：' + (error.message || '未知错误'))
  } finally {
    migrating.value = false
  }
}

// 获取迁移统计
const getMigrationStats = async () => {
  loadingStats.value = true
  try {
    const res = await request.get('/admin/db-migration/stats', {
      params: {
        dbType: migrationForm.value.sourceType,
        ...migrationForm.value.sourceConfig
      }
    })
    if (res.code === 200) {
      migrationResult.value = res.data
      ElMessage.success('获取统计成功！')
    }
  } catch (error) {
    ElMessage.error('获取统计失败')
  } finally {
    loadingStats.value = false
  }
}

const geetestPassRate = computed(() => {
  if (!captchaStats.value?.geetest) return 0
  const { show = 0, pass = 0 } = captchaStats.value.geetest
  if (show === 0) return 0
  return ((pass / show) * 100).toFixed(1)
})

const hcaptchaPassRate = computed(() => {
  if (!captchaStats.value?.hcaptcha) return 0
  const { show = 0, pass = 0 } = captchaStats.value.hcaptcha
  if (show === 0) return 0
  return ((pass / show) * 100).toFixed(1)
})
const savingConfigs = ref(false)

const fetchConfigs = async () => {
  loadingConfigs.value = true
  try {
    const res = await adminApi.getConfigs()
    if (res.code === 200) {
      Object.keys(configForm.value).forEach(key => {
        if (res.data[key] !== undefined) {
          configForm.value[key] = res.data[key]
        }
      })
      if (res.data.hcaptcha_expire_minutes) {
        hcaptchaExpireMinutes.value = parseInt(res.data.hcaptcha_expire_minutes) || 20
      }
    }
  } catch (e) {}
  finally { loadingConfigs.value = false }
}

const fetchCaptchaStats = async () => {
  try {
    const res = await adminApi.getCaptchaStats(7)
    if (res.code === 200) {
      captchaStats.value = res.data
    }
  } catch (e) {
    console.error('获取验证码统计失败:', e)
  }
}

const DEFAULT_AI_PROMPT = `# 角色定义
你是一个专业的内容安全审核系统，具备以下能力：
- 识别违规内容类型
- 评估风险等级
- 提供处理建议

# 任务说明
你需要审核以下内容：

**审核类型**：{{type}}
**待审核内容**：
{{content}}

# 审核标准

| 类型 | 定义 | 示例 |
|------|------|------|
| 涉政 | 政治敏感、国家领导人、敏感事件 | 政治讨论、敏感言论 |
| 涉黄 | 色情、低俗、性暗示 | 色情描述、低俗图片 |
| 涉暴 | 暴力、血腥、恐怖 | 暴力描述、恐怖内容 |
| 涉赌 | 赌博、博彩推广 | 赌博网站、博彩信息 |
| 诈骗 | 虚假信息、欺诈诱导 | 虚假中奖、钓鱼链接 |
| 广告 | 商业推广、营销链接 | 微信推广、商业链接 |
| 辱骂 | 人身攻击、侮辱语言 | 脏话、人身攻击 |

**注意**：社区内分享自己的编程作品不算广告。

# 风险等级定义
- **low**：内容完全正常
- **medium**：轻微违规或疑似违规
- **high**：严重违规

# 处理建议定义
- **pass**：通过审核
- **review**：需人工复核
- **delete**：建议删除

# 输出格式【必须严格遵守】

你必须且只能输出一个合法的JSON对象，不要输出任何其他内容。

JSON格式如下：
\`\`\`json
{
  "riskLevel": "<low|medium|high>",
  "violations": ["<违规类型1>", "<违规类型2>"],
  "reason": "<判断理由>",
  "recommendation": "<pass|review|delete>",
  "confidence": <0.0-1.0之间的数字>
}
\`\`\`

# 审核示例

**示例1 - 正常内容**
输入内容：今天做了一个小游戏，欢迎大家来玩！
输出：
{"riskLevel":"low","violations":[],"reason":"用户分享自己的编程作品，内容正常","recommendation":"pass","confidence":0.95}

**示例2 - 广告内容**
输入内容：加微信xxx免费领取课程，限时优惠！
输出：
{"riskLevel":"medium","violations":["广告"],"reason":"包含联系方式和推广信息","recommendation":"review","confidence":0.88}

**示例3 - 辱骂内容**
输入内容：你个傻X，滚蛋！
输出：
{"riskLevel":"high","violations":["辱骂"],"reason":"包含侮辱性语言","recommendation":"delete","confidence":0.96}

**示例4 - 多种违规**
输入内容：加群xxx看黄片，免费！
输出：
{"riskLevel":"high","violations":["涉黄","广告"],"reason":"涉及色情内容和推广信息","recommendation":"delete","confidence":0.98}

# 重要提醒
1. 只输出JSON，不要有任何其他文字
2. confidence必须是0到1之间的数字
3. violations数组为空时表示无违规
4. riskLevel和recommendation必须匹配`

const useDefaultPrompt = () => {
  configForm.value.ai_prompt = DEFAULT_AI_PROMPT
  ElMessage.success('已填充默认提示词')
}

const saveConfigs = async () => {
  savingConfigs.value = true
  try {
    const res = await adminApi.batchUpdateConfigs(configForm.value)
    if (res.code === 200) {
      ElMessage.success('保存成功')
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
  finally { savingConfigs.value = false }
}

const saveConfig = async () => {
  savingConfigs.value = true
  try {
    configForm.value.hcaptcha_expire_minutes = String(hcaptchaExpireMinutes.value)
    const res = await adminApi.batchUpdateConfigs({
      hcaptcha_enabled: configForm.value.hcaptcha_enabled,
      hcaptcha_site_key: configForm.value.hcaptcha_site_key,
      hcaptcha_secret_key: configForm.value.hcaptcha_secret_key,
      hcaptcha_expire_minutes: configForm.value.hcaptcha_expire_minutes
    })
    if (res.code === 200) {
      ElMessage.success('保存成功')
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
  finally { savingConfigs.value = false }
}

// 实时日志
const realtimeLogs = ref([])
const realtimeLogsRef = ref(null)
const loadingRealtimeLogs = ref(false)
const autoRefreshLogs = ref(false)
let logRefreshInterval = null

const fetchRealtimeLogs = async () => {
  loadingRealtimeLogs.value = true
  try {
    const lastLog = realtimeLogs.value[realtimeLogs.value.length - 1]
    const lastTime = lastLog?.time || null
    const res = await adminApi.getRealtimeLogs(lastTime, 200)
    if (res.code === 200) {
      if (res.data?.logs?.length > 0) {
        realtimeLogs.value = [...realtimeLogs.value, ...res.data.logs].slice(-500)
        nextTick(() => {
          if (realtimeLogsRef.value) {
            realtimeLogsRef.value.scrollTop = realtimeLogsRef.value.scrollHeight
          }
        })
      }
    }
  } catch (e) {
    console.error('获取实时日志失败:', e)
  } finally {
    loadingRealtimeLogs.value = false
  }
}

const toggleAutoRefresh = (val) => {
  if (val) {
    logRefreshInterval = setInterval(fetchRealtimeLogs, 2000)
  } else {
    if (logRefreshInterval) {
      clearInterval(logRefreshInterval)
      logRefreshInterval = null
    }
  }
}

const clearRealtimeLogs = async () => {
  try {
    const res = await adminApi.clearRealtimeLogs()
    if (res.code === 200) {
      realtimeLogs.value = []
      ElMessage.success('日志已清空')
    }
  } catch (e) {
    ElMessage.error('清空失败')
  }
}

// 操作日志
const operationLogs = ref([])
const loadingOperationLogs = ref(false)
const logPage = ref(1)
const logTotal = ref(0)
const logDetailDialogVisible = ref(false)
const logDetailContent = ref('')

const actionNames = {
  'update_user_password': '修改用户密码',
  'update_user': '更新用户信息',
  'update_user_status': '更新用户状态',
  'update_user_role': '更新用户角色',
  'update_user_level': '更新用户等级',
  'impersonate_user': '模拟登录用户',
  'delete_user': '删除用户',
  'view_user_detail': '查看用户详情',
  'update_work': '更新作品',
  'set_work_featured': '设置精选作品',
  'delete_work': '删除作品',
  'recalibrate_works': '重新校准作品',
  'create_banner': '创建轮播图',
  'update_banner': '更新轮播图',
  'delete_banner': '删除轮播图',
  'crawl_banners': '爬取轮播图',
  'update_comment_status': '更新评论状态',
  'delete_comment': '删除评论',
  'handle_report': '处理举报',
  'ai_review': 'AI审核',
  'ai_auto_handle_reports': 'AI自动处理举报',
  'add_ip_ban': '添加IP封禁',
  'remove_ip_ban': '移除IP封禁',
  'create_announcement': '创建公告',
  'update_announcement': '更新公告',
  'delete_announcement': '删除公告',
  'update_config': '更新系统配置',
  'batch_update_config': '批量更新配置',
  'add_sensitive_word': '添加敏感词',
  'update_sensitive_word': '更新敏感词',
  'delete_sensitive_word': '删除敏感词',
  'batch_import_sensitive_words': '批量导入敏感词',
  'update_role_permissions': '更新角色权限',
  'reset_role_permissions': '重置角色权限',
  'view_studio_detail': '查看工作室详情',
  'update_studio': '更新工作室',
  'update_studio_status': '更新工作室状态',
  'update_studio_points': '更新工作室积分',
  'delete_studio': '删除工作室',
  'update_studio_member': '更新工作室成员',
  'remove_studio_member': '移除工作室成员',
  'remove_studio_work': '移除工作室作品',
  'set_work_score': '设置作品分数',
  'send_notification': '发送通知',
  'send_batch_notifications': '批量发送通知',
  'send_all_notification': '全员发送通知',
  'delete_post': '删除帖子',
  'update_post': '更新帖子',
  'set_post_essence': '设置精华帖',
  'set_post_top': '设置置顶帖'
}

const targetTypeNames = {
  'user': '用户',
  'work': '作品',
  'banner': '轮播图',
  'comment': '评论',
  'report': '举报',
  'ip_ban': 'IP封禁',
  'announcement': '公告',
  'system_config': '系统配置',
  'sensitive_word': '敏感词',
  'role': '角色',
  'studio': '工作室',
  'studio_member': '工作室成员',
  'studio_work': '工作室作品',
  'notification': '通知',
  'post': '帖子'
}

const getActionName = (action) => actionNames[action] || action
const getTargetTypeName = (type) => targetTypeNames[type] || type

const fetchOperationLogs = async () => {
  loadingOperationLogs.value = true
  try {
    const res = await adminApi.getOperationLogs({ page: logPage.value })
    if (res.code === 200) {
      operationLogs.value = res.data.list
      logTotal.value = res.data.pagination?.total || 0
    }
  } catch (e) {}
  finally { loadingOperationLogs.value = false }
}

const showLogDetail = (log) => {
  try {
    logDetailContent.value = JSON.stringify(JSON.parse(log.details), null, 2)
  } catch (e) {
    logDetailContent.value = log.details || '无详情'
  }
  logDetailDialogVisible.value = true
}

// 权限管理
const rolePermissionsList = ref([])
const allPermissions = ref([])
const activeRoleTab = ref('reviewer')
const editingRole = ref({ name: '', level: 0, permissions: [] })

const permissionCategories = computed(() => {
  const categories = new Set()
  allPermissions.value.forEach(p => categories.add(p.category))
  return Array.from(categories)
})

const getPermissionsByCategory = (category) => {
  return allPermissions.value.filter(p => p.category === category)
}

const fetchRolePermissions = async () => {
  try {
    const [permRes, roleRes] = await Promise.all([
      adminApi.getPermissions(),
      adminApi.getRolePermissions()
    ])
    if (permRes.code === 200) allPermissions.value = permRes.data
    if (roleRes.code === 200) {
      rolePermissionsList.value = roleRes.data
      // 设置当前编辑的角色
      const currentRole = roleRes.data.find(r => r.key === activeRoleTab.value)
      if (currentRole) {
        editingRole.value = {
          name: currentRole.name,
          level: currentRole.level,
          permissions: [...currentRole.permissions]
        }
      }
    }
  } catch (e) {
    console.error('获取权限数据失败:', e)
  }
}

const handleRoleTabChange = (tabName) => {
  const role = rolePermissionsList.value.find(r => r.key === tabName)
  if (role) {
    editingRole.value = {
      name: role.name,
      level: role.level,
      permissions: [...role.permissions]
    }
  }
}

const saveRolePermissions = async () => {
  try {
    const res = await adminApi.updateRolePermissions(activeRoleTab.value, editingRole.value)
    if (res.code === 200) {
      ElMessage.success('权限保存成功')
      fetchRolePermissions()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const resetRolePermissions = async (role) => {
  try {
    await ElMessageBox.confirm('确定重置该角色的权限为默认值吗？', '提示', { type: 'warning' })
    const res = await adminApi.resetRolePermissions(role)
    if (res.code === 200) {
      ElMessage.success('权限已重置')
      fetchRolePermissions()
    }
  } catch (e) {}
}

const getTypeName = (workType) => {
  if (!workType) return '未分类'
  const type = workType.toUpperCase()
  const typeMap = {
    'KITTEN': 'Kitten',
    'NEMO': 'Nemo',
    'COCO': 'Coco',
    'WOOD': 'Wood',
    'BOX': 'Box',
    'BOX2': 'Box 2',
    'CODE_BLOCK': '代码岛',
    'PYTHON': 'Python',
    'SCRATCH': 'Scratch',
    'NEKO': 'Neko'
  }
  return typeMap[type] || workType
}

const formatDateTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const handleMenuSelect = (key) => {
  activeMenu.value = key
  if (key === 'dashboard') { fetchStats(); fetchTrends() }
  if (key === 'users') fetchUsers()
  if (key === 'works') fetchWorks()
  if (key === 'comments') fetchComments()
  if (key === 'posts') { /* Posts component handles its own data fetching */ }
  if (key === 'reports') fetchReports()
  if (key === 'banners') fetchBanners()
  if (key === 'ipbans') fetchIpBans()
  if (key === 'announcements') fetchAnnouncements()
  if (key === 'sensitive') fetchSensitiveWords()
  if (key === 'configs') fetchConfigs()
  if (key === 'logs') fetchOperationLogs()
  if (key === 'permissions') fetchRolePermissions()
}

const fetchStats = async () => {
  loadingStats.value = true
  try {
    const res = await adminApi.getStats()
    if (res.code === 200) stats.value = res.data
  } catch (e) {}
  loadingStats.value = false
}

const fetchTrends = async () => {
  try {
    const res = await adminApi.getTrends(7)
    if (res.code === 200) {
      await nextTick()
      renderChart(res.data)
    }
  } catch (e) {}
}

const renderChart = (data) => {
  if (!chartRef.value) return
  
  const canvas = document.createElement('canvas')
  canvas.width = chartRef.value.offsetWidth
  canvas.height = 300
  chartRef.value.innerHTML = ''
  chartRef.value.appendChild(canvas)
  
  const ctx = canvas.getContext('2d')
  const padding = 50
  const width = canvas.width - padding * 2
  const height = canvas.height - padding * 2
  
  const maxVal = Math.max(...data.users, ...data.works, ...data.comments, 10)
  const stepY = height / 5
  const stepX = width / (data.dates.length - 1)
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  ctx.strokeStyle = '#eee'
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    ctx.beginPath()
    ctx.moveTo(padding, padding + stepY * i)
    ctx.lineTo(canvas.width - padding, padding + stepY * i)
    ctx.stroke()
    
    ctx.fillStyle = '#999'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(Math.round(maxVal - (maxVal / 5) * i), padding - 10, padding + stepY * i + 4)
  }
  
  ctx.textAlign = 'center'
  data.dates.forEach((date, i) => {
    const x = padding + stepX * i
    ctx.fillText(date.slice(5), x, canvas.height - 20)
  })
  
  const drawLine = (values, color) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    values.forEach((val, i) => {
      const x = padding + stepX * i
      const y = padding + height - (val / maxVal) * height
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    
    values.forEach((val, i) => {
      const x = padding + stepX * i
      const y = padding + height - (val / maxVal) * height
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    })
  }
  
  drawLine(data.users, '#667eea')
  drawLine(data.works, '#f5576c')
  drawLine(data.comments, '#4facfe')
  
  ctx.font = '12px sans-serif'
  ctx.fillStyle = '#667eea'
  ctx.fillRect(canvas.width - 150, 10, 12, 12)
  ctx.fillStyle = '#333'
  ctx.textAlign = 'left'
  ctx.fillText('用户', canvas.width - 132, 20)
  
  ctx.fillStyle = '#f5576c'
  ctx.fillRect(canvas.width - 100, 10, 12, 12)
  ctx.fillStyle = '#333'
  ctx.fillText('作品', canvas.width - 82, 20)
  
  ctx.fillStyle = '#4facfe'
  ctx.fillRect(canvas.width - 50, 10, 12, 12)
  ctx.fillStyle = '#333'
  ctx.fillText('评论', canvas.width - 32, 20)
}

const searchUsers = () => { userPage.value = 1; fetchUsers() }
const fetchUsers = async () => {
  loadingUsers.value = true
  try {
    const res = await adminApi.getUsers({ 
      page: userPage.value, pageSize: userPageSize.value,
      keyword: userSearch.value, role: userRoleFilter.value, status: userStatusFilter.value
    })
    if (res.code === 200) { users.value = res.data.list; userTotal.value = res.data.pagination?.total || res.data.total || 0 }
  } catch (e) {}
  loadingUsers.value = false
}

const toggleUserRole = async (user) => {
  const newRole = user.role === 'admin' ? 'user' : 'admin'
  try {
    const res = await adminApi.updateUserRole(user.id, newRole)
    if (res.code === 200) { user.role = newRole; ElMessage.success('更新成功') }
  } catch (e) { ElMessage.error('更新失败') }
}

const toggleUserStatus = async (user) => {
  const newStatus = user.status === 'active' ? 'banned' : 'active'
  try {
    const res = await adminApi.updateUserStatus(user.id, newStatus)
    if (res.code === 200) { 
      user.status = newStatus
      ElMessage.success('更新成功')
      if (userDetail.value && userDetail.value.user.id === user.id) {
        userDetail.value.user.status = newStatus
      }
    }
  } catch (e) { ElMessage.error('更新失败') }
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

const showUserDetail = async (user) => {
  userDetailVisible.value = true
  userDetailLoading.value = true
  userDetail.value = null
  try {
    const res = await adminApi.getUserDetail(user.id)
    if (res.code === 200) {
      userDetail.value = res.data
    } else {
      ElMessage.error(res.msg || '获取用户详情失败')
    }
  } catch (e) {
    ElMessage.error('获取用户详情失败')
  }
  userDetailLoading.value = false
}

const showPasswordDialog = () => {
  passwordForm.value = { newPassword: '', confirmPassword: '' }
  passwordDialogVisible.value = true
}

const handleUpdatePassword = async () => {
  if (!passwordForm.value.newPassword) {
    ElMessage.warning('请输入新密码')
    return
  }
  if (passwordForm.value.newPassword.length < 6) {
    ElMessage.warning('密码长度至少6位')
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  passwordLoading.value = true
  try {
    const res = await adminApi.updateUserPassword(userDetail.value.user.id, passwordForm.value.newPassword)
    if (res.code === 200) {
      ElMessage.success('密码修改成功')
      passwordDialogVisible.value = false
    } else {
      ElMessage.error(res.msg || '修改失败')
    }
  } catch (e) {
    ElMessage.error('修改失败')
  }
  passwordLoading.value = false
}

const showSendNotificationDialog = () => {
  notificationForm.value = { title: '', content: '', targetUser: userDetail.value.user, targetUsers: null, isAll: false }
  notificationDialogVisible.value = true
}

const showBatchNotificationDialog = () => {
  notificationForm.value = { title: '', content: '', targetUser: null, targetUsers: null, isAll: false }
  selectedUserIds.value = []
  batchNotificationDialogVisible.value = true
}

const showAllUsersNotificationDialog = () => {
  notificationForm.value = { title: '', content: '', targetUser: null, targetUsers: null, isAll: true }
  batchNotificationDialogVisible.value = false
  notificationDialogVisible.value = true
}

const selectAllUsers = () => {
  selectedUserIds.value = users.value.map(u => u.id)
}

const clearSelectedUsers = () => {
  selectedUserIds.value = []
}

const handleUserSelection = (selection) => {
  selectedUserIds.value = selection.map(u => u.id)
}

const handleSendNotification = async () => {
  if (!notificationForm.value.title) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!notificationForm.value.content) {
    ElMessage.warning('请输入内容')
    return
  }
  
  notificationLoading.value = true
  try {
    let res
    if (notificationForm.value.isAll) {
      res = await adminApi.sendAllUsersNotification(notificationForm.value.title, notificationForm.value.content)
    } else if (notificationForm.value.targetUser) {
      res = await adminApi.sendUserNotification(notificationForm.value.targetUser.id, notificationForm.value.title, notificationForm.value.content)
    } else {
      res = await adminApi.sendBatchNotifications(selectedUserIds.value, notificationForm.value.title, notificationForm.value.content)
    }
    
    if (res.code === 200) {
      ElMessage.success(res.msg || '发送成功')
      notificationDialogVisible.value = false
      batchNotificationDialogVisible.value = false
    } else {
      ElMessage.error(res.msg || '发送失败')
    }
  } catch (e) {
    ElMessage.error('发送失败')
  }
  notificationLoading.value = false
}

const handleBatchNotification = async () => {
  if (selectedUserIds.value.length === 0) {
    ElMessage.warning('请选择用户')
    return
  }
  if (!notificationForm.value.title) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!notificationForm.value.content) {
    ElMessage.warning('请输入内容')
    return
  }
  
  notificationLoading.value = true
  try {
    const res = await adminApi.sendBatchNotifications(selectedUserIds.value, notificationForm.value.title, notificationForm.value.content)
    if (res.code === 200) {
      ElMessage.success(res.msg || '发送成功')
      batchNotificationDialogVisible.value = false
    } else {
      ElMessage.error(res.msg || '发送失败')
    }
  } catch (e) {
    ElMessage.error('发送失败')
  }
  notificationLoading.value = false
}

const searchWorks = () => { workPage.value = 1; fetchWorks() }
const fetchWorks = async () => {
  loadingWorks.value = true
  try {
    const res = await adminApi.getWorks({ 
      page: workPage.value, pageSize: workPageSize.value,
      keyword: workSearch.value, type: workTypeFilter.value, isFeatured: workFeaturedFilter.value
    })
    if (res.code === 200) { works.value = res.data.list; workTotal.value = res.data.pagination?.total || res.data.total || 0 }
  } catch (e) {}
  loadingWorks.value = false
}

const recalibrateWorks = async () => {
  try {
    await ElMessageBox.confirm('确定要重新校准全站作品数据吗？这可能需要一些时间。', '提示', { type: 'warning' })
    recalibrating.value = true
    const res = await adminApi.recalibrateWorks()
    if (res.code === 200) {
      ElMessage.success(res.data?.msg || '校准完成')
      fetchWorks()
    } else {
      ElMessage.error(res.msg || '校准失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Recalibrate Error:', e)
      ElMessage.error('操作失败')
    }
  } finally {
    recalibrating.value = false
  }
}

const toggleWorkFeatured = async (work) => {
  try {
    const res = await adminApi.setWorkFeatured(work.id, !work.is_featured)
    if (res.code === 200) { work.is_featured = !work.is_featured; ElMessage.success(res.msg) }
  } catch (e) { ElMessage.error('操作失败') }
}

const handleDeleteWork = async (work) => {
  try {
    await ElMessageBox.confirm('确定删除该作品？', '提示', { type: 'warning' })
    const res = await adminApi.deleteWork(work.id)
    if (res.code === 200) { fetchWorks(); ElMessage.success('删除成功') }
  } catch (e) {}
}

const searchComments = () => { commentPage.value = 1; fetchComments() }
const fetchComments = async () => {
  loadingComments.value = true
  try {
    const res = await adminApi.getComments({ 
      page: commentPage.value, pageSize: commentPageSize.value,
      keyword: commentSearch.value, status: commentStatusFilter.value,
      userId: commentUserId.value, workId: commentWorkId.value
    })
    if (res.code === 200) { comments.value = res.data.list; commentTotal.value = res.data.pagination?.total || res.data.total || 0 }
  } catch (e) {}
  loadingComments.value = false
}

const toggleCommentStatus = async (comment) => {
  const newStatus = comment.status === 'active' ? 'hidden' : 'active'
  try {
    const res = await adminApi.updateCommentStatus(comment.id, newStatus)
    if (res.code === 200) { comment.status = newStatus; ElMessage.success('更新成功') }
  } catch (e) { ElMessage.error('更新失败') }
}

const handleDeleteComment = async (comment) => {
  try {
    await ElMessageBox.confirm('确定删除该评论？', '提示', { type: 'warning' })
    const res = await adminApi.deleteComment(comment.id)
    if (res.code === 200) { fetchComments(); ElMessage.success('删除成功') }
  } catch (e) {}
}

const searchReports = () => { reportPage.value = 1; fetchReports() }
const fetchReports = async () => {
  loadingReports.value = true
  try {
    const res = await adminApi.getReports({ 
      page: reportPage.value, pageSize: reportPageSize.value,
      type: reportTypeFilter.value, status: reportStatusFilter.value
    })
    if (res.code === 200) { reports.value = res.data.list; reportTotal.value = res.data.pagination?.total || res.data.total || 0 }
  } catch (e) {}
  loadingReports.value = false
}

const showReportDialog = (report) => {
  editingReport.value = report
  reportForm.value = { status: 'processing', handleNote: '', takeAction: false }
  aiReviewResult.value = null
  reportDialogVisible.value = true
}

const handleProcessReport = async () => {
  try {
    const res = await adminApi.handleReport(editingReport.value.id, reportForm.value)
    if (res.code === 200) {
      ElMessage.success('处理成功')
      reportDialogVisible.value = false
      fetchReports()
      fetchStats()
    }
  } catch (e) { ElMessage.error('处理失败') }
}

const fetchBanners = async () => {
  loadingBanners.value = true
  try {
    const res = await adminApi.getBanners()
    if (res.code === 200) banners.value = res.data
  } catch (e) {}
  loadingBanners.value = false
}

const showBannerDialog = (banner = null) => {
  editingBanner.value = banner
  if (banner) {
    bannerForm.value = { ...banner, is_active: banner.status === 'active' }
  } else {
    bannerForm.value = { title: '', image_url: '', link_url: '', sort_order: 0, is_active: true }
  }
  bannerDialogVisible.value = true
}

const handleSaveBanner = async () => {
  try {
    const data = { ...bannerForm.value, status: bannerForm.value.is_active ? 'active' : 'inactive' }
    let res
    if (editingBanner.value) {
      res = await adminApi.updateBanner(editingBanner.value.id, data)
    } else {
      res = await adminApi.createBanner(data)
    }
    if (res.code === 200) {
      ElMessage.success('保存成功')
      bannerDialogVisible.value = false
      fetchBanners()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) { ElMessage.error('保存失败') }
}

const handleDeleteBanner = async (banner) => {
  try {
    await ElMessageBox.confirm('确定删除该轮播图？', '提示', { type: 'warning' })
    const res = await adminApi.deleteBanner(banner.id)
    if (res.code === 200) { ElMessage.success('删除成功'); fetchBanners() }
  } catch (e) {}
}

const crawlBanners = async () => {
  try {
    await ElMessageBox.confirm('确定从编程猫爬取轮播图？这将覆盖现有的轮播图数据。', '提示', { type: 'warning' })
    crawlingBanners.value = true
    const res = await adminApi.crawlBanners()
    if (res.code === 200) {
      ElMessage.success(`成功爬取 ${res.data.count || 0} 个轮播图`)
      fetchBanners()
    } else {
      ElMessage.error(res.msg || '爬取失败')
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('爬取失败')
  } finally {
    crawlingBanners.value = false
  }
}

const fetchIpBans = async () => {
  loadingIpBans.value = true
  try {
    const res = await adminApi.getIpBans({ page: ipBanPage.value, pageSize: ipBanPageSize.value })
    if (res.code === 200) { ipBans.value = res.data.list; ipBanTotal.value = res.data.pagination?.total || res.data.total || 0 }
  } catch (e) {}
  loadingIpBans.value = false
}

const showIpBanDialog = () => {
  ipBanForm.value = { ip_address: '', reason: '', expires_at: null }
  ipBanDialogVisible.value = true
}

const handleAddIpBan = async () => {
  if (!ipBanForm.value.ip_address) {
    ElMessage.warning('请输入IP地址')
    return
  }
  try {
    const res = await adminApi.addIpBan(ipBanForm.value)
    if (res.code === 200) {
      ElMessage.success('封禁成功')
      ipBanDialogVisible.value = false
      fetchIpBans()
      fetchStats()
    } else {
      ElMessage.error(res.msg || '封禁失败')
    }
  } catch (e) { ElMessage.error('封禁失败') }
}

const handleRemoveIpBan = async (ipBan) => {
  try {
    await ElMessageBox.confirm('确定解除该IP封禁？', '提示', { type: 'warning' })
    const res = await adminApi.removeIpBan(ipBan.id)
    if (res.code === 200) { ElMessage.success('解封成功'); fetchIpBans(); fetchStats() }
  } catch (e) {}
}

const handleCrawlWork = async () => {
  if (!crawlWorkId.value) { ElMessage.warning('请输入作品ID'); return }
  crawling.value = true
  crawlResult.value = ''
  try {
    const res = await adminApi.crawlWork(parseInt(crawlWorkId.value))
    if (res.code === 200) {
      crawlResult.value = '爬取成功：' + res.data.name
      crawlResultType.value = 'success'
      ElMessage.success('爬取成功')
      crawlWorkId.value = ''
    } else {
      crawlResult.value = res.msg || '爬取失败'
      crawlResultType.value = 'error'
      ElMessage.error(res.msg)
    }
  } catch (e) {
    crawlResult.value = '爬取失败'
    crawlResultType.value = 'error'
    ElMessage.error('爬取失败')
  }
  crawling.value = false
}

const handleCrawlUser = async () => {
  if (!crawlUserId.value) { ElMessage.warning('请输入用户ID'); return }
  crawlingUser.value = true
  crawlResult.value = ''
  try {
    const res = await adminApi.crawlUserWorks(parseInt(crawlUserId.value))
    if (res.code === 200) {
      crawlResult.value = res.msg
      crawlResultType.value = res.data?.total > 0 ? 'success' : 'warning'
      ElMessage.success(res.msg)
    } else {
      crawlResult.value = res.msg || '爬取失败'
      crawlResultType.value = 'error'
      ElMessage.error(res.msg)
    }
  } catch (e) {
    crawlResult.value = '爬取失败'
    crawlResultType.value = 'error'
    ElMessage.error('爬取失败')
  }
  crawlingUser.value = false
}

const handleCrawlHot = async () => {
  crawlingHot.value = true
  crawlResult.value = ''
  crawlLogs.value = []
  let logInterval = null
  try {
    const res = await adminApi.crawlHotWorks(crawlCount.value)
    if (res.code === 200) {
      crawlResult.value = res.msg
      crawlResultType.value = res.data?.total > 0 ? 'success' : 'warning'
      ElMessage.success(res.msg)
      if (res.data?.taskId) {
        currentTaskId.value = res.data.taskId
        logInterval = setInterval(async () => {
          try {
            const logRes = await adminApi.getCrawlLogs(res.data.taskId)
            if (logRes.code === 200 && logRes.data?.logs) {
              crawlLogs.value = logRes.data.logs
              nextTick(() => {
                if (crawlLogsRef.value) {
                  crawlLogsRef.value.scrollTop = crawlLogsRef.value.scrollHeight
                }
              })
              const lastLog = logRes.data.logs[logRes.data.logs.length - 1]
              if (lastLog?.type === 'complete' || lastLog?.type === 'error') {
                clearInterval(logInterval)
              }
            }
          } catch (e) {}
        }, 1000)
      }
    } else {
      crawlResult.value = res.msg || '爬取失败'
      crawlResultType.value = 'error'
      ElMessage.error(res.msg)
    }
  } catch (e) {
    crawlResult.value = '爬取失败'
    crawlResultType.value = 'error'
    ElMessage.error('爬取失败')
  }
  crawlingHot.value = false
}

const formatLogTime = (time) => {
  const d = new Date(time)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const handleCrawlPosts = async () => {
  crawlingPosts.value = true
  crawlResult.value = ''
  try {
    const res = await adminApi.crawlPostWorks(crawlKeyword.value)
    if (res.code === 200) {
      crawlResult.value = res.msg
      crawlResultType.value = res.data?.total > 0 ? 'success' : 'warning'
      ElMessage.success(res.msg)
    } else {
      crawlResult.value = res.msg || '爬取失败'
      crawlResultType.value = 'error'
      ElMessage.error(res.msg)
    }
  } catch (e) {
    crawlResult.value = '爬取失败'
    crawlResultType.value = 'error'
    ElMessage.error('爬取失败')
  }
  crawlingPosts.value = false
}

const fetchStudios = async () => {
  loadingStudios.value = true
  try {
    const res = await adminApi.getStudios({ page: studiosPage.value, pageSize: 20 })
    if (res.code === 200) {
      studios.value = res.data.list
      studiosTotal.value = res.data.total
    }
  } catch (e) {
    console.error('获取工作室列表失败:', e)
  }
  loadingStudios.value = false
}

const handleStudioStatus = async (row) => {
  const newStatus = row.status === 'active' ? 'inactive' : 'active'
  try {
    const res = await adminApi.updateStudioStatus(row.id, newStatus)
    if (res.code === 200) {
      row.status = newStatus
      ElMessage.success('状态已更新')
    } else {
      ElMessage.error(res.msg || '更新失败')
    }
  } catch (e) {
    ElMessage.error('更新失败')
  }
}

const showStudioDetail = async (row) => {
  studioDetailVisible.value = true
  studioDetailLoading.value = true
  studioDetail.value = null
  
  try {
    const res = await adminApi.getStudioDetail(row.id)
    if (res.code === 200) {
      studioDetail.value = res.data
    } else {
      ElMessage.error(res.msg || '获取工作室详情失败')
      studioDetailVisible.value = false
    }
  } catch (e) {
    ElMessage.error('获取工作室详情失败')
    studioDetailVisible.value = false
  } finally {
    studioDetailLoading.value = false
  }
}

const changeMemberRole = async (member) => {
  const roles = ['member', 'admin']
  const currentRole = member.role
  const newRole = currentRole === 'member' ? 'admin' : 'member'
  
  try {
    await ElMessageBox.confirm(`确定将 ${member.user?.nickname} 的角色从 ${currentRole === 'member' ? '成员' : '管理员'} 改为 ${newRole === 'member' ? '成员' : '管理员'} 吗？`, '确认', { type: 'warning' })
    
    const res = await adminApi.updateStudioMember(member.studio_id, member.user_id, { role: newRole })
    if (res.code === 200) {
      ElMessage.success('角色已更新')
      showStudioDetail({ id: member.studio_id })
    } else {
      ElMessage.error(res.msg || '更新失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('更新失败')
    }
  }
}

const removeMember = async (member) => {
  try {
    await ElMessageBox.confirm(`确定将 ${member.user?.nickname} 移出工作室吗？`, '确认', { type: 'warning' })
    
    const res = await adminApi.removeStudioMember(member.studio_id, member.user_id)
    if (res.code === 200) {
      ElMessage.success('成员已移除')
      showStudioDetail({ id: member.studio_id })
    } else {
      ElMessage.error(res.msg || '移除失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('移除失败')
    }
  }
}

const removeStudioWork = async (work) => {
  try {
    await ElMessageBox.confirm(`确定将作品"${work.name}"从工作室移除吗？`, '确认', { type: 'warning' })
    
    const res = await adminApi.removeStudioWork(studioDetail.value.studio.id, work.id)
    if (res.code === 200) {
      ElMessage.success('作品已移除')
      showStudioDetail({ id: studioDetail.value.studio.id })
    } else {
      ElMessage.error(res.msg || '移除失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('移除失败')
    }
  }
}

const handleDeleteStudio = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除工作室"${row.name}"吗？此操作不可恢复。`, '警告', { type: 'warning' })
    const res = await adminApi.deleteStudio(row.id)
    if (res.code === 200) {
      ElMessage.success('工作室已删除')
      fetchStudios()
    } else {
      ElMessage.error(res.msg || '删除失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  const adminRoles = ['reviewer', 'moderator', 'admin', 'superadmin']
  if (!userStore.isLoggedIn || !adminRoles.includes(userStore.user?.role)) {
    ElMessage.error('需要管理员权限')
    router.push('/')
    return
  }
  fetchStats()
  fetchTrends()
  if (userStore.user?.role === 'superadmin') {
    fetchRoles()
    fetchAdminUsers()
  }
})

watch(activeMenu, (newVal) => {
  if (newVal === 'security') {
    fetchCaptchaStats()
  }
  if (newVal === 'studios') {
    fetchStudios()
  }
})
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$sidebar-width: 200px;

.r-admin--page {
  min-height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

.r-admin--container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.r-admin--sidebar {
  width: $sidebar-width;
  background: #fff;
  border-right: 1px solid #eee;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  overflow-y: auto;
  z-index: 100;
  
  .r-admin--logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-bottom: 1px solid #eee;
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 1;
    
    .r-admin--logo_icon { font-size: 24px; }
    .r-admin--logo_text { font-size: 16px; font-weight: 600; }
  }
  
  .el-menu { border-right: none; }
}

.r-admin--main {
  flex: 1;
  margin-left: $sidebar-width;
  height: 100vh;
  overflow-y: auto;
  padding: 24px;
}

.r-admin--section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}

.r-admin--header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.r-admin--filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.r-admin--title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px;
}

.r-admin--stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  
  @media (max-width: 1400px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.r-admin--stat_card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 12px;
  
  .r-admin--stat_icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    
    &.r-admin--stat_icon_users { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    &.r-admin--stat_icon_works { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    &.r-admin--stat_icon_comments { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    &.r-admin--stat_icon_reports { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
    &.r-admin--stat_icon_featured { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); }
    &.r-admin--stat_icon_disabled { background: linear-gradient(135deg, #d299c2 0%, #fef9d7 100%); }
    &.r-admin--stat_icon_week { background: linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%); }
    &.r-admin--stat_icon_ipban { background: linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%); }
  }
  
  .r-admin--stat_info {
    display: flex;
    flex-direction: column;
    
    .r-admin--stat_num { font-size: 28px; font-weight: 600; }
    .r-admin--stat_label { font-size: 14px; color: #666; }
    .r-admin--stat_sub { font-size: 12px; color: #999; }
  }
}

.r-admin--chart_section {
  margin-top: 24px;
  
  h3 { font-size: 16px; margin: 0 0 16px; }
  
  .r-admin--chart {
    width: 100%;
    height: 300px;
    background: #f9f9f9;
    border-radius: 8px;
  }
}

.r-admin--user_cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.r-admin--user_avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}
.r-admin--user_name {
  font-weight: 500;
}
.r-admin--user_email {
  font-size: 12px;
  color: #999;
}
.r-admin--ai_result {
  margin-bottom: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.r-admin--work_cell {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .r-admin--work_cover { width: 60px; height: 36px; border-radius: 4px; object-fit: cover; }
  .r-admin--work_name { font-weight: 500; }
  .r-admin--work_author { font-size: 12px; color: #999; }
}

.r-admin--comment_content {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.r-admin--pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.r-admin--crawl_section {
  margin-bottom: 32px;
  
  h3 { font-size: 16px; margin: 0 0 12px; }
  
  .r-admin--crawl_desc { color: #666; margin: 0 0 12px; }
  
  .r-admin--crawl_form {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  
  .r-admin--crawl_result { margin-top: 16px; }
}

.r-admin--crawl_logs {
  margin-top: 24px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  
  .r-admin--crawl_logs_header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;
    
    h3 { margin: 0; font-size: 14px; }
  }
  
  .r-admin--crawl_logs_content {
    max-height: 300px;
    overflow-y: auto;
    padding: 12px;
    background: #1e1e1e;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
  }
  
  .r-admin--crawl_log_item {
    padding: 4px 0;
    display: flex;
    gap: 12px;
    color: #d4d4d4;
  }
  
  .r-admin--crawl_log_time {
    color: #6a9955;
    flex-shrink: 0;
  }
  
  .r-admin--crawl_log_msg { word-break: break-all; }
  
  .r-admin--crawl_log_success { color: #4ec9b0; }
  .r-admin--crawl_log_error { color: #f14c4c; }
  .r-admin--crawl_log_warn { color: #cca700; }
  .r-admin--crawl_log_start { color: #569cd6; }
  .r-admin--crawl_log_complete { color: #4ec9b0; font-weight: bold; }
}

.r-admin--prompt_actions {
  margin-bottom: 8px;
  display: flex;
  gap: 8px;
}

.r-admin--prompt_help {
  h4 { margin: 16px 0 8px; color: #333; font-size: 14px; }
  h4:first-child { margin-top: 0; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin: 4px 0; color: #666; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; color: #e6a23c; }
  pre { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
  p { color: #666; margin: 8px 0; }
}

.r-admin--realtime_logs {
  background: #1e1e1e;
  border-radius: 8px;
  height: 500px;
  overflow-y: auto;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  
  .r-admin--realtime_logs_empty {
    color: #666;
    text-align: center;
    padding: 40px;
  }
  
  .r-admin--realtime_log_item {
    padding: 4px 0;
    display: flex;
    gap: 12px;
    color: #d4d4d4;
    border-bottom: 1px solid #333;
    
    &:last-child { border-bottom: none; }
  }
  
  .r-admin--realtime_log_time {
    color: #6a9955;
    flex-shrink: 0;
    width: 80px;
  }
  
  .r-admin--realtime_log_level {
    flex-shrink: 0;
    width: 50px;
    font-weight: bold;
  }
  
  .r-admin--realtime_log_msg {
    word-break: break-all;
    flex: 1;
  }
  
  .r-admin--realtime_log_info { color: #d4d4d4; }
  .r-admin--realtime_log_warn { color: #cca700; }
  .r-admin--realtime_log_error { color: #f14c4c; }
}

.r-admin--realtime_logs_footer {
  margin-top: 12px;
  color: #666;
  font-size: 12px;
}

.r-admin--captcha-stats {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  
  .r-admin--stats-title {
    font-size: 16px;
    margin: 0 0 16px;
    color: #333;
  }
}

.r-admin--stat-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  
  h4 {
    margin: 0 0 12px;
    font-size: 15px;
    color: #333;
  }
  
  .r-admin--stat-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
    
    &:last-child { border-bottom: none; }
  }
  
  .r-admin--stat-label { color: #666; }
  
  .r-admin--stat-value {
    font-weight: 600;
    color: #333;
    
    &.success { color: #67c23a; }
    &.danger { color: #f56c6c; }
  }
}

.r-admin--user_detail {
  .r-admin--user_detail_header {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid #eee;
  }
  
  .r-admin--user_detail_avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .r-admin--user_detail_info {
    flex: 1;
    
    h3 {
      margin: 0 0 8px;
      font-size: 20px;
    }
    
    p {
      margin: 0 0 12px;
      color: #666;
    }
  }
  
  .r-admin--user_detail_tags {
    display: flex;
    gap: 8px;
  }
  
  .r-admin--user_detail_actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
}

.r-admin--user_stats {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.r-admin--user_stat {
  flex: 1;
  text-align: center;
  
  .r-admin--stat_value {
    display: block;
    font-size: 24px;
    font-weight: 600;
    color: #333;
  }
  
  .r-admin--stat_label {
    font-size: 12px;
    color: #999;
  }
}

.r-admin--token_info {
  margin-top: 20px;
  
  h4 {
    margin: 0 0 10px;
    font-size: 14px;
    color: #666;
  }
}

:deep(.el-table) {
  .el-button + .el-button {
    margin-left: 8px;
  }
}
</style>
