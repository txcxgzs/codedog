<template>
  <!-- 图片加载失败时自动回退到 fallback 占位图，避免出现破图 -->
  <!-- referrerpolicy="no-referrer": 不发送 Referer,绕过编程猫 CDN 防盗链 -->
  <img :src="currentSrc" @error="handleError" referrerpolicy="no-referrer" v-bind="$attrs" />
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  // 图片地址
  src: { type: String, default: '' },
  // 加载失败时的回退图（默认灰色占位 SVG）
  fallback: {
    type: String,
    default: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZWVlIi8+PC9zdmc+'
  }
})

const currentSrc = ref(props.src || props.fallback)

// src 变化时重置为新的图片地址
watch(() => props.src, (v) => {
  currentSrc.value = v || props.fallback
})

const handleError = () => {
  currentSrc.value = props.fallback
}
</script>
