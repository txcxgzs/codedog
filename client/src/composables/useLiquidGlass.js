import { computed, ref } from 'vue'

const STORAGE_KEY = 'codedog_liquid_glass_beta'
const enabled = ref(false)
const supported = ref(false)

const detectSupport = () => {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return false
  return CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
}

const applyState = () => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.liquidGlass = enabled.value && supported.value ? 'on' : 'off'
}

const loadState = () => {
  supported.value = detectSupport()
  try {
    enabled.value = supported.value && localStorage.getItem(STORAGE_KEY) === 'on'
  } catch (_) {
    enabled.value = false
  }
  applyState()
}

loadState()

export function useLiquidGlass() {
  const active = computed(() => enabled.value && supported.value)

  const setEnabled = (value) => {
    if (value && !supported.value) return false
    enabled.value = !!value
    try { localStorage.setItem(STORAGE_KEY, enabled.value ? 'on' : 'off') } catch (_) {}
    applyState()
    return true
  }

  const toggle = () => setEnabled(!enabled.value)

  return { enabled, supported, active, setEnabled, toggle }
}
