import { formSync, templateSync } from '~/data/syncedStores'

const syncs = [formSync, templateSync]

// Starts after 00.masterData.ts has filled the stores, so what was loaded counts as already saved.
export default defineNuxtPlugin(() => {
  syncs.forEach(s => s.start())
  // A change made just before the page closes is sent now. The browser may not wait for the answer.
  window.addEventListener('beforeunload', () => { syncs.forEach(s => void s.flush()) })
})
