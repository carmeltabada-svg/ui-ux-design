// Drives the `.fade-scroll-y`/`.fade-scroll-x` mask utilities in main.css so
// the fade only ever shows on an element that actually has more content than
// it can display - never on a short list that already fits, which is what a
// permanently-applied mask used to do (fade the edges of content with
// nowhere to scroll to). Handled as one global, class-driven watcher instead
// of per-component wiring because several of the marked elements (dropdown/
// select menu content, popover-hosted slideover bodies) are teleported into
// the document later than their host component mounts, and a plain
// onMounted() ref in each of those components would miss that timing.
export default defineNuxtPlugin(() => {
  const AXIS_CLASS = { y: 'fade-scroll-y', x: 'fade-scroll-x' } as const
  const managed = new Set<HTMLElement>()

  function axisOf(el: HTMLElement): 'y' | 'x' | null {
    if (el.classList.contains(AXIS_CLASS.y)) return 'y'
    if (el.classList.contains(AXIS_CLASS.x)) return 'x'
    return null
  }

  function update(el: HTMLElement) {
    const axis = axisOf(el)
    if (!axis) return
    const overflowing = axis === 'y'
      ? el.scrollHeight > el.clientHeight + 1
      : el.scrollWidth > el.clientWidth + 1
    el.classList.toggle('is-overflowing', overflowing)
  }

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) update(entry.target as HTMLElement)
  })

  function manage(el: HTMLElement) {
    if (managed.has(el)) return
    managed.add(el)
    resizeObserver.observe(el)
    update(el)
  }

  function scan(root: ParentNode) {
    root.querySelectorAll<HTMLElement>(`.${AXIS_CLASS.y}, .${AXIS_CLASS.x}`).forEach(manage)
  }

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        if (axisOf(node)) manage(node)
        scan(node)
      })
      // Content growing/shrinking inside an already-managed container (no
      // resize of the container itself, so ResizeObserver alone won't fire).
      const target = mutation.target
      if (target instanceof HTMLElement) {
        const container = target.closest<HTMLElement>(`.${AXIS_CLASS.y}, .${AXIS_CLASS.x}`)
        if (container) update(container)
      }
    }
  })

  mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
  scan(document.body)

  window.addEventListener('resize', () => {
    managed.forEach((el) => (el.isConnected ? update(el) : managed.delete(el)))
  })
})
