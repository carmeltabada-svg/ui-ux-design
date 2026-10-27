// Dropdown menus (USelect, UInputMenu, USelectMenu) float in a popper teleported
// to <body>. That popper is a later sibling of the app root, so it paints over
// the sticky header/breadcrumb when the page scrolls with one open, which reads
// as a broken overlap. Robust apps dismiss a menu when the page behind it
// scrolls, so the menu never floats over fixed chrome. This does that globally:
// a user scroll (not a scroll inside the menu's own list) closes the open menu
// with Escape (Reka's dismissable layer closes the topmost popper; dialogs and
// modals are a different layer and are not affected).
//
// A menu, on open, scrolls its selected option into view and can nudge the page;
// a short grace period after it appears ignores that open-time scroll so the
// menu doesn't close itself the instant it opens.
const MENU = '[role="listbox"], [role="menu"]'
const GRACE_MS = 300
export default defineNuxtPlugin(() => {
  if (import.meta.server) return
  let openedAt = 0
  // The body subtree mutates constantly in a reactive app; coalesce bursts into
  // one check per frame so this never becomes per-mutation work.
  let checkQueued = false
  const observer = new MutationObserver(() => {
    if (checkQueued) return
    checkQueued = true
    requestAnimationFrame(() => {
      checkQueued = false
      if (document.querySelector(MENU)) { if (!openedAt) openedAt = performance.now() }
      else openedAt = 0
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })

  function onScroll(e: Event) {
    if (!openedAt || performance.now() - openedAt < GRACE_MS) return
    const target = e.target as Element | null
    // A long list scrolls inside itself - never close on that.
    if (target?.closest?.('[data-reka-popper-content-wrapper]')) return
    if (!document.querySelector(MENU)) return
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  }
  // capture:true so scrolls from inner scroll containers are seen too (scroll
  // doesn't bubble, but it is dispatched through the capture phase).
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
})
