<template>
  <div ref="root" class="social-picker">
    <button
      type="button"
      class="social-picker__trigger"
      :class="{ active: open || selected }"
      :aria-expanded="open"
      aria-label="发送社交卡片"
      title="发送社交卡片"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.47 8.8 8.8 0 0 1-3.15-.78L4 20l1.45-4.18A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.3 11.5h.01M12 11.5h.01M15.7 11.5h.01"/></svg>
    </button>
    <transition name="social-pop">
      <div v-if="open" class="social-picker__menu">
        <small>发送聊天卡片</small>
        <button type="button" @click="choose('user')"><span>私</span><div><b>我的私聊卡片</b><em>别人可快速向我发起私聊</em></div></button>
        <button type="button" @click="choose('group')"><span>群</span><div><b>群聊邀请卡片</b><em>邀请其他用户加入群聊</em></div></button>
        <button type="button" @click="choose('studio')"><span>室</span><div><b>工作室卡片</b><em>分享编程狗工作室主页</em></div></button>
      </div>
    </transition>
    <span v-if="selected" class="social-picker__selected">{{ selectedLabel }}<button type="button" aria-label="移除卡片" @click="$emit('clear')">×</button></span>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({ selected: { type: Object, default: null } })
const emit = defineEmits(['select', 'clear'])
const root = ref(null), open = ref(false)
const selectedLabel = computed(() => props.selected?.type === 'user' ? '私聊名片' : props.selected?.type === 'studio' ? `工作室 #${props.selected.target_id}` : `群聊 #${props.selected?.target_id}`)
const choose = type => { open.value = false; emit('select', type) }
const closeOutside = event => { if (root.value && !root.value.contains(event.target)) open.value = false }
onMounted(() => document.addEventListener('pointerdown', closeOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside))
</script>

<style scoped>
.social-picker{position:relative;display:inline-flex;align-items:center;gap:8px;margin:10px 8px 10px 0;vertical-align:middle}.social-picker__trigger{width:34px;height:34px;display:grid;place-items:center;padding:0;border:1px solid #e1e4e9;border-radius:50%;background:#fff;color:#737982;cursor:pointer;box-shadow:0 3px 10px rgba(31,35,41,.07);transition:.18s}.social-picker__trigger:hover,.social-picker__trigger.active{border-color:#fec433;background:#fff9e6;color:#b77800;transform:translateY(-1px)}.social-picker__trigger svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.social-picker__menu{position:absolute;z-index:30;left:0;bottom:44px;width:270px;padding:9px;border:1px solid #e5e7eb;border-radius:13px;background:#fff;box-shadow:0 16px 42px rgba(31,35,41,.16)}.social-picker__menu>small{display:block;padding:4px 7px 7px;color:#a0a5ad}.social-picker__menu>button{width:100%;display:flex;align-items:center;gap:10px;padding:9px;border:0;border-radius:9px;background:transparent;text-align:left;cursor:pointer}.social-picker__menu>button:hover{background:#fff8e5}.social-picker__menu>button>span{flex:none;width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:#fec433;color:#282c31;font-weight:800}.social-picker__menu div{min-width:0;display:grid;gap:2px}.social-picker__menu b{color:#34383e;font-size:13px}.social-picker__menu em{color:#9298a1;font-size:11px;font-style:normal}.social-picker__selected{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid #f0d27c;border-radius:999px;background:#fff9e6;color:#a66f00;font-size:11px}.social-picker__selected button{width:17px;height:17px;padding:0;border:0;border-radius:50%;background:#f2d98e;color:#795b13;cursor:pointer;line-height:1}.social-pop-enter-active,.social-pop-leave-active{transition:.15s}.social-pop-enter-from,.social-pop-leave-to{opacity:0;transform:translateY(5px) scale(.98)}@media(max-width:520px){.social-picker__menu{position:fixed;left:14px;right:14px;bottom:18px;width:auto}}
</style>
