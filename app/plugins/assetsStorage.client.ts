import { hydrateAssetsFromStorage, watchAssetsToStorage } from '~/data/assets'

// Hydrates after the app has mounted, so the first client render matches the server render and
// there is no hydration mismatch, then saves every later change.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    hydrateAssetsFromStorage()
    watchAssetsToStorage()
  })
})
