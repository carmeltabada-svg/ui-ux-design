export function useTokenHighlight() {
  const activeToken = useState<string | null>('activeToken', () => null)

  function onTokenClick(e: Event) {
    const target = (e.target as HTMLElement).closest('[data-token]') as HTMLElement | null
    if (!target) return
    const code = target.dataset.token!
    const wasActive = activeToken.value === code
    activeToken.value = wasActive ? null : code

    if (wasActive) return

    // jump the corresponding placeholder/value in the other pane into view
    nextTick(() => {
      const clickedPane = target.closest('[data-pane]')?.getAttribute('data-pane')
      const matches = Array.from(document.querySelectorAll<HTMLElement>(`[data-token="${code}"]`))
      const counterpart = matches.find(el => el.closest('[data-pane]')?.getAttribute('data-pane') !== clickedPane) ?? matches[0]
      counterpart?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  watch(activeToken, (code) => {
    nextTick(() => {
      document.querySelectorAll('[data-token]').forEach((el) => {
        el.classList.toggle('tok-active', !!code && (el as HTMLElement).dataset.token === code)
      })
    })
  })

  return { activeToken, onTokenClick }
}
