// Shared wiring for the localStorage mirrors (plugins/*Storage.client.ts) (tickets, forms, email templates).
// Hydrate on page:finish (once the page itself has rendered; earlier gets
// overwritten by the page's own setup), start watching after the first
// hydrate, and flush on navigation and on unload. The flush is gated on having
// hydrated at least once: page:start also fires on a hard reload, and flushing
// then would write fresh seed data over what was saved.
export interface StorageSync {
  hydrate: () => void
  watch: () => void
  flush: () => void
}

export function defineStorageSyncPlugin({ hydrate, watch, flush }: StorageSync) {
  return defineNuxtPlugin((nuxtApp) => {
    let watching = false
    let hydratedOnce = false
    nuxtApp.hook('page:start', () => {
      if (hydratedOnce) flush()
    })
    nuxtApp.hook('page:finish', () => {
      hydrate()
      hydratedOnce = true
      if (!watching) {
        watching = true
        watch()
      }
    })
    window.addEventListener('beforeunload', () => {
      if (hydratedOnce) flush()
    })
  })
}
// Also: a hard reload or closed tab never fires page:start, so `beforeunload`
// is what flushes a mutation made within the 80ms debounce window; and a
// flush on every navigation (not only a deliberate redirect) closes the race
// where the next page hydrates a stale snapshot over a just-made change.
