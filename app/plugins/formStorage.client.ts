import { hydrateFormsFromStorage, watchFormsToStorage } from '~/utils/formStorage'

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
  nuxtApp.hook('page:finish', () => {
    hydrateFormsFromStorage()
    if (!watching) {
      watching = true
      watchFormsToStorage()
    }
  })
})
