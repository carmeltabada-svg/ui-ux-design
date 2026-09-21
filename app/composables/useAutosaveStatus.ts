export type AutosaveState = 'idle' | 'saving' | 'saved' | 'offline'

/**
 * Shared autosave status for both the email template editor and the form
 * builder: shows "Saving…" immediately on a change, "Saved · <time>" once a
 * debounced write actually lands, and a real "offline" state driven by the
 * browser's own online/offline events (not a fabricated failure - there's no
 * backend here to fail, but going offline is a real, observable condition).
 */
export function useAutosaveStatus() {
  const state = ref<AutosaveState>('idle')
  const lastSavedAt = ref<string>()
  const isOnline = ref(true)

  function handleOnline() {
    isOnline.value = true
    if (state.value === 'offline') state.value = 'idle'
  }

  function handleOffline() {
    isOnline.value = false
    state.value = 'offline'
  }

  onMounted(() => {
    isOnline.value = navigator.onLine
    if (!isOnline.value) state.value = 'offline'
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  function markSaving() {
    if (!isOnline.value) {
      state.value = 'offline'
      return
    }
    state.value = 'saving'
  }

  function commit(persist: () => void) {
    if (!isOnline.value) {
      state.value = 'offline'
      return false
    }
    persist()
    lastSavedAt.value = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    state.value = 'saved'
    return true
  }

  return { state, lastSavedAt, isOnline, markSaving, commit }
}
