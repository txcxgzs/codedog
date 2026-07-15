const fs = require("fs");
const file = "client/src/views/Admin.vue";
let raw = fs.readFileSync(file, "utf8");

// Find and replace the entire broken <el-tabs>...</el-tabs> region
const tabsStart = raw.indexOf('<el-tabs v-model="developerAppDetailTab">');
const tabsEnd = raw.indexOf('</el-tabs>', tabsStart);
if (tabsStart === -1 || tabsEnd === -1) { console.error("tabs region not found"); process.exit(1); }

const correctTabs = `<el-tabs v-model="developerAppDetailTab">
                <el-tab-pane label="API 调用记录" name="calls">
                  <el-table :data="developerAppCalls" v-loading="loadingDeveloperAppCalls" size="small" empty-text="暂无调用记录（部署本版本后开始记录）">
                    <el-table-column prop="created_at" label="时间" width="170"><template #default="{ row }">{{ formatDateTime(row.created_at) }}</template></el-table-column>
                    <el-table-column prop="method" label="方法" width="80" />
                    <el-table-column prop="path" label="接口" min-width="230" show-overflow-tooltip />
                    <el-table-column prop="status" label="状态码" width="90" />
                    <el-table-column prop="oauth_user_id" label="调用用户ID" width="110" />
                    <el-table-column prop="ip_address" label="IP" width="140" />
                  </el-table>
                  <el-pagination v-if="developerAppCallTotal > developerAppCallPageSize" layout="total, prev, pager, next" :total="developerAppCallTotal" :page-size="developerAppCallPageSize" :current-page="developerAppCallPage" @current-change="fetchDeveloperAppCalls" style="margin-top:12px;justify-content:flex-end" />
                </el-tab-pane>
                <el-tab-pane label="审核历史" name="audit">
                  <el-table :data="developerAppAuditLogs" v-loading="loadingDeveloperAppAuditLogs" size="small" empty-text="暂无审核记录">
                    <el-table-column prop="created_at" label="时间" width="170"><template #default="{ row }">{{ formatDateTime(row.created_at) }}</template></el-table-column>
                    <el-table-column prop="action" label="操作" width="140">
                      <template #default="{ row }">{{ auditActionText(row.action) }}</template>
                    </el-table-column>
                    <el-table-column prop="from_status" label="原状态" width="100">
                      <template #default="{ row }">{{ statusText(row.from_status) }}</template>
                    </el-tabs-column>
                    <el-table-column prop="to_status" label="新状态" width="100">
                      <template #default="{ row }">{{ statusText(row.to_status) }}</template>
                    </el-table-column>
                    <el-table-column prop="rate_limit_before" label="限流前" width="90" />
                    <el-table-column prop="rate_limit_after" label="限流后" width="90" />
                    <el-table-column prop="review_note" label="备注" min-width="160" show-overflow-tooltip />
                    <el-table-column prop="actor" label="操作人" width="140">
                      <template #default="{ row }">{{ row.actor?.nickname || row.actor?.username || '-' }}</template>
                    </el-table-column>
                  </el-table>
                  <el-pagination v-if="developerAppAuditLogsTotal > 10" layout="total, prev, pager, next" :total="developerAppAuditLogsTotal" :page-size="10" :current-page="developerAppAuditLogsPage" @current-change="fetchDeveloperAppAuditLogs" style="margin-top:12px;justify-content:flex-end" />
                </el-tab-pane>
              </el-tabs>`;

raw = raw.slice(0, tabsStart) + correctTabs + raw.slice(tabsEnd + '</el-tabs>'.length);
fs.writeFileSync(file, raw, "utf8");
console.log("OK tabs region replaced, total=" + raw.length);
