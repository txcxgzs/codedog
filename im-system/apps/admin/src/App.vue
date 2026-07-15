<template>
  <div class="admin-shell">
    <aside><div class="logo">CD<span>IM CONTROL</span></div><nav><button class="active">聊天审计</button><button>举报处理</button><button>群聊管理</button><button>在线状态</button><button>系统设置</button></nav><small>独立管理终端 v0.1</small></aside>
    <main>
      <header><div><h1>聊天记录审计</h1><p>高敏操作 · 所有查询均写入不可删除审计日志</p></div><div class="status"><i></i>{{ me?.nickname || me?.username || '验证身份中' }}</div></header>
      <section class="query-panel">
        <label>会话 ID<input v-model="query.conversation_id" inputmode="numeric" placeholder="可选" /></label>
        <label>发送用户 ID<input v-model="query.user_id" inputmode="numeric" placeholder="可选" /></label>
        <label>关键词<input v-model="query.keyword" placeholder="消息正文" /></label>
        <label class="reason">查看原因（必填）<input v-model="reason" placeholder="请说明本次查看聊天内容的安全或审核原因" /></label>
        <button @click="search" :disabled="loading || reason.trim().length < 5">{{ loading ? '检索中' : '执行审计检索' }}</button>
      </section>
      <p v-if="error" class="error">{{ error }}</p>
      <section class="group-limit"><div><b>群容量例外</b><small>默认统一 100 人，仅管理员可调整并强制审计</small></div><input v-model="groupLimit.conversation_id" inputmode="numeric" placeholder="群会话 ID" /><input v-model="groupLimit.member_limit" inputmode="numeric" placeholder="新上限" /><input v-model="groupLimit.reason" placeholder="调整原因（至少5字）" /><button @click="updateGroupLimit">保存例外</button></section>
      <section class="records"><div class="records-head"><b>检索结果</b><span>{{ rows.length }} 条</span></div><table><thead><tr><th>时间 / 序列</th><th>会话</th><th>发送者</th><th>内容</th><th>状态</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td>{{ formatDate(row.created_at) }}<small>#{{ row.sequence }}</small></td><td>{{ row.conversation_id }}</td><td>用户 {{ row.sender_id }}</td><td class="content">{{ row.content }}</td><td><span class="tag">{{ row.status }}</span></td></tr><tr v-if="!rows.length"><td colspan="5" class="empty">填写审计原因并执行检索</td></tr></tbody></table></section>
    </main>
  </div>
</template>
<script setup>
import { onMounted, reactive, ref } from 'vue'
const me = ref(null), rows = ref([]), reason = ref(''), loading = ref(false), error = ref('')
const query = reactive({ conversation_id: '', user_id: '', keyword: '' })
const groupLimit = reactive({ conversation_id: '', member_limit: '', reason: '' })
const api = async (url, options={}) => { const response=await fetch(`/im/api${url}`,{credentials:'include',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}}); const body=await response.json(); if(!response.ok) throw new Error(body.msg); return body.data }
const search = async () => { loading.value=true; error.value=''; try { rows.value=await api('/admin/messages/search',{method:'POST',body:JSON.stringify({...query,reason:reason.value.trim()})}) } catch(e){ error.value=e.message } finally{ loading.value=false } }
const updateGroupLimit = async () => { error.value=''; try { await api(`/groups/${groupLimit.conversation_id}`,{method:'PATCH',body:JSON.stringify({member_limit:Number(groupLimit.member_limit),reason:groupLimit.reason.trim()})}); alert('群容量例外已保存并记录审计日志') } catch(e){ error.value=e.message } }
const formatDate=value=>value?new Date(value).toLocaleString('zh-CN'):'-'
onMounted(()=>api('/me').then(value=>{me.value=value;if(!['admin','superadmin'].includes(value.role)) error.value='当前账号无权访问 IM 后台'}).catch(e=>error.value=e.message))
</script>
<style scoped>
.group-limit { display:grid; grid-template-columns:1fr 130px 110px minmax(220px,1fr) auto; gap:10px; align-items:center; margin-top:18px; padding:16px 18px; border:1px solid #584e1d; border-radius:12px; background:#29230d66; }
.group-limit div { display:grid; gap:4px; }.group-limit small { color:#968e67; }
.group-limit input { height:37px; min-width:0; border:1px solid #3e4c4d; border-radius:8px; background:#071421; color:#e4f7ff; padding:0 10px; }
.group-limit button { height:37px; border:0; border-radius:8px; background:#ffc43d; color:#14181e; font-weight:800; cursor:pointer; }
@media(max-width:1050px){.group-limit{grid-template-columns:1fr 1fr}.group-limit div{grid-column:1/-1}}
</style>
