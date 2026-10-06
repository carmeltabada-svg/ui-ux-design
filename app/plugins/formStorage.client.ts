import { hydrateFormsFromStorage, watchFormsToStorage, flushFormsToStorage } from '~/utils/formStorage'

// `app:mounted` fires right as the root app finishes its initial mount, but
// the actual page component can still be a tick behind it (Nuxt resolves the
// page inside its own Suspense boundary) - hydrating that early got silently
// discarded once the page's own render caught up a moment later, so this
// waits for `page:finish` instead, which fires only once the page itself
// (not just the app shell) has actually finished rendering - on the first
// load and on every later client-side navigation alike, so a form page
// opened via SPA navigation (not just a hard reload) also picks up the
// latest saved snapshot.
export default defineNuxtPlugin((nuxtApp) => {
  let watching = false
  // See ticketStorage.client.ts's page:start hook for why this exists - the
  // same debounced-write-vs-navigation race applies here identically, and so
  // does the fix below: `page:start` also fires on the very first route
  // resolution (a hard reload), before hydrateFormsFromStorage() has ever
  // run once - flushing unconditionally there wrote this module's fresh
  // in-memory seed data straight over whatever was actually saved,
  // clobbering it a split second before page:finish's hydrate read it back
  // already-wiped. Gated on having hydrated at least once this session.
  let hydratedOnce = false
  nuxtApp.hook('page:start', () => {
    if (hydratedOnce) flushFormsToStorage()
  })
  nuxtApp.hook('page:finish', () => {
    hydrateFormsFromStorage()
    hydratedOnce = true
    if (!watching) {
      watching = true
      watchFormsToStorage()
    }
  })
  // See ticketStorage.client.ts's own beforeunload handler - a hard reload
  // or closed tab never fires page:start/page:finish at all, so a mutation
  // made within the last 80ms before one was simply never written.
  window.addEventListener('beforeunload', () => {
    if (hydratedOnce) flushFormsToStorage()
  })
})
