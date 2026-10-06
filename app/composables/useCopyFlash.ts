// Reusable "Copied" micro-interaction for every copy-to-clipboard button in
// the app. On click, writes the text, swaps the button label/icon to
// "Copied" with a check mark for 1.5s, then reverts. Pair the returned
// `flashKey` with the copy-flash CSS class (defined in main.css) if a small
// scale pop is wanted on the button itself.
//
// Returns:
//   isCopied(key)   true for 1.5s after copy(key, text) was called
//   copy(key, text) write text to the clipboard and flash the key
//   label(key, idle='Copy')      → 'Copied' | idle
//   icon(key, idle='i-lucide-copy') → 'i-lucide-check' | idle
//
// A key disambiguates several copy buttons on the same page (ticket number,
// tracking link, template preview URL, ...). Pass a stable identifier such
// as a field name; omit for a single-button page and the default '_' key
// is used.
//
// Clipboard access is best-effort: a failure (iframe, http://, private
// window) is swallowed and the flash still fires so the UI stays consistent;
// the toast caller may surface the failure if it matters.
const FLASH_MS = 1500

export function useCopyFlash() {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const flashed = ref<Record<string, boolean>>({})

  function isCopied(key = '_'): boolean {
    return !!flashed.value[key]
  }

  async function copy(key: string, text: string): Promise<boolean> {
    const existing = timers.get(key)
    if (existing) clearTimeout(existing)
    let ok = true
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } else {
        ok = false
      }
    } catch {
      ok = false
    }
    flashed.value = { ...flashed.value, [key]: true }
    const t = setTimeout(() => {
      flashed.value = { ...flashed.value, [key]: false }
      timers.delete(key)
    }, FLASH_MS)
    timers.set(key, t)
    return ok
  }

  function label(key: string, idle = 'Copy'): string {
    return isCopied(key) ? 'Copied' : idle
  }

  function icon(key: string, idle = 'i-lucide-copy'): string {
    return isCopied(key) ? 'i-lucide-check' : idle
  }

  onBeforeUnmount(() => {
    for (const t of timers.values()) clearTimeout(t)
    timers.clear()
  })

  return { isCopied, copy, label, icon }
}
