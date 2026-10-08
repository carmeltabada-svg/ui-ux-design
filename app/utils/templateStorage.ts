import { watch } from 'vue'
import { TEMPLATE_RUNTIME, TEMPLATE_HISTORY, CUSTOM_TEMPLATE_IDS, DELETED_TEMPLATE_KEYS } from '~/data/templateRuntime'

// Email templates used to live only in this tab's memory, so a template you
// created (or any edit, delete or saved version) vanished on refresh. Same
// approach as formStorage.ts: mirror to localStorage (debounced), read it
// back once the page has rendered, flush before navigating away.
const STORAGE_KEY = 'ams:emailTemplates:v1'

interface StoredShape {
  runtime: typeof TEMPLATE_RUNTIME
  history: typeof TEMPLATE_HISTORY
  custom: string[]
  deleted: string[]
}

function snapshot(): string {
  return JSON.stringify({
    runtime: TEMPLATE_RUNTIME,
    history: TEMPLATE_HISTORY,
    custom: CUSTOM_TEMPLATE_IDS,
    deleted: [...DELETED_TEMPLATE_KEYS]
  })
}

let lastKnown: string | null = null

function applyStored(saved: StoredShape) {
  // Merge rather than replace: a page may already have lazily created a
  // seeded entry that the saved one should simply override.
  Object.assign(TEMPLATE_RUNTIME, saved.runtime ?? {})
  Object.assign(TEMPLATE_HISTORY, saved.history ?? {})
  CUSTOM_TEMPLATE_IDS.splice(0, CUSTOM_TEMPLATE_IDS.length, ...(saved.custom ?? []))
  DELETED_TEMPLATE_KEYS.clear()
  for (const key of saved.deleted ?? []) DELETED_TEMPLATE_KEYS.add(key)
}

export function hydrateTemplatesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw || raw === lastKnown) return
    const saved = JSON.parse(raw) as StoredShape
    if (!saved || typeof saved.runtime !== 'object') return
    lastKnown = raw
    applyStored(saved)
  } catch {
    // Private mode or a malformed snapshot: fall back to the seed data.
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

function writeStorage() {
  clearTimeout(saveTimer)
  saveTimer = undefined
  try {
    const serialized = snapshot()
    if (serialized === lastKnown) return
    lastKnown = serialized
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch {
    // Storage full or unavailable: keep working in memory.
  }
}

/** Write now, bypassing the debounce, right before leaving the page. */
export function flushTemplatesToStorage() {
  writeStorage()
}

export function watchTemplatesToStorage() {
  lastKnown = localStorage.getItem(STORAGE_KEY)
  watch([TEMPLATE_RUNTIME, TEMPLATE_HISTORY, CUSTOM_TEMPLATE_IDS, DELETED_TEMPLATE_KEYS], () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(writeStorage, 80)
  }, { deep: true })

  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue || e.newValue === lastKnown) return
    lastKnown = e.newValue
    try {
      applyStored(JSON.parse(e.newValue) as StoredShape)
    } catch {
      // ignore a malformed write from another tab
    }
  })
}
