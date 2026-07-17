<template>
  <div class="r-studio-detail--page">
    <div class="r-studio-detail--container" v-loading="loading">
      <div class="r-studio-detail--header" v-if="studio">
        <!-- 修复: 默认封面用工作室名称首字艺术字,而非 emoji -->
        <div class="r-studio-detail--cover" :style="{ backgroundImage: (studio.cover || studio.cover_url) ? `url(${studio.cover || studio.cover_url})` : 'none' }">
          <div v-if="!studio.cover && !studio.cover_url" class="r-studio-detail--cover_placeholder">封面生成中</div>
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
            <span><i>⭐</i> {{ studio.points || 0 }} 管理积分</span>
            <span><i>🏆</i> {{ studio.total_score || 0 }} 作品评分</span>
          </div>
          <div class="r-studio-detail--actions">
            <template v-if="userStore.isLoggedIn">
              <template v-if="userRole && userMemberStatus === 'active'">
                <el-dropdown trigger="click" @command="handleCommand">
                  <el-button type="primary">工作室操作 ▾</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="manage" v-if="capabilities.length">管理工作室</el-dropdown-item>
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
                          <el-dropdown-item :command="studioWork.is_featured ? 'unfeature' : 'feature'">{{ studioWork.is_featured ? '取消推荐' : '设为推荐' }}</el-dropdown-item>
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
              <div
                v-for="member in members"
                :key="member.id"
                class="r-studio-detail--member_item"
                role="link"
                tabindex="0"
                @click="goUser(member.user || member)"
                @keydown.enter="goUser(member.user || member)"
              >
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
          <div class="r-studio-detail--cover_upload" @click="editCoverInput?.click()">
            <img v-if="editForm.cover" :src="editForm.cover" alt="工作室封面" />
            <span v-else>选择工作室封面图片</span>
            <el-button size="small" :loading="editCoverUploading">{{ editForm.cover ? '更换图片' : '上传图片' }}</el-button>
          </div>
          <input ref="editCoverInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="uploadEditCover" />
        </el-form-item>
        <el-form-item label="加入方式">
          <el-radio-group v-model="editForm.join_type">
            <el-radio label="public">自由加入</el-radio>
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
            <el-table-column prop="application_message" label="申请说明" min-width="180" show-overflow-tooltip />
            <el-table-column label="招募问答" min-width="240">
              <template #default="{ row }">
                <div v-for="(item, index) in (row.application_answers || [])" :key="index" class="r-studio-detail--application_answer">
                  <b>{{ item.question }}</b><span>{{ item.answer }}</span>
                </div>
                <span v-if="!row.application_answers?.length">-</span>
              </template>
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
            <el-table-column label="操作" width="280">
              <template #default="{ row }">
                <template v-if="row.memberRole !== 'owner'">
                  <el-button size="small" v-if="userRole === 'owner' && row.memberRole !== 'vice_owner'" @click="handleSetRole(row.id, row.memberRole === 'admin' ? 'member' : 'admin')">
                    {{ row.memberRole === 'admin' ? '设为成员' : '设为管理员' }}
                  </el-button>
                  <el-button v-if="userRole === 'owner'" size="small" @click="showPermissionDialog(row)">权限</el-button>
                  <el-button size="small" type="danger" @click="handleKickMember(row.id)">移除</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="邀请管理" v-if="can('invite_manage')">
          <div class="r-studio-detail--manage_toolbar"><el-input-number v-model="inviteForm.max_uses" :min="1" :max="100" /><span>可用次数</span><el-input-number v-model="inviteForm.expires_in_hours" :min="1" :max="720" /><span>有效小时</span><el-button type="primary" @click="handleCreateInvite">创建邀请</el-button></div>
          <el-table :data="invites" size="small"><el-table-column prop="code" label="邀请码" min-width="230" /><el-table-column label="使用" width="90"><template #default="{ row }">{{ row.used_count }}/{{ row.max_uses }}</template></el-table-column><el-table-column prop="status" label="状态" width="100" /><el-table-column label="操作" width="100"><template #default="{ row }"><el-button v-if="row.status === 'active'" size="small" type="danger" plain @click="handleRevokeInvite(row)">撤销</el-button></template></el-table-column></el-table>
        </el-tab-pane>
        <el-tab-pane label="公告与任务" v-if="can('announcement_manage') || can('task_manage')">
          <div v-if="can('announcement_manage')" class="r-studio-detail--manage_section"><h4>发布公告</h4><el-input v-model="announcementForm.title" maxlength="120" placeholder="公告标题" /><el-input v-model="announcementForm.content" type="textarea" :rows="3" maxlength="10000" placeholder="公告内容" /><el-button type="primary" @click="handleCreateAnnouncement">发布公告</el-button></div>
          <div v-if="can('task_manage')" class="r-studio-detail--manage_section"><h4>创建招募任务</h4><el-input v-model="taskForm.title" maxlength="120" placeholder="任务名称" /><el-input v-model="taskForm.needed_role" maxlength="80" placeholder="需要的角色，如美术、程序" /><el-input v-model="taskForm.description" type="textarea" :rows="3" placeholder="任务说明" /><el-button type="primary" @click="handleCreateTask">创建任务</el-button></div>
        </el-tab-pane>
        <el-tab-pane label="设置" v-if="can('profile_edit')">
          <el-form label-width="120px"><el-form-item label="人数上限"><el-input-number v-model="settingsForm.member_limit" :min="studio?.member_count || 1" :max="1000" /></el-form-item><el-form-item label="招募状态"><el-radio-group v-model="settingsForm.recruitment_status"><el-radio label="open">开放</el-radio><el-radio label="paused">暂停</el-radio></el-radio-group></el-form-item><el-form-item label="成员退出后作品"><el-radio-group v-model="settingsForm.leave_work_policy"><el-radio label="retain">保留</el-radio><el-radio label="remove">移除</el-radio></el-radio-group></el-form-item><el-form-item label="重申冷却（天）"><el-input-number v-model="settingsForm.application_cooldown_days" :min="0" :max="90" /></el-form-item><el-form-item label="招募问题"><el-input v-model="settingsForm.questions_text" type="textarea" :rows="4" placeholder="每行一个问题，最多 5 个" /></el-form-item><el-form-item v-if="can('im_bind')" label="IM 群 ID"><el-input v-model="settingsForm.im_group_id" maxlength="100" placeholder="绑定编程狗 IM 群聊 ID" /></el-form-item><el-form-item><el-button type="primary" @click="handleSaveSettings">保存设置</el-button></el-form-item></el-form>
        </el-tab-pane>
        <el-tab-pane label="成员黑名单" v-if="can('member_manage')">
          <div class="r-studio-detail--manage_toolbar">
            <el-input-number v-model="blacklistForm.user_id" :min="1" placeholder="用户 ID" />
            <el-input v-model="blacklistForm.reason" maxlength="500" placeholder="加入黑名单原因" />
            <el-button type="danger" @click="handleAddBlacklist">加入黑名单</el-button>
          </div>
          <el-table :data="blacklist" size="small">
            <el-table-column label="用户" min-width="160"><template #default="{ row }">{{ row.user?.nickname || row.user?.username || row.user_id }}</template></el-table-column>
            <el-table-column prop="reason" label="原因" min-width="220" />
            <el-table-column label="操作" width="110"><template #default="{ row }"><el-button size="small" type="danger" plain @click="handleRemoveBlacklist(row)">移出</el-button></template></el-table-column>
          </el-table>
          <el-empty v-if="!blacklist.length" description="暂无黑名单用户" />
        </el-tab-pane>
        <el-tab-pane label="日志与数据" v-if="can('log_view') || can('analytics_view')">
          <div v-if="analytics" class="r-studio-detail--analytics"><span>成员 <b>{{ analytics.members }}</b></span><span>待审成员 <b>{{ analytics.pending_members }}</b></span><span>作品 <b>{{ analytics.works }}</b></span><span>待审作品 <b>{{ analytics.pending_works }}</b></span><span>任务完成 <b>{{ analytics.completed_tasks }}/{{ analytics.tasks }}</b></span></div>
          <el-table v-if="can('log_view')" :data="operationLogs" size="small"><el-table-column prop="created_at" label="时间" width="170" /><el-table-column prop="operator.nickname" label="操作者" width="120" /><el-table-column prop="action" label="操作" min-width="180" /><el-table-column prop="reason" label="原因" min-width="160" /></el-table>
        </el-tab-pane>
        <el-tab-pane label="转让工作室" v-if="userRole === 'owner'">
          <el-alert title="转让后您将降为普通成员，新室长会立即获得全部权限。此操作需要再次完成安全验证。" type="warning" :closable="false" />
          <el-form label-width="100px" style="margin-top:16px"><el-form-item label="接任成员"><el-select v-model="transferForm.target_user_id" style="width:100%"><el-option v-for="m in members.filter(item => item.memberRole !== 'owner')" :key="m.id" :label="m.user?.nickname || m.user?.username" :value="m.user_id" /></el-select></el-form-item><el-form-item label="转让原因"><el-input v-model="transferForm.reason" maxlength="500" /></el-form-item><el-form-item label="输入名称确认"><el-input v-model="transferForm.confirm_name" :placeholder="studio?.name" /></el-form-item><el-form-item><el-button type="danger" @click="handleTransfer">确认转让</el-button></el-form-item></el-form>
        </el-tab-pane>
        <el-tab-pane label="公告" name="announcements">
          <div class="r-studio-detail--feed"><div v-for="item in announcements" :key="item.id" class="r-studio-detail--feed_item"><div><b>{{ item.title }}</b><el-tag v-if="item.is_pinned" size="small" type="warning">置顶</el-tag></div><p>{{ item.content }}</p><small>{{ item.author?.nickname || '工作室' }} · {{ formatDate(item.published_at) }}</small></div><el-empty v-if="!announcements.length" description="暂无公告" /></div>
        </el-tab-pane>
        <el-tab-pane v-if="userMemberStatus === 'active'" label="协作任务" name="tasks">
          <div class="r-studio-detail--feed"><div v-for="item in tasks" :key="item.id" class="r-studio-detail--feed_item"><div><b>{{ item.title }}</b><el-tag size="small">{{ item.status }}</el-tag></div><p>{{ item.description || '暂无说明' }}</p><small>需要：{{ item.needed_role || '不限' }} · 负责人：{{ item.assignee?.nickname || '待认领' }}</small><div class="r-studio-detail--task_actions"><el-button v-if="!item.assignee_id && item.status === 'open'" size="small" @click="handleTaskStatus(item, 'in_progress')">认领任务</el-button><el-button v-if="String(item.assignee_id) === String(userStore.user?.id) && item.status === 'in_progress'" size="small" type="primary" @click="handleTaskStatus(item, 'completed')">标记完成</el-button></div></div><el-empty v-if="!tasks.length" description="暂无协作任务" /></div>
        </el-tab-pane>
        <el-tab-pane v-if="userMemberStatus === 'active'" label="成员讨论" name="discussions">
          <div class="r-studio-detail--discussion_composer">
            <el-input v-model="discussionText" type="textarea" :rows="3" maxlength="2000" show-word-limit placeholder="仅工作室成员可见，分享进度、想法或协作事项" />
            <el-button type="primary" @click="handleCreateDiscussion">发送讨论</el-button>
          </div>
          <div class="r-studio-detail--feed">
            <div v-for="item in discussions" :key="item.id" class="r-studio-detail--feed_item">
              <div><b>{{ item.user?.nickname || item.user?.username }}</b><small>{{ formatDate(item.created_at) }}</small></div>
              <p>{{ item.content }}</p>
              <el-button v-if="String(item.user_id) === String(userStore.user?.id) || can('member_manage')" size="small" text type="danger" @click="handleDeleteDiscussion(item)">删除</el-button>
            </div>
            <el-empty v-if="!discussions.length" description="暂无成员讨论" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <el-dialog v-model="permissionDialogVisible" title="配置成员管理权限" width="620px">
      <el-checkbox-group v-model="permissionForm.permissions" class="r-studio-detail--permission_grid"><el-checkbox v-for="item in permissionOptions" :key="item.value" :label="item.value">{{ item.label }}</el-checkbox></el-checkbox-group>
      <template #footer><el-button @click="permissionDialogVisible = false">取消</el-button><el-button type="primary" @click="handleSavePermissions">保存权限</el-button></template>
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
import { uploadApi } from '@/api/upload'
import AppImage from '@/components/AppImage.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const studio = ref(null)
const members = ref([])
const works = ref([])
const announcements = ref([])
const tasks = ref([])
const discussions = ref([])
const discussionText = ref('')
const userRole = ref(null)
const userMemberStatus = ref(null)
const joinBlockedReason = ref(null)

const activeTab = ref('works')
const worksPage = ref(1)
const worksPageSize = ref(12)
const worksTotal = ref(0)

const editDialogVisible = ref(false)
const editLoading = ref(false)
const editCoverInput = ref(null)
const editCoverUploading = ref(false)
const editForm = reactive({ name: '', description: '', cover: '', join_type: 'apply' })

const uploadEditCover = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 5 * 1024 * 1024) return ElMessage.warning('封面不能超过 5MB')
  editCoverUploading.value = true
  try {
    const res = await uploadApi.image(file)
    editForm.cover = res.data?.url || ''
    if (!editForm.cover) throw new Error('图床未返回地址')
    ElMessage.success('封面上传成功')
  } catch (e) { ElMessage.error(e.response?.data?.msg || '封面上传失败') }
  finally { editCoverUploading.value = false }
}

const viceOwnerDialogVisible = ref(false)
const viceOwnerLoading = ref(false)
const viceOwnerForm = reactive({ user_id: null })

const manageDialogVisible = ref(false)
const pendingMembers = ref([])
const pendingWorks = ref([])
const capabilities = ref([])
const invites = ref([])
const operationLogs = ref([])
const analytics = ref(null)
const blacklist = ref([])
const blacklistForm = reactive({ user_id: null, reason: '' })
const inviteForm = reactive({ max_uses: 1, expires_in_hours: 72 })
const announcementForm = reactive({ title: '', content: '' })
const taskForm = reactive({ title: '', description: '', needed_role: '' })
const settingsForm = reactive({ member_limit: 100, recruitment_status: 'open', leave_work_policy: 'retain', application_cooldown_days: 7, questions_text: '', im_group_id: '' })
const transferForm = reactive({ target_user_id: null, reason: '', confirm_name: '' })
const permissionDialogVisible = ref(false)
const permissionForm = reactive({ memberId: null, permissions: [] })
const permissionOptions = [
  ['member_review','审核成员'],['member_manage','管理成员'],['role_manage','管理角色'],['work_review','审核作品'],['work_manage','管理作品'],['profile_edit','编辑资料'],['announcement_manage','发布公告'],['task_manage','管理任务'],['invite_manage','管理邀请'],['log_view','查看日志'],['analytics_view','查看数据'],['im_bind','绑定 IM 群']
].map(([value, label]) => ({ value, label }))
const can = permission => capabilities.value.includes(permission)

const submitWorkDialogVisible = ref(false)
const myWorks = ref([])
const myWorksLoading = ref(false)
const geetestDialog = ref(null)
const { geetestEnabled, fetchGeetestConfig } = useGeetestConfig()
const verifyScene = async (scene) => {
  if (!geetestEnabled(scene)) return {}
  return await geetestDialog.value?.show(scene)
}

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
      settingsForm.member_limit = Number(studio.value.member_limit || 100)
      settingsForm.recruitment_status = studio.value.recruitment_status || 'open'
      settingsForm.leave_work_policy = studio.value.leave_work_policy || 'retain'
      settingsForm.application_cooldown_days = Number(studio.value.application_cooldown_days || 0)
      settingsForm.questions_text = Array.isArray(studio.value.application_questions) ? studio.value.application_questions.join('\n') : ''
      settingsForm.im_group_id = studio.value.im_group_id || ''
      if (userMemberStatus.value === 'active') {
        studioApi.getCapabilities(route.params.id).then(result => { if (result.code === 200) capabilities.value = result.data.permissions || [] }).catch(() => {})
        studioApi.getTasks(route.params.id).then(result => { if (result.code === 200) tasks.value = result.data || [] }).catch(() => {})
        studioApi.getDiscussions(route.params.id).then(result => { if (result.code === 200) discussions.value = result.data || [] }).catch(() => {})
      } else capabilities.value = []
      studioApi.getAnnouncements(route.params.id).then(result => { if (result.code === 200) announcements.value = result.data || [] }).catch(() => {})
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
  return can('work_manage') || (studioWork.submitUser?.id === userStore.user.id && userRole.value === 'admin')
}

const handleWorkAction = (action, studioWork) => {
  if (action === 'up' || action === 'down') {
    toggleWorkStatus(studioWork, action)
  } else if (action === 'feature' || action === 'unfeature') {
    updateWorkDisplay(studioWork, action === 'feature')
  }
}

const updateWorkDisplay = async (studioWork, featured) => {
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.updateWorkDisplay(route.params.id, studioWork.studioWorkId || studioWork.id, { is_featured: featured, ...geetestData }); if (res.code === 200) { studioWork.is_featured = featured; ElMessage.success(featured ? '已设为推荐' : '已取消推荐') } } catch (e) { ElMessage.error(e.response?.data?.msg || '更新展示设置失败') }
}

const toggleWorkStatus = async (studioWork, action) => {
  const geetestData = await verifyScene('studio_management')
  if (!geetestData) return
  try {
    const res = await studioApi.toggleWorkStatus(route.params.id, studioWork.id, action, geetestData)
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
    let code = ''
    try { code = (await ElMessageBox.prompt('请输入室长发给您的邀请码', '邀请加入工作室', { inputValidator: value => String(value || '').trim().length >= 10 || '邀请码格式不正确' })).value.trim() } catch { return }
    const inviteGeetest = await verifyScene('studio_management'); if (!inviteGeetest) return
    try { const res = await studioApi.acceptInvite(code, inviteGeetest); if (res.code === 200) { ElMessage.success('已加入工作室'); await fetchStudio() } } catch (e) { ElMessage.error(e.response?.data?.msg || '邀请码无效') }
    return
  }
  let applicationMessage = ''
  const applicationAnswers = []
  if (studio.value.join_type === 'apply') {
    try { applicationMessage = (await ElMessageBox.prompt('简单介绍一下自己和想加入的原因', '申请加入工作室', { inputPlaceholder: '最多 500 字', inputValidator: value => String(value || '').trim().length >= 2 || '至少填写 2 个字' })).value.trim() } catch { return }
    for (const question of (studio.value.application_questions || [])) {
      try {
        const answer = (await ElMessageBox.prompt(question, '工作室招募问题', { inputPlaceholder: '请认真填写回答', inputValidator: value => String(value || '').trim().length >= 1 || '请填写回答' })).value.trim()
        applicationAnswers.push({ question, answer })
      } catch { return }
    }
  }
  const geetestData = await geetestDialog.value?.show('join_studio')
  if (!geetestData) return
  try {
    const res = await studioApi.joinStudio(route.params.id, { application_message: applicationMessage, application_answers: applicationAnswers, ...geetestData })
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
    const geetestData = await verifyScene('studio_management')
    if (!geetestData) return
    const res = await studioApi.leaveStudio(route.params.id, geetestData)
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
    const geetestData = await verifyScene('studio_management')
    if (!geetestData) return
    const res = await studioApi.updateStudio(route.params.id, { ...editForm, ...geetestData })
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
    const jobs = []
    if (can('member_review')) jobs.push(studioApi.getPendingMembers(route.params.id).then(r => { if (r.code === 200) pendingMembers.value = r.data }))
    if (can('work_review')) jobs.push(studioApi.getPendingWorks(route.params.id).then(r => { if (r.code === 200) pendingWorks.value = r.data }))
    if (can('invite_manage')) jobs.push(studioApi.getInvites(route.params.id).then(r => { if (r.code === 200) invites.value = r.data }))
    if (can('log_view')) jobs.push(studioApi.getLogs(route.params.id).then(r => { if (r.code === 200) operationLogs.value = r.data }))
    if (can('analytics_view')) jobs.push(studioApi.getAnalytics(route.params.id).then(r => { if (r.code === 200) analytics.value = r.data }))
    if (can('member_manage')) jobs.push(studioApi.getBlacklist(route.params.id).then(r => { if (r.code === 200) blacklist.value = r.data || [] }))
    await Promise.all(jobs)
  } catch (e) { ElMessage.error('加载管理数据失败') }
}

const handleCreateInvite = async () => {
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.createInvite(route.params.id, { ...inviteForm, ...geetestData }); if (res.code === 200) { ElMessage.success('邀请已创建'); await showManageDialog() } } catch (e) { ElMessage.error(e.response?.data?.msg || '创建邀请失败') }
}
const showPermissionDialog = row => { permissionForm.memberId = row.id; permissionForm.permissions = Array.isArray(row.permissions) ? [...row.permissions] : []; permissionDialogVisible.value = true }
const handleSavePermissions = async () => {
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.setMemberPermissions(route.params.id, permissionForm.memberId, permissionForm.permissions, geetestData); if (res.code === 200) { ElMessage.success('权限已保存'); permissionDialogVisible.value = false; await fetchStudio() } } catch (e) { ElMessage.error(e.response?.data?.msg || '保存权限失败') }
}
const handleRevokeInvite = async row => {
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.revokeInvite(route.params.id, row.id, geetestData); if (res.code === 200) { ElMessage.success('邀请已撤销'); await showManageDialog() } } catch (e) { ElMessage.error(e.response?.data?.msg || '撤销失败') }
}
const handleCreateAnnouncement = async () => {
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.createAnnouncement(route.params.id, { ...announcementForm, ...geetestData }); if (res.code === 200) { ElMessage.success('公告已发布'); announcementForm.title = ''; announcementForm.content = '' } } catch (e) { ElMessage.error(e.response?.data?.msg || '发布失败') }
}
const handleCreateTask = async () => {
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.createTask(route.params.id, { ...taskForm, ...geetestData }); if (res.code === 200) { ElMessage.success('任务已创建'); taskForm.title = ''; taskForm.description = ''; taskForm.needed_role = ''; await showManageDialog() } } catch (e) { ElMessage.error(e.response?.data?.msg || '创建任务失败') }
}
const handleTaskStatus = async (task, status) => {
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.updateTask(route.params.id, task.id, { status, ...geetestData }); if (res.code === 200) { ElMessage.success(res.msg); const refreshed = await studioApi.getTasks(route.params.id); if (refreshed.code === 200) tasks.value = refreshed.data || [] } } catch (e) { ElMessage.error(e.response?.data?.msg || '更新任务失败') }
}
const handleSaveSettings = async () => {
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  const applicationQuestions = settingsForm.questions_text.split('\n').map(item => item.trim()).filter(Boolean)
  if (applicationQuestions.length > 5) return ElMessage.warning('招募问题最多 5 个')
  try { const res = await studioApi.updateSettings(route.params.id, { ...settingsForm, application_questions: applicationQuestions, ...geetestData }); if (res.code === 200) { ElMessage.success('设置已保存'); await fetchStudio() } } catch (e) { ElMessage.error(e.response?.data?.msg || '保存设置失败') }
}
const handleAddBlacklist = async () => {
  if (!blacklistForm.user_id || blacklistForm.reason.trim().length < 2) return ElMessage.warning('请填写用户 ID 和至少 2 个字的原因')
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.addBlacklist(route.params.id, { ...blacklistForm, ...geetestData }); if (res.code === 200) { ElMessage.success(res.msg); blacklistForm.user_id = null; blacklistForm.reason = ''; await showManageDialog() } } catch (e) { ElMessage.error(e.response?.data?.msg || '加入黑名单失败') }
}
const handleRemoveBlacklist = async row => {
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.removeBlacklist(route.params.id, row.id, geetestData); if (res.code === 200) { ElMessage.success(res.msg); await showManageDialog() } } catch (e) { ElMessage.error(e.response?.data?.msg || '移出黑名单失败') }
}
const handleCreateDiscussion = async () => {
  if (!discussionText.value.trim()) return ElMessage.warning('请输入讨论内容')
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.createDiscussion(route.params.id, { content: discussionText.value.trim(), ...geetestData }); if (res.code === 200) { discussionText.value = ''; const refreshed = await studioApi.getDiscussions(route.params.id); if (refreshed.code === 200) discussions.value = refreshed.data || [] } } catch (e) { ElMessage.error(e.response?.data?.msg || '发送讨论失败') }
}
const handleDeleteDiscussion = async row => {
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.deleteDiscussion(route.params.id, row.id, geetestData); if (res.code === 200) discussions.value = discussions.value.filter(item => item.id !== row.id) } catch (e) { ElMessage.error(e.response?.data?.msg || '删除讨论失败') }
}
const handleTransfer = async () => {
  if (!transferForm.target_user_id || transferForm.reason.trim().length < 2 || transferForm.confirm_name !== studio.value?.name) return ElMessage.warning('请完整填写接任成员、原因，并准确输入工作室名称')
  try { await ElMessageBox.confirm('确认将工作室永久转让给该成员吗？', '高风险操作', { type: 'warning' }) } catch { return }
  const geetestData = await verifyScene('studio_management'); if (!geetestData) return
  try { const res = await studioApi.transferOwnership(route.params.id, { ...transferForm, ...geetestData }); if (res.code === 200) { ElMessage.success('工作室已转让'); manageDialogVisible.value = false; await fetchStudio() } } catch (e) { ElMessage.error(e.response?.data?.msg || '转让失败') }
}

const showViceOwnerDialog = () => {
  viceOwnerForm.user_id = studio.value.vice_owner_id || null
  viceOwnerDialogVisible.value = true
}

const handleSetViceOwner = async () => {
  viceOwnerLoading.value = true
  try {
    const geetestData = await verifyScene('studio_management')
    if (!geetestData) return
    const res = await studioApi.setViceOwner(route.params.id, viceOwnerForm.user_id, geetestData)
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
    const geetestData = await verifyScene('studio_management')
    if (!geetestData) return
    const res = await studioApi.dissolveStudio(route.params.id, geetestData)
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
  let reason = ''
  if (action === 'reject') {
    try {
      reason = (await ElMessageBox.prompt('请填写拒绝原因，申请人会收到通知', '拒绝成员申请', { inputValidator: value => String(value || '').trim().length >= 2 || '至少填写 2 个字' })).value.trim()
    } catch { return }
  }
  let geetestData = {}
  if (geetestEnabled('review_member')) {
    geetestData = await geetestDialog.value?.show('review_member')
    if (!geetestData) return
  }
  try {
    const res = await studioApi.reviewMember(route.params.id, memberId, action, reason, geetestData)
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
  let reason = ''
  if (action === 'reject') {
    try {
      reason = (await ElMessageBox.prompt('请填写拒绝原因，投稿人会收到通知', '拒绝作品投稿', { inputValidator: value => String(value || '').trim().length >= 2 || '至少填写 2 个字' })).value.trim()
    } catch { return }
  }
  const geetestData = await verifyScene('studio_management')
  if (!geetestData) return
  try {
    const res = await studioApi.reviewWork(route.params.id, workId, action, reason, geetestData)
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
  const geetestData = await verifyScene('studio_management')
  if (!geetestData) return
  try {
    const res = await studioApi.setMemberRole(route.params.id, memberId, role, geetestData)
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
    const geetestData = await verifyScene('studio_management')
    if (!geetestData) return
    const res = await studioApi.kickMember(route.params.id, memberId, geetestData)
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

onMounted(() => {
  fetchGeetestConfig()
  fetchStudio()
})
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$primary-hover: #FFD700;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;
$white: #fff;
$border-color: #eee;

.r-studio-detail--manage_toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.r-studio-detail--manage_section { display: grid; gap: 10px; padding: 14px; margin-bottom: 14px; border: 1px solid #f0e5c7; border-radius: 12px; background: #fffaf0; }
.r-studio-detail--manage_section h4 { margin: 0; color: #182033; }
.r-studio-detail--analytics { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 16px; }
.r-studio-detail--analytics span { padding: 12px; border: 1px solid #eee3c8; border-radius: 10px; background: #fffaf0; }
.r-studio-detail--feed { display: grid; gap: 12px; }
.r-studio-detail--feed_item { padding: 16px; border: 1px solid rgba(254,196,51,.32); border-radius: 14px; background: rgba(255,255,255,.86); }
.r-studio-detail--feed_item > div { display: flex; align-items: center; gap: 8px; }
.r-studio-detail--feed_item p { white-space: pre-wrap; color: #505a6b; }
.r-studio-detail--feed_item small { color: #8b95a7; }
.r-studio-detail--task_actions { margin-top: 10px; }
.r-studio-detail--permission_grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }

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
.r-studio-detail--member_item { cursor:pointer; transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease; }
.r-studio-detail--member_item:hover,.r-studio-detail--member_item:focus-visible { transform:translateY(-3px); border-color:#f2c54a; box-shadow:0 12px 28px rgba(39,55,82,.1); outline:none; }
.r-studio-detail--member_item .r-studio-detail--member_avatar { box-shadow:0 0 0 3px #fff,0 5px 13px rgba(35,48,70,.12); }
.r-studio-detail--my_work_item { border-color:#e5eaf1; border-radius:14px; }
.r-studio-detail--my_work_item:hover { transform:translateY(-3px); box-shadow:0 10px 24px rgba(39,55,82,.1); }
:deep(.el-dialog) { border-radius:20px!important; }
:deep(.el-dialog__header) { padding:22px 24px 16px; }
:deep(.el-dialog__body) { padding:20px 24px; }
@media(max-width:800px){.r-studio-detail--page{padding:20px 14px 56px}.r-studio-detail--header{align-items:flex-start;flex-direction:column;padding:20px}.r-studio-detail--header .r-studio-detail--cover{width:100%;height:auto;aspect-ratio:16/7}.r-studio-detail--header .r-studio-detail--info .r-studio-detail--stats{gap:7px}.r-studio-detail--tabs{padding:0 14px 20px}.r-studio-detail--member_list{grid-template-columns:repeat(2,1fr)}}
.r-studio-detail--cover_upload { width:100%; min-height:96px; padding:12px; display:flex; align-items:center; gap:12px; border:1px dashed #cad2df; border-radius:14px; background:#f8faff; cursor:pointer; }
.r-studio-detail--cover_upload:hover { border-color:#fec433; background:#fffaf0; }
.r-studio-detail--cover_upload img { width:136px; height:76px; object-fit:cover; border-radius:10px; }
.r-studio-detail--cover_upload > span { flex:1; color:#667085; }
</style>
