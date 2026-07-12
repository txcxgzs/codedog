<template>
  <div class="r-wysiwyg">
    <!-- 工具栏 -->
    <div class="r-wysiwyg--toolbar">
      <el-button-group class="r-wysiwyg--toolbar-group">
        <el-button size="small" @click="exec('bold')" title="加粗" :type="isActive('bold') ? 'primary' : 'default'"><b>B</b></el-button>
        <el-button size="small" @click="exec('italic')" title="斜体" :type="isActive('italic') ? 'primary' : 'default'"><i>I</i></el-button>
        <el-button size="small" @click="exec('underline')" title="下划线" :type="isActive('underline') ? 'primary' : 'default'"><u>U</u></el-button>
        <el-button size="small" @click="exec('strikeThrough')" title="删除线" :type="isActive('strikeThrough') ? 'primary' : 'default'"><s>S</s></el-button>
        <el-button size="small" @click="exec('formatBlock', 'h2')" title="标题" :type="isActive('formatBlock', 'h2') ? 'primary' : 'default'">H2</el-button>
        <el-button size="small" @click="exec('formatBlock', 'h3')" title="小标题" :type="isActive('formatBlock', 'h3') ? 'primary' : 'default'">H3</el-button>
        <el-button size="small" @click="exec('formatBlock', 'blockquote')" title="引用" :type="isActive('formatBlock', 'blockquote') ? 'primary' : 'default'">❝</el-button>
        <el-button size="small" @click="exec('insertUnorderedList')" title="列表" :type="isActive('insertUnorderedList') ? 'primary' : 'default'">≡</el-button>
        <el-button size="small" @click="exec('insertOrderedList')" title="有序列表" :type="isActive('insertOrderedList') ? 'primary' : 'default'">1.</el-button>
        <el-button size="small" @click="exec('formatBlock', 'pre')" title="代码块" :type="isActive('formatBlock', 'pre') ? 'primary' : 'default'">&lt;/&gt;</el-button>
        <el-button size="small" @click="exec('createLink')" title="链接">🔗</el-button>
        <el-button size="small" @click="exec('unlink')" title="取消链接">🔗✕</el-button>
      </el-button-group>
      <el-tag size="small" type="info">{{ wordCount }} 字</el-tag>
    </div>

    <!-- 编辑区: 就是最终预览的样子 -->
    <div
      ref="editorRef"
      class="r-wysiwyg--editor markdown-body"
      contenteditable="true"
      @input="handleInput"
      @keyup="updateActiveState"
      @mouseup="updateActiveState"
      @focus="updateActiveState"
      :data-placeholder="placeholder"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import DOMPurify from 'dompurify'

// DOMPurify 配置:编辑路径和展示路径一致,禁止 iframe/script/style 等危险标签
const PURIFY_CONFIG = {
  FORBID_TAGS: ['style', 'form', 'input', 'iframe', 'object', 'embed', 'script', 'link', 'meta', 'base'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style', 'formaction']
}

// 净化 innerHTML(写入 contentEditable 前先净化,防止恶意标签注入)
function sanitize(html) {
  return DOMPurify.sanitize(html || '', PURIFY_CONFIG)
}

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '开始写作...' }
})

const emit = defineEmits(['update:modelValue'])

const editorRef = ref(null)
const activeCommands = ref(new Set())

const wordCount = computed(() => {
  if (!editorRef.value) return 0
  const text = editorRef.value.innerText || ''
  return text.replace(/\s/g, '').length
})

const handleInput = () => {
  if (!editorRef.value) return
  // 修复: 输入时立即净化,防止恶意内容残留在 DOM 中
  const rawHtml = editorRef.value.innerHTML
  const clean = sanitize(rawHtml)
  if (clean !== rawHtml) {
    // 有内容被净化,同步回写 DOM(保持光标位置)
    const sel = saveSelection()
    editorRef.value.innerHTML = clean
    restoreSelection(sel)
  }
  emit('update:modelValue', clean)
}

// 保存/恢复选区(净化后保持光标)
function saveSelection() {
  const sel = window.getSelection()
  if (sel.rangeCount > 0) {
    return sel.getRangeAt(0).cloneRange()
  }
  return null
}

function restoreSelection(range) {
  if (!range) return
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

function exec(command, value = null) {
  editorRef.value?.focus()
  document.execCommand(command, false, value)
  handleInput()
  nextTick(updateActiveState)
}

function isActive(command, value) {
  if (value) {
    try {
      return document.queryCommandValue(command) === value || activeCommands.value.has(command + ':' + value)
    } catch (e) {
      return activeCommands.value.has(command + ':' + value)
    }
  }
  return activeCommands.value.has(command)
}

function updateActiveState() {
  const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList']
  const newActive = new Set()
  for (const cmd of commands) {
    try {
      if (document.queryCommandState(cmd)) newActive.add(cmd)
    } catch (e) { /* ignore */ }
  }
  activeCommands.value = newActive
}

// 初始化内容(供父组件调用,写入前先净化)
function setContent(html) {
  if (editorRef.value) {
    editorRef.value.innerHTML = sanitize(html || '')
    emit('update:modelValue', editorRef.value.innerHTML)
  }
}

// 获取净化后的 HTML(保存时调用)
function getSanitizedHtml() {
  if (!editorRef.value) return ''
  return sanitize(editorRef.value.innerHTML)
}

// 修复: 外部改变 modelValue 时同步到编辑器
watch(() => props.modelValue, (val) => {
  if (editorRef.value && val !== editorRef.value.innerHTML) {
    editorRef.value.innerHTML = sanitize(val || '')
  }
})

onMounted(() => {
  if (props.modelValue && editorRef.value) {
    editorRef.value.innerHTML = sanitize(props.modelValue)
  }
})

defineExpose({ setContent, getSanitizedHtml, editorRef })
</script>

<style scoped>
.r-wysiwyg {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
}

.r-wysiwyg--toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
}

.r-wysiwyg--toolbar-group {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.r-wysiwyg--editor {
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
  padding: 16px;
  outline: none;
  line-height: 1.8;
  font-size: 15px;
  color: #333;
}

/* 占位符 */
.r-wysiwyg--editor:empty::before {
  content: attr(data-placeholder);
  color: #999;
  pointer-events: none;
}

/* Word 式样式：编辑区看起来就像最终效果 */
:deep(.markdown-body h1), :deep(.markdown-body h2), :deep(.markdown-body h3) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
}
:deep(.markdown-body h2) { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 4px; }
:deep(.markdown-body h3) { font-size: 1.25em; }
:deep(.markdown-body p) { margin-bottom: 8px; }
:deep(.markdown-body code) {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
  font-family: 'Fira Code', 'Consolas', monospace;
}
:deep(.markdown-body pre) {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}
:deep(.markdown-body pre code) { background: none; padding: 0; }
:deep(.markdown-body blockquote) {
  border-left: 4px solid #dfe2e5;
  padding-left: 12px;
  color: #6a737d;
  margin: 8px 0;
}
:deep(.markdown-body ul), :deep(.markdown-body ol) { padding-left: 20px; margin: 8px 0; }
:deep(.markdown-body li) { margin-bottom: 4px; }
:deep(.markdown-body a) { color: #409eff; text-decoration: underline; }
:deep(.markdown-body img) { max-width: 100%; border-radius: 4px; }
:deep(.markdown-body strong) { font-weight: 600; }
</style>