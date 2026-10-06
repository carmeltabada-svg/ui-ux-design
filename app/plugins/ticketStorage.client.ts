import { hydrateTicketsFromStorage, watchTicketsToStorage, flushTicketsToStorage } from '~/utils/ticketStorage'

// Same timing reasoning as formStorage.client.ts: page:finish fires once the
// page itself (not just the app shell) has actually rendered, on first load
// and every later client-side navigation alike, so hydration always lands
// after the page's own seedDemoTickets() call rather than getting
// overwritten by it a moment later.
//
// `page:start` (real bug, reproduced live): a mutation made just before an
// in-app navigation - most visibly, logging an A7 call attempt and then
// immediately clicking back to the Ticket Tracker list - can lose the race
// against the 80ms debounced write in watchTicketsToStorage(). If the
// destination page's own page:finish -> hydrateTicketsFromStorage() runs
// before that debounce fires, it reads the still-stale localStorage
// snapshot and Object.assign()s it straight over the in-memory TICKETS
// store, silently discarding the just-made change (and then re-persisting
// that stale state on the next debounced write, making it look like the
// data "reset"). Flushing synchronously the moment a navigation actually
// starts - not just before the one deliberate create-ticket redirect
// flushTicketsToStorage() was originally written for - closes the race for
// every mutation, not only that one call site.
export default defineNuxtPlugin((nuxtApp) => {
  let watching = false
  // Real regression, reproduced live: `page:start` fires on the very first
  // route resolution too, not only on a later in-app navigation - so on a
  // hard reload, it was running before hydrateTicketsFromStorage() ever had
  // a chance to run once. At that point TICKETS still holds nothing but
  // this module's fresh in-memory seed data, and flushing unconditionally
  // wrote that seed straight over whatever was actually saved in
  // localStorage from a previous session - silently wiping out real data
  // (call attempts, SMS state, anything else) a split second before the
  // page:finish hydrate read it back, now already clobbered. Gating the
  // flush on having hydrated at least once this session closes that
  // without reopening the original navigation-race bug this hook exists
  // for, since that race can only ever happen after a page has already
  // hydrated for real.
  let hydratedOnce = false
  nuxtApp.hook('page:start', () => {
    if (hydratedOnce) flushTicketsToStorage()
  })
  nuxtApp.hook('page:finish', () => {
    hydrateTicketsFromStorage()
    hydratedOnce = true
    if (!watching) {
      watching = true
      watchTicketsToStorage()
    }
  })
  // Real bug, reproduced live: none of the above covers a hard reload or
  // closed tab - `page:start`/`page:finish` are Nuxt's own client-side
  // navigation hooks, they never fire for those. A mutation made within the
  // last 80ms before a refresh (log a call attempt, then immediately hit
  // F5 to check the read-only view) was simply lost: the debounced
  // setTimeout in watchTicketsToStorage() never got a chance to fire before
  // the whole page tore down, so that write never reached localStorage at
  // all, and the very next load re-reads whatever the last write before
  // that actually was - reproducing exactly as "I logged attempts, but
  // read-only shows none". `beforeunload` is the one reliable hook for
  // "the page is about to go away right now, flush synchronously."
  window.addEventListener('beforeunload', () => {
    if (hydratedOnce) flushTicketsToStorage()
  })
})
