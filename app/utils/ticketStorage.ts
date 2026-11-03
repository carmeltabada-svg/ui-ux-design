import { watch } from 'vue'
import { TICKETS, NOTIFICATIONS, repairRestoredTicket, type Ticket, type AppNotification } from '~/data/ticketTrackers'

// PROTOTYPE ONLY (see docs/retrieval/BACKEND_SWAP.md): this is the mock server's database for tickets.
// TICKETS/NOTIFICATIONS only
// ever exist in one tab's JS memory otherwise - there's no backend. A
// simulated HRIS update, an acknowledgment, a Target Date re-baseline, all
// of it looked like it silently vanished the moment you opened a second tab
// or refreshed, because seedDemoTickets() just ran fresh from static seed
// data again with none of that. localStorage is what already survives a
// fresh load in the same browser, so ticket/notification writes go there
// too (debounced), get read back on load (after the fresh seed, so a saved
// snapshot always wins over the seed for tickets that already exist), and a
// `storage` event lets an already-open tab pick up a change made in another
// tab live - the exact bug reported: the badge from a simulated update in
// one tab disappearing the moment another tab (with no knowledge of it) was
// opened and this one was revisited.
const STORAGE_KEY = 'ams:tickets:v1'

interface StoredShape {
  tickets: Record<string, Ticket>
  notifications: AppNotification[]
}

function readStorage(raw: string): StoredShape | null {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.tickets !== 'object' || !Array.isArray(parsed?.notifications)) return null
    return parsed
  } catch {
    return null
  }
}

// Real bug, reproduced live: deleting every key first and only then
// reassigning left a real (if brief, same-tick) window where the reactive
// TICKETS object was completely empty - a computed reading Object.values
// (TICKETS) that happens to recompute in that exact window (e.g. from a
// second Vue app instance/tab's own reactivity, or a scheduling edge case
// this pass couldn't fully pin down) sees zero tickets, not the real count.
// Deleting only the keys that are actually gone in the new snapshot, before
// assigning the rest, means TICKETS is never observably empty at any point
// this function runs, whether or not anything is actually watching it that
// closely.
function applyStored(saved: StoredShape) {
  for (const key of Object.keys(TICKETS)) {
    if (!(key in saved.tickets)) delete TICKETS[key]
  }
  Object.assign(TICKETS, saved.tickets)
  for (const t of Object.values(TICKETS)) repairRestoredTicket(t)
  NOTIFICATIONS.splice(0, NOTIFICATIONS.length, ...saved.notifications)
}

// Real bug, reproduced live (reported as "the ticket list randomly
// collapses to one ticket after navigating away and back, only a hard
// refresh fixes it"): this app has no backend and no legitimate way for the
// visible ticket count to ever shrink except the explicit "Clear All
// Tickets" action (a full localStorage.clear() + reload, never a partial
// hydrate). A hydrate that would apply a snapshot with noticeably fewer
// tickets than what's already in memory is therefore always a sign of a
// race/glitch (a stale write, a torn read, another stale tab's own snapshot
// arriving late) rather than real state - applying it silently corrupts the
// in-memory store for the rest of the session, only reset by a hard reload.
// Refusing to shrink protects against that whole class of bug regardless of
// which specific race caused any one occurrence of it.
function looksLikeARegression(saved: StoredShape): boolean {
  const currentCount = Object.keys(TICKETS).length
  const savedCount = Object.keys(saved.tickets).length
  return currentCount > 0 && savedCount < currentCount
}

// Tracks the last string this tab itself wrote or read, so neither
// hydrateTicketsFromStorage() nor writeStorage() below repeat work when
// nothing has actually changed since last time.
let lastKnown: string | null = null

/**
 * Called after the page itself has finished rendering. Runs after the tickets
 * have been loaded from the api layer, so a saved snapshot correctly overwrites
 * them rather than the other way around. Safe to call again on every later navigation.
 *
 * Real bug, reproduced live: this used to re-apply unconditionally on every
 * single page:finish, even when localStorage hadn't changed since the last
 * time this same tab read (or wrote) it - which is the overwhelmingly common
 * case, since most navigations don't touch ticket data at all. applyStored()
 * deletes every key of TICKETS and reassigns it, which is a much more
 * disruptive reactivity event than a no-op would be: a consumer keyed off
 * `Object.values(TICKETS)` (the Overview table, most visibly) briefly sees
 * an empty store and then a full replacement of every row's object identity,
 * which can show up as a layout thrash/flash on the very next navigation
 * back to that list. Comparing against `lastKnown` first (the same guard
 * writeStorage() already used, just not applied to the read path too) skips
 * that entirely whenever nothing has actually changed.
 */
/** True once the first hydrate attempt has finished, so a page can tell "still loading saved tickets" from "this ticket really does not exist". */
export const ticketsHydrated = ref(false)

/**
 * This file is the mock server's ticket database. Against a real backend (apiMode 'http') it is
 * switched off, so a saved browser snapshot can never overwrite what the server returned.
 * Set once at startup by plugins/00.masterData.ts.
 */
let mirrorEnabled = true
export function setTicketMirrorEnabled(on: boolean) {
  mirrorEnabled = on
}

export function hydrateTicketsFromStorage() {
  try {
    if (mirrorEnabled) hydrateNow()
  } finally {
    ticketsHydrated.value = true
  }
}

function hydrateNow() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw || raw === lastKnown) return
  const saved = readStorage(raw)
  if (!saved) return
  // Deliberately doesn't update `lastKnown` here - leaving it means the next
  // debounced write (of the real, still-intact in-memory TICKETS) is free to
  // overwrite this bad snapshot in localStorage too, instead of getting
  // stuck treating the bad value as "already seen" forever.
  if (looksLikeARegression(saved)) {
    console.warn('[ticketStorage] Ignored a hydrate that would have shrunk the ticket count - likely a stale/torn snapshot, not real state.')
    return
  }
  lastKnown = raw
  applyStored(saved)
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

function writeStorage() {
  if (!mirrorEnabled) return
  clearTimeout(saveTimer)
  saveTimer = undefined
  const serialized = JSON.stringify({ tickets: TICKETS, notifications: NOTIFICATIONS })
  if (serialized === lastKnown) return
  lastKnown = serialized
  localStorage.setItem(STORAGE_KEY, serialized)
}

/**
 * Write the current state immediately, bypassing the debounce - call this
 * right before anything that's about to navigate away (creating a ticket
 * and routing straight to its workspace page, most notably), so the new
 * page's own hydrateTicketsFromStorage() call on page:finish can never run
 * before this write lands. Without this, the debounced write (80ms) loses
 * the race against navigation: the brand-new ticket exists only in memory,
 * the new page's hydration overwrites TICKETS with the stale pre-creation
 * snapshot, and the ticket "disappears" (Ticket not found) despite having
 * just been created.
 */
export function flushTicketsToStorage() {
  writeStorage()
}

export function watchTicketsToStorage() {
  lastKnown = localStorage.getItem(STORAGE_KEY)

  watch([TICKETS, NOTIFICATIONS], () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(writeStorage, 80)
  }, { deep: true })

  // Another tab (e.g. one showing the Overview, or a ticket workspace left
  // open) saved a change - pull it in immediately instead of only picking
  // it up on next reload, so a badge/notification that appeared in one tab
  // is visible in an already-open other tab too.
  window.addEventListener('storage', (e) => {
    if (!mirrorEnabled || e.key !== STORAGE_KEY || !e.newValue || e.newValue === lastKnown) return
    try {
      const saved = JSON.parse(e.newValue) as StoredShape
      if (looksLikeARegression(saved)) {
        console.warn('[ticketStorage] Ignored a cross-tab update that would have shrunk the ticket count - likely a stale/torn snapshot, not real state.')
        return
      }
      lastKnown = e.newValue
      applyStored(saved)
    } catch {
      // ignore a malformed write from another tab
    }
  })
}
