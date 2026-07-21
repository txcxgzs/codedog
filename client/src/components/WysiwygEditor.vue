<template>
  <div class="word-editor" :class="{ 'is-focused': focused, 'is-fullscreen': fullscreen }">
    <header class="word-editor__topbar">
      <div>
        <strong>帖子编辑器</strong>
        <span>{{ saveState }}</span>
      </div>
      <div class="word-editor__top-actions">
        <button type="button" @click="exec('undo')" title="撤销"><el-icon><RefreshLeft /></el-icon></button>
        <button type="button" @click="exec('redo')" title="重做"><el-icon><RefreshRight /></el-icon></button>
        <button type="button" @click="fullscreen = !fullscreen" :title="fullscreen ? '退出全屏' : '全屏写作'">
          <el-icon><FullScreen /></el-icon><span>{{ fullscreen ? '退出全屏' : '全屏' }}</span>
        </button>
      </div>
    </header>

    <div class="word-editor__ribbon" @mousedown="rememberSelection">
      <div class="word-editor__group word-editor__group--selects">
        <select :value="blockType" title="段落样式" @change="formatBlock($event.target.value)">
          <option value="p">正文</option><option value="h1">标题 1</option><option value="h2">标题 2</option>
          <option value="h3">标题 3</option><option value="blockquote">引用</option><option value="pre">代码块</option>
        </select>
        <select title="字体" @change="exec('fontName', $event.target.value)">
          <option value="">字体</option><option value="Microsoft YaHei">微软雅黑</option><option value="SimSun">宋体</option>
          <option value="SimHei">黑体</option><option value="KaiTi">楷体</option><option value="Arial">Arial</option>
          <option value="Consolas">Consolas</option>
        </select>
        <select title="字号" @change="exec('fontSize', $event.target.value)">
          <option value="">字号</option><option value="2">小</option><option value="3">正文</option>
          <option value="4">大</option><option value="5">特大</option><option value="6">超大</option>
        </select>
      </div>

      <div class="word-editor__group">
        <ToolButton label="B" title="加粗 Ctrl+B" strong command="bold" :active="isActive('bold')" @run="exec('bold')" />
        <ToolButton label="I" title="斜体 Ctrl+I" italic command="italic" :active="isActive('italic')" @run="exec('italic')" />
        <ToolButton label="U" title="下划线 Ctrl+U" underline command="underline" :active="isActive('underline')" @run="exec('underline')" />
        <ToolButton label="S" title="删除线" strike command="strikeThrough" :active="isActive('strikeThrough')" @run="exec('strikeThrough')" />
        <label class="word-editor__color" title="文字颜色"><span>A</span><input type="color" value="#182033" @input="exec('foreColor', $event.target.value)" /></label>
        <label class="word-editor__color word-editor__color--highlight" title="文本高亮"><span>▰</span><input type="color" value="#fff0a8" @input="exec('hiliteColor', $event.target.value)" /></label>
        <ToolButton label="清" title="清除格式" @run="exec('removeFormat')" />
      </div>

      <div class="word-editor__group">
        <ToolButton title="左对齐" :active="isActive('justifyLeft')" @run="exec('justifyLeft')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3h14v2H1V3zm0 4h8v2H1V7zm0 4h14v2H1v-2z"/></svg>
        </ToolButton>
        <ToolButton title="居中" :active="isActive('justifyCenter')" @run="exec('justifyCenter')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3h14v2H1V3zm3 4h8v2H4V7zm-3 4h14v2H1v-2z"/></svg>
        </ToolButton>
        <ToolButton title="右对齐" :active="isActive('justifyRight')" @run="exec('justifyRight')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3h14v2H1V3zm6 4h8v2H7V7zm-6 4h14v2H1v-2z"/></svg>
        </ToolButton>
        <ToolButton title="两端对齐" :active="isActive('justifyFull')" @run="exec('justifyFull')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z"/></svg>
        </ToolButton>
      </div>

      <div class="word-editor__group">
        <ToolButton label="• 列表" title="项目符号" :active="isActive('insertUnorderedList')" @run="exec('insertUnorderedList')" />
        <ToolButton label="1. 列表" title="编号列表" :active="isActive('insertOrderedList')" @run="exec('insertOrderedList')" />
        <ToolButton label="←" title="减少缩进" @run="exec('outdent')" />
        <ToolButton label="→" title="增加缩进" @run="exec('indent')" />
      </div>

      <div class="word-editor__group">
        <ToolButton label="链接" title="插入链接" @run="createLink" />
        <ToolButton label="取消链接" title="移除链接" @run="exec('unlink')" />
        <ToolButton label="分割线" title="插入分割线" @run="exec('insertHorizontalRule')" />
        <button type="button" class="word-editor__tool word-editor__image" :disabled="imageUploading" @click="chooseImage">
          <el-icon><Picture /></el-icon>{{ imageUploading ? '上传中' : '插入图片' }}
        </button>
      </div>
      <input ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="insertUploadedImage" />
    </div>

    <div class="word-editor__workspace">
      <div class="word-editor__page">
        <div
          ref="editorRef"
          class="word-editor__canvas markdown-body"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          spellcheck="true"
          :data-placeholder="placeholder"
          @input="handleInput"
          @paste="handlePaste"
          @keyup="updateActiveState"
          @mouseup="updateActiveState"
          @focus="focused = true; updateActiveState()"
          @blur="focused = false"
        />
      </div>
    </div>

    <footer class="word-editor__status">
      <span>{{ wordCount }} 字 · {{ paragraphCount }} 段</span>
      <span>支持 Ctrl+B / Ctrl+I / Ctrl+U · 图片自动上传至图床</span>
    </footer>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FullScreen, Picture, RefreshLeft, RefreshRight } from '@element-plus/icons-vue'
import { uploadApi } from '@/api/upload'

const ToolButton = defineComponent({
  props: { label: String, title: String, active: Boolean, strong: Boolean, italic: Boolean, underline: Boolean, strike: Boolean },
  emits: ['run'],
  setup(props, { emit, slots }) {
    return () => h('button', {
      type: 'button', title: props.title, class: ['word-editor__tool', { 'is-active': props.active }],
      style: { fontWeight: props.strong ? '800' : '', fontStyle: props.italic ? 'italic' : '', textDecoration: props.underline ? 'underline' : (props.strike ? 'line-through' : '') },
      onClick: () => emit('run')
    }, slots.default ? slots.default() : props.label)
  }
})

const PURIFY_CONFIG = {
  FORBID_TAGS: ['style', 'form', 'input', 'iframe', 'object', 'embed', 'script', 'link', 'meta', 'base'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction']
}
const props = defineProps({ modelValue: { type: String, default: '' }, placeholder: { type: String, default: '从这里开始写作…' } })
const emit = defineEmits(['update:modelValue'])
const editorRef = ref(null)
const imageInput = ref(null)
const imageUploading = ref(false)
const activeCommands = ref(new Set())
const focused = ref(false)
const fullscreen = ref(false)
const saveState = ref('内容会自动保存到表单')
const blockType = ref('p')
const textSnapshot = ref('')
let savedRange = null
let stateTimer = null

function sanitize(html) {
  const clean = DOMPurify.sanitize(html || '', PURIFY_CONFIG)
  if (typeof document === 'undefined') return clean
  const wrapper = document.createElement('div')
  wrapper.innerHTML = clean
  const allowedStyles = new Set(['color', 'background-color', 'text-align', 'margin-left'])
  wrapper.querySelectorAll('[style]').forEach((element) => {
    const safe = []
    for (const property of [...element.style]) {
      const value = element.style.getPropertyValue(property)
      if (allowedStyles.has(property) && !/url\s*\(|expression\s*\(|javascript:/i.test(value)) safe.push(`${property}:${value}`)
    }
    if (safe.length) element.setAttribute('style', safe.join(';'))
    else element.removeAttribute('style')
  })
  return wrapper.innerHTML
}
const wordCount = computed(() => textSnapshot.value.replace(/\s/g, '').length)
const paragraphCount = computed(() => !textSnapshot.value.trim() ? 0 : Math.max(1, editorRef.value?.querySelectorAll('p,h1,h2,h3,blockquote,pre,li').length || 1))

function rememberSelection() {
  const selection = window.getSelection()
  if (selection?.rangeCount && editorRef.value?.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange()
}
function restoreRange() {
  editorRef.value?.focus()
  if (!savedRange) return
  const selection = window.getSelection()
  selection.removeAllRanges(); selection.addRange(savedRange)
}
function exec(command, value = null) {
  restoreRange()
  document.execCommand(command, false, value)
  handleInput(); nextTick(updateActiveState)
}
function formatBlock(value) {
  blockType.value = value
  exec('formatBlock', value)
}
function isActive(command) { return activeCommands.value.has(command) }
function updateActiveState() {
  rememberSelection()
  const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'insertUnorderedList', 'insertOrderedList']
  activeCommands.value = new Set(commands.filter((command) => { try { return document.queryCommandState(command) } catch (_) { return false } }))
  try { blockType.value = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, '') } catch (_) {}
}
function handleInput() {
  if (!editorRef.value) return
  const clean = sanitize(editorRef.value.innerHTML)
  if (clean !== editorRef.value.innerHTML) editorRef.value.innerHTML = clean
  textSnapshot.value = editorRef.value.innerText || ''
  emit('update:modelValue', clean)
  saveState.value = '正在记录…'
  clearTimeout(stateTimer)
  stateTimer = setTimeout(() => { saveState.value = '已同步到表单' }, 500)
}
function handlePaste(event) {
  const files = [...(event.clipboardData?.files || [])]
  const image = files.find((file) => file.type.startsWith('image/'))
  if (image) { event.preventDefault(); uploadAndInsert(image) }
}
async function createLink() {
  rememberSelection()
  try {
    const { value } = await ElMessageBox.prompt('粘贴链接地址', '插入链接', { inputPlaceholder: 'https://example.com', confirmButtonText: '插入', cancelButtonText: '取消', inputPattern: /^https?:\/\//i, inputErrorMessage: '请输入以 http:// 或 https:// 开头的地址' })
    exec('createLink', value)
  } catch (_) {}
}
function chooseImage() { rememberSelection(); imageInput.value?.click() }
async function insertUploadedImage(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) await uploadAndInsert(file)
}
async function uploadAndInsert(file) {
  if (file.size > 5 * 1024 * 1024) return ElMessage.warning('图片不能超过 5MB')
  imageUploading.value = true
  try {
    const res = await uploadApi.image(file)
    const url = res.data?.url
    if (!url) throw new Error('图床未返回地址')
    exec('insertImage', url)
    ElMessage.success('图片已插入正文')
  } catch (error) { ElMessage.error(error.response?.data?.msg || error.message || '图片上传失败') }
  finally { imageUploading.value = false }
}
function setContent(html) {
  if (!editorRef.value) return
  editorRef.value.innerHTML = sanitize(html)
  textSnapshot.value = editorRef.value.innerText || ''
  emit('update:modelValue', editorRef.value.innerHTML)
}
function getSanitizedHtml() { return sanitize(editorRef.value?.innerHTML || '') }

watch(() => props.modelValue, (value) => {
  if (editorRef.value && value !== editorRef.value.innerHTML) setContent(value || '')
})
watch(fullscreen, (value) => document.body.classList.toggle('editor-fullscreen-open', value))
onMounted(() => setContent(props.modelValue || ''))
onBeforeUnmount(() => { clearTimeout(stateTimer); document.body.classList.remove('editor-fullscreen-open') })
defineExpose({ setContent, getSanitizedHtml, editorRef })
</script>

<style scoped>
.word-editor { --ink:#182033; --muted:#718096; --line:#dfe5ef; --accent:#fec433; border:1px solid var(--line); border-radius:14px; overflow:hidden; background:#fff; box-shadow:0 10px 30px rgba(32,46,76,.07); transition:.2s ease; width:100%; }
.word-editor.is-focused { border-color:#efb20c; box-shadow:0 0 0 3px rgba(254,196,51,.16),0 14px 36px rgba(32,46,76,.09); }
.word-editor.is-fullscreen { position:fixed; inset:0; z-index:3000; border:0; border-radius:0; display:flex; flex-direction:column; }
.word-editor__topbar { height:46px; padding:0 14px 0 18px; display:flex; align-items:center; justify-content:space-between; color:var(--ink); background:#fff; border-bottom:1px solid #edf0f5; }
.word-editor__topbar>div:first-child { display:flex; align-items:baseline; gap:10px; }.word-editor__topbar strong{font-size:14px}.word-editor__topbar span{font-size:12px;color:#8a94a6}
.word-editor__top-actions{display:flex;gap:4px}.word-editor__top-actions button{border:0;background:transparent;border-radius:7px;height:30px;padding:0 9px;color:#536174;display:flex;gap:5px;align-items:center;cursor:pointer}.word-editor__top-actions button:hover{background:#f3f6fa;color:#111827}
.word-editor__ribbon{display:flex;align-items:stretch;gap:0;padding:8px 10px;background:#f7f9fc;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:thin}
.word-editor__group{display:flex;align-items:center;gap:3px;padding:0 9px;border-right:1px solid #dfe5ef;flex:none}.word-editor__group:first-child{padding-left:0}.word-editor__group:last-of-type{border-right:0}
.word-editor__group select{height:32px;border:1px solid #d9e0ea;border-radius:7px;background:#fff;color:#344054;padding:0 24px 0 8px;font-size:12px;outline:none}.word-editor__group select:focus{border-color:#eeb10b}
.word-editor__tool,.word-editor__color{height:32px;min-width:32px;padding:0 8px;border:1px solid transparent;background:transparent;border-radius:7px;color:#344054;font:600 12px/1 system-ui;display:inline-flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;white-space:nowrap}.word-editor__tool:hover,.word-editor__tool.is-active,.word-editor__color:hover{background:#fff;border-color:#d8e0eb;color:#111827}.word-editor__tool.is-active{background:#fff5d6;border-color:#f3c84f}.word-editor__tool:disabled{opacity:.55;cursor:wait}
.word-editor__color{position:relative;width:34px;padding:0}.word-editor__color span{font-weight:800;border-bottom:3px solid #182033;padding-bottom:2px}.word-editor__color--highlight span{border-color:#f7cf45}.word-editor__color input{position:absolute;inset:0;opacity:0;cursor:pointer}.align-right{transform:scaleX(-1)}
.word-editor__workspace{background:#edf1f6;padding:24px;overflow:auto}.word-editor.is-fullscreen .word-editor__workspace{flex:1}.word-editor__page{max-width:820px;min-height:460px;margin:0 auto;background:#fff;box-shadow:0 3px 15px rgba(31,43,68,.1);border:1px solid #e3e7ee}
.word-editor__canvas{min-height:460px;padding:54px 64px;outline:none;color:#202634;font:16px/1.85 "Microsoft YaHei","PingFang SC",sans-serif;box-sizing:border-box}.word-editor.is-fullscreen .word-editor__canvas{min-height:calc(100vh - 210px)}
.word-editor__canvas:empty:before{content:attr(data-placeholder);color:#a4adbb;pointer-events:none}
.word-editor__status{height:34px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;background:#fff;color:#8691a3;font-size:12px;border-top:1px solid #edf0f5}
:deep(.markdown-body h1){font-size:30px;line-height:1.35;margin:0 0 22px;color:#141b2d}:deep(.markdown-body h2){font-size:24px;line-height:1.4;margin:28px 0 14px;border:0}:deep(.markdown-body h3){font-size:19px;margin:24px 0 12px}:deep(.markdown-body p){margin:0 0 14px}:deep(.markdown-body blockquote){margin:20px 0;padding:12px 18px;border-left:4px solid var(--accent);background:#fff9e9;color:#596579}:deep(.markdown-body pre){padding:18px;border-radius:8px;background:#182033;color:#edf3ff;overflow:auto;font:14px/1.7 Consolas,monospace}:deep(.markdown-body ul),:deep(.markdown-body ol){padding-left:28px}:deep(.markdown-body a){color:#2768d7;text-decoration:underline}:deep(.markdown-body img){display:block;max-width:100%;height:auto;margin:22px auto;border-radius:8px}:deep(.markdown-body hr){border:0;border-top:1px solid #dfe5ef;margin:30px 0}
@media(max-width:760px){.word-editor__workspace{padding:0}.word-editor__page{border:0;box-shadow:none}.word-editor__canvas{padding:28px 20px}.word-editor__status span:last-child{display:none}.word-editor__group--selects select:nth-child(n+2){display:none}}
</style>

<style>
body.editor-fullscreen-open{overflow:hidden!important}
</style>
