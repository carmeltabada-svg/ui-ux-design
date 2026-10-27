// Drives the `.fade-scroll-y`/`.fade-scroll-x` mask utilities in main.css so
// the fade only ever shows on an element that actually has more content than
// it can display, never on a short list that already fits. One global,
// class-driven watcher rather than per-component wiring, because several of
// the marked elements (dropdown/select menu content, drawer bodies) are
// teleported into the document later than their host component mounts.
//
// Measuring (scrollHeight/clientHeight) forces layout, so work is batched:
// observers only mark an element dirty, and one short timer (not requestAnimationFrame, which pauses in background tabs) reads every
// dirty element first and toggles classes after.
export default defineNuxtPlugin(() => {
  const AXIS_SELECTOR = '.fade-scroll-y, .fade-scroll-x'
  const observed = new Set<HTMLElement>()
  const dirty = new Set<HTMLElement>()
  let timer: ReturnType<typeof setTimeout> | undefined

  function isY(el: HTMLElement) {
    return el.classList.contains('fade-scroll-y')
  }

  function flush() {
    timer = undefined
    const results: [HTMLElement, boolean][] = []
    dirty.forEach((el) => {
      if (!el.isConnected) return
      results.push([el, isY(el) ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1])
    })
    dirty.clear()
    for (const [el, overflowing] of results) el.classList.toggle('is-overflowing', overflowing)
  }

  function schedule(el: HTMLElement) {
    dirty.add(el)
    if (!timer) timer = setTimeout(flush, 16)
  }

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) schedule(entry.target as HTMLElement)
  })

  function manage(el: HTMLElement) {
    if (observed.has(el)) return
    observed.add(el)
    resizeObserver.observe(el)
    schedule(el)
  }

  function release(el: HTMLElement) {
    if (!observed.delete(el)) return
    resizeObserver.unobserve(el)
    dirty.delete(el)
  }

  function forEachMarked(node: Node, fn: (el: HTMLElement) => void) {
    if (!(node instanceof HTMLElement)) return
    if (node.matches(AXIS_SELECTOR)) fn(node)
    if (node.firstElementChild) node.querySelectorAll<HTMLElement>(AXIS_SELECTOR).forEach(fn)
  }

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => forEachMarked(node, manage))
      mutation.removedNodes.forEach(node => forEachMarked(node, release))
      // Content growing or shrinking inside an already-managed container
      // does not resize the container itself, so the ResizeObserver alone
      // would miss it.
      const target = mutation.target
      if (target instanceof HTMLElement) {
        const container = target.closest<HTMLElement>(AXIS_SELECTOR)
        if (container && observed.has(container)) schedule(container)
      }
    }
  })

  mutationObserver.observe(document.body, { childList: true, subtree: true })
  forEachMarked(document.body, manage)
})
