<template>
  <div class="r-markdown-editor">
    <!-- 工具栏 -->
    <div class="r-markdown-toolbar">
      <el-button-group class="r-markdown-toolbar-group">
        <el-button size="small" @click="insertText('**', '**')" title="加粗"><b>B</b></el-button>
        <el-button size="small" @click="insertText('*', '*')" title="斜体"><i>I</i></el-button>
        <el-button size="small" @click="insertText('~~', '~~')" title="删除线"><s>S</s></el-button>
        <el-button size="small" @click="insertText('`', '`')" title="行内代码"><code>Code</code></el-button>
        <el-button size="small" @click="insertText('```\\n', '\\n```')" title="代码块">```</el-button>
        <el-button size="small" @click="insertText('> ', '')" title="引用">❝</el-button>
        <el-button size="small" @click="insertText('\\n- ', '')" title="列表">≡</el-button>
        <el-button size="small" @click="insertText('[链接文字](URL)', '')" title="链接">🔗</el-button>
        <el-button size="small" @click="insertText('![图片描述](URL)', '')" title="图片">🖼️</el-button>
        <el-button size="small" @click="insertText('<span style=\'color:red\'>', '</span>')" title="红字">🔴</el-button>
      </el-button-group>
      <el-tag size="small" type="info">{{ modelValue.length }} 字</el-tag>
    </div>

    <!-- 分屏: 左侧编辑 右侧预览 -->
    <div class="r-markdown-split">
      <div class="r-markdown-pane r-markdown-pane--edit">
        <textarea
          ref="textareaRef"
          :value="modelValue"
          @input="handleInput"
          class="r-markdown-textarea"
          placeholder="支持 Markdown 格式..."
          spellcheck="false"
        />
      </div>
      <div class="r-markdown-pane r-markdown-pane--preview">
        <div class="r-markdown-preview markdown-body" v-html="renderedHtml" @scroll="syncScroll('preview')" ref="previewRef" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '支持 Markdown 格式...' }
})

const emit = defineEmits(['update:modelValue'])

// 配置 marked(只执行一次)
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
  breaks: true,
  gfm: true
})

const textareaRef = ref(null)
const previewRef = ref(null)
const isScrolling = ref(false)

const renderedHtml = computed(() => {
  if (!props.modelValue) return '<p style="color:#999">预览为空...</p>'
  try {
    return DOMPurify.sanitize(marked(props.modelValue), {
      FORBID_TAGS: ['style', 'form', 'input', 'iframe', 'object', 'embed', 'script'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style', 'formaction']
    })
  } catch (e) {
    return '<p style="color:red">渲染错误</p>'
  }
})

function handleInput(e) {
  emit('update:modelValue', e.target.value)
}

// 同步滚动: 编辑区滚动时,预览区按比例跟随
function syncScroll(source) {
  if (isScrolling.value) return
  isScrolling.value = true

  const textarea = textareaRef.value
  const preview = previewRef.value
  if (!textarea || !preview) {
    isScrolling.value = false
    return
  }

  if (source === 'preview') {
    const ratio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1)
    textarea.scrollTop = ratio * (textarea.scrollHeight - textarea.clientHeight || 0)
  } else {
    const ratio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight || 1)
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight || 0)
  }

  requestAnimationFrame(() => { isScrolling.value = false })
}

// 插入文本到光标位置
function insertText(before, after) {
  const textarea = textareaRef.value
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = props.modelValue.substring(start, end)
  const newValue = props.modelValue.substring(0, start) + before + selected + after + props.modelValue.substring(end)
  emit('update:modelValue', newValue)
  nextTick(() => {
    textarea.focus()
    textarea.selectionStart = start + before.length
    textarea.selectionEnd = start + before.length + selected.length
  })
}

defineExpose({ insertText })
</script>

<style scoped>
.r-markdown-editor {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
}

.r-markdown-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
}

.r-markdown-toolbar-group {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.r-markdown-split {
  display: flex;
  min-height: 300px;
  max-height: 500px;
}

.r-markdown-pane {
  flex: 1;
  overflow-y: auto;
}

.r-markdown-pane--edit {
  border-right: 1px solid #ebeef5;
}

.r-markdown-textarea {
  width: 100%;
  height: 100%;
  min-height: 300px;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: #fff;
}

.r-markdown-preview {
  padding: 12px;
  background: #fff;
  height: 100%;
  overflow-y: auto;
}

/* markdown-body 基本样式 */
:deep(.markdown-body) {
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
}

:deep(.markdown-body h1), :deep(.markdown-body h2), :deep(.markdown-body h3) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
}

:deep(.markdown-body p) { margin-bottom: 8px; }
:deep(.markdown-body code) {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}

:deep(.markdown-body pre) {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}

:deep(.markdown-body pre code) {
  background: none;
  padding: 0;
}

:deep(.markdown-body blockquote) {
  border-left: 4px solid #dfe2e5;
  padding-left: 12px;
  color: #6a737d;
  margin: 8px 0;
}

:deep(.markdown-body img) { max-width: 100%; }
:deep(.markdown-body ul), :deep(.markdown-body ol) { padding-left: 20px; }
:deep(.markdown-body a) { color: #409eff; }
</style>