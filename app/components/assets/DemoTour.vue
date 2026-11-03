<script setup lang="ts">
// Guided tour of the Assets prototype, for demos and user testing. Prototype scaffolding in the same way as the simulator
// bar, and it lives only on the demo-guide branch. It never moves the visitor to another screen on its own: where the
// next view comes from a click (a menu option, a tag, a tab), the tour points at that control and waits for the click,
// so the visitor learns the way there. It finds its targets by selector and text, so no product page carries a tour
// attribute. Delete this file and its tag in SimulatorBar.vue and the tour is gone.
const route = useRoute()
const router = useRouter()

const SEEN = 'ams:assets:tour:seen:v2'
const PROGRESS = 'ams:assets:tour:progress:v2'

interface Step {
  title: string
  body: string
  /** Where this step is shown. On any other screen the card offers to take the visitor there. */
  at?: () => boolean
  /** Where "Take me there" goes, when the visitor is on the wrong screen. */
  to?: string
  /** Finds the element to spotlight. No finder, or none found, shows the card in the middle. */
  find?: () => Element | null
  pad?: number
  /** A step the visitor performs: the tour waits until this is true, then moves on by itself. */
  until?: () => boolean
  /** Short instruction shown above the buttons on an action step. */
  doThis?: string
}

const byText = (sel: string, text: string, exact = false) => () =>
  [...document.querySelectorAll(sel)].find((e) => { const t = (e.textContent ?? '').trim(); return exact ? t === text : t.startsWith(text) }) ?? null
const menuOrButton = (button: () => Element | null) => () => document.querySelector('[role=menu]') ?? button()
const rowMenuButton = () => document.querySelector('tbody tr:first-child button[aria-label^="Move "]')
const sidebarAssets = () => [...document.querySelectorAll('a')].find(a => (a.textContent ?? '').trim() === 'Assets' && a.closest('aside, nav, [role=navigation]') && !a.closest('main')) ?? null

const onList = () => route.path === '/assets'
const onDetail = () => /^\/assets\/[^/]+/.test(route.path)
const onForm = () => /^\/move-asset\/[^/]+\/move$/.test(route.path) && !route.query.kind
const onSupplierForm = () => /^\/move-asset\/[^/]+\/move$/.test(route.path) && route.query.kind === 'supplier'
const anyMove = () => /^\/move-asset\/[^/]+\/move$/.test(route.path)
const firstRowExited = () => /Supplier Return|Client Pull-Out/.test(document.querySelector('tbody tr:first-child')?.textContent ?? '')

const steps: Step[] = [
  {
    at: onList,
    to: '/assets',
    title: 'Welcome to the new Assets screens',
    body: 'This tour shows how to find a unit, read its history and move it. You do the clicking, so you will see how to reach every screen yourself. Everything here is sample data, and you can leave at any time with Skip tour.'
  },
  {
    at: onList,
    to: '/assets',
    title: 'Every unit, in one list',
    body: 'The heading counts the units, and the line under it says how many are with team members, at our locations, and at a supplier or client.',
    find: () => document.querySelector('main h1')
  },
  {
    at: onList,
    to: '/assets',
    title: 'Narrow it down',
    body: 'Filter by status, type and more. The older statuses, such as Under Repair and In Transit, are in a Legacy group at the bottom of the status list.',
    find: () => document.querySelector('[aria-label="Filter by Status"]'),
    pad: 6
  },
  {
    at: onList,
    to: '/assets',
    title: 'Move a unit from its row',
    body: 'The last column has a Move menu for every unit. It offers Check In or Check Out, Return to supplier and Client pull-out. A greyed-out option tells you why when you hover it.',
    doThis: 'Open the menu on the first row, then choose Check In or Check Out.',
    find: menuOrButton(rowMenuButton),
    pad: 6,
    until: anyMove
  },
  {
    at: onForm,
    to: '/assets',
    title: 'Check In or Check Out',
    body: 'You are on the move form. Choose the movement first. A Check In always goes to one of our locations. A Check Out goes to a team member or a supplier.',
    find: () => document.querySelectorAll('[role=radiogroup]')[0] ?? null,
    pad: 6
  },
  {
    at: onForm,
    to: '/assets',
    title: 'Where it is going',
    body: 'Pick the kind of place, then the place itself. Team members can be found by name, employee number or email.',
    find: () => document.querySelectorAll('[role=radiogroup]')[1] ?? null,
    pad: 6
  },
  {
    at: onForm,
    to: '/assets',
    title: 'The new status comes last',
    body: 'Choose the status once you know where the unit is going. Legacy statuses are at the bottom of the list. Nothing is saved until you press Move Asset, so you can leave this form safely.',
    find: () => document.querySelector('label[for=new-status]')?.parentElement ?? null,
    pad: 8
  },
  {
    at: onForm,
    to: '/assets',
    title: 'Back to the list',
    body: 'The sidebar takes you back to the list at any time.',
    doThis: 'Click Assets in the sidebar.',
    find: sidebarAssets,
    pad: 6,
    until: onList
  },
  {
    at: onList,
    to: '/assets',
    title: 'Open a unit',
    body: 'Every tag in the list is a link to that unit.',
    doThis: 'Click a tag in the first column.',
    find: () => document.querySelector('tbody tr:first-child td:nth-child(2) a, tbody tr:first-child td:nth-child(2) button'),
    pad: 6,
    until: onDetail
  },
  {
    at: onDetail,
    to: '/assets',
    title: 'The same Move menu is here too',
    body: 'Every unit has the Move menu at the top, next to Edit details, so you do not have to go back to the list to move it.',
    find: byText('button', 'Move asset'),
    pad: 6
  },
  {
    at: onDetail,
    to: '/assets',
    title: 'Everything that happened to it',
    body: 'The tabs keep a record of every status change and move. Custody history shows who had the unit and for how long.',
    doThis: 'Click the Custody history tab.',
    find: byText('a, button', 'Custody history'),
    pad: 6,
    until: () => route.path.endsWith('/custody-history')
  },
  {
    at: onDetail,
    to: '/assets',
    title: 'Returning a unit to its supplier',
    body: 'This is the same Move menu. Returning a unit to its supplier is its own choice, so the form can fill in the details for you. You will only look at the form, nothing is saved until you press Move Asset.',
    doThis: 'Open the Move asset menu, then choose Return to supplier.',
    find: menuOrButton(byText('button', 'Move asset')),
    pad: 6,
    until: onSupplierForm
  },
  {
    at: onSupplierForm,
    to: '/assets',
    title: 'What a supplier return records',
    body: 'The status and the supplier address are filled in for you. You attach the signed agreement and say why the unit is going back.',
    find: byText('p', 'Supplier Return details'),
    pad: 10
  },
  {
    at: onSupplierForm,
    to: '/assets',
    title: 'A replacement is optional',
    body: 'Pick one now, or add it later from the unit. The question marks inside the list explain how the units are grouped.',
    find: () => document.querySelector('#rep'),
    pad: 8
  },
  {
    at: onSupplierForm,
    to: '/assets',
    title: 'Leave without saving',
    body: 'You do not have to finish the form. The sidebar takes you back.',
    doThis: 'Click Assets in the sidebar.',
    find: sidebarAssets,
    pad: 6,
    until: onList
  },
  {
    at: onList,
    to: '/assets',
    title: 'Find units that have already left',
    body: 'The tiles above the list are shortcuts. This one shows the units that were returned to a supplier or pulled out by a client.',
    doThis: 'Click Returned or pulled out.',
    find: byText('button', 'Returned or pulled out'),
    pad: 6,
    until: firstRowExited
  },
  {
    at: onList,
    to: '/assets',
    title: 'Open one of them',
    body: 'These units are final. Their details are kept in a panel on the unit.',
    doThis: 'Click a tag in the first column.',
    find: () => document.querySelector('tbody tr:first-child td:nth-child(2) a, tbody tr:first-child td:nth-child(2) button'),
    pad: 6,
    until: onDetail
  },
  {
    at: onDetail,
    to: '/assets',
    title: 'Move details',
    body: 'A unit that has left has a Move details button instead of a Move menu.',
    doThis: 'Click Move details.',
    find: byText('button', 'Move details'),
    pad: 6,
    until: () => !!document.querySelector('[role=dialog]:not(#demo-tour-card)')
  },
  {
    at: onDetail,
    to: '/assets',
    title: 'What was recorded',
    body: 'The panel shows what was recorded when the unit left. A replacement can still be added or changed here. Use the arrow keys to move through the tour while the panel is open.',
    find: () => document.querySelector('[role=dialog]:not(#demo-tour-card)'),
    pad: 0
  },
  {
    title: 'That is the tour',
    body: 'Press Reset sample data in the dark bar to start again with fresh units. Choose Guide any time to see the tour again.'
  }
]

const active = ref(false)
const idx = ref(0)
const rect = ref<DOMRect | null>(null)
const missing = ref(false)
const wrongScreen = ref(false)
const card = ref<HTMLElement>()
const root = ref<HTMLElement>()
const cardPos = ref({ left: 12, top: 12 })
const nextBtn = ref<{ $el?: HTMLElement } | null>(null)

const step = computed(() => steps[idx.value]!)
const isAction = computed(() => !!step.value.until && !wrongScreen.value)
const last = computed(() => idx.value === steps.length - 1)

function remember(seen: boolean) {
  try {
    if (seen) localStorage.setItem(SEEN, '1')
    if (active.value) sessionStorage.setItem(PROGRESS, String(idx.value))
    else sessionStorage.removeItem(PROGRESS)
  } catch { /* storage can be unavailable; the tour still works */ }
}

let token = 0
let poll: ReturnType<typeof setInterval> | undefined
function stopPoll() { if (poll) { clearInterval(poll); poll = undefined } }

async function show() {
  const my = ++token
  stopPoll()
  rect.value = null
  missing.value = false
  const s = step.value
  // The visitor already did what this step asks (the click took them to the next screen): move on.
  if (s.until?.() && idx.value > 0) { setTimeout(() => { if (my === token) go(1) }, 300); return }
  wrongScreen.value = !!s.at && !s.at()
  if (wrongScreen.value) { await nextTick(); place(); focusCard(); return }
  if (s.find) {
    const found = await waitFor(s.find, 4000)
    if (my !== token) return
    if (found) {
      found.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
      measure(found)
    } else missing.value = true
  }
  await nextTick()
  place()
  focusCard()
  setTimeout(() => { if (my === token) refresh() }, 350)
  setTimeout(() => { if (my === token) refresh() }, 800)
  if (s.until) {
    poll = setInterval(() => {
      if (my !== token) return stopPoll()
      if (s.until!()) { stopPoll(); setTimeout(() => { if (my === token) go(1) }, 500) } else refresh()
    }, 200)
  }
}

function waitFor(find: () => Element | null, ms: number): Promise<Element | null> {
  return new Promise((resolve) => {
    const start = performance.now()
    const tick = () => {
      const el = find()
      if (el && el.getBoundingClientRect().width > 0) return resolve(el)
      if (performance.now() - start > ms) return resolve(null)
      setTimeout(tick, 100)
    }
    tick()
  })
}

function measure(el: Element) {
  rect.value = el.getBoundingClientRect()
}

function place() {
  const c = card.value
  const vw = window.innerWidth
  // The strip along the bottom stays free: a host such as Netlify draws its own badge there, above everything else.
  const vh = window.innerHeight - 88
  const w = c?.offsetWidth ?? 340
  const h = c?.offsetHeight ?? 200
  const r = rect.value
  const gap = 14
  const clampX = (x: number) => Math.max(12, Math.min(x, vw - w - 12))
  const clampY = (y: number) => Math.max(12, Math.min(y, vh - h - 12))
  if (!r) { cardPos.value = { left: clampX((vw - w) / 2), top: clampY((vh - h) / 2) }; return }
  const pad = step.value.pad ?? 6
  if (r.bottom + pad + gap + h <= vh) cardPos.value = { left: clampX(r.left), top: r.bottom + pad + gap }
  else if (r.top - pad - gap - h >= 0) cardPos.value = { left: clampX(r.left), top: r.top - pad - gap - h }
  else if (r.left - gap - w >= 0) cardPos.value = { left: r.left - gap - w, top: clampY(r.top) }
  else if (r.right + gap + w <= vw) cardPos.value = { left: r.right + gap, top: clampY(r.top) }
  else cardPos.value = { left: clampX((vw - w) / 2), top: clampY(vh - h - 16) }
}

function focusCard() {
  const b = nextBtn.value?.$el ?? card.value?.querySelector<HTMLElement>('button')
  b?.focus({ preventScroll: true })
}

function start(at = 0) {
  idx.value = at
  active.value = true
  remember(true)
}
function end() {
  active.value = false
  token++
  stopPoll()
  remember(true)
}
function go(delta: number) {
  const n = idx.value + delta
  if (n < 0) return
  if (n >= steps.length) { end(); return }
  idx.value = n
}
function takeMeThere() {
  const to = step.value.to
  if (to) router.push(to)
}

watch([active, idx], () => {
  if (!active.value) return
  remember(false)
  show()
})
// Where the visitor is changes what a step can show: on the right screen the step finds its target by itself.
watch(() => route.fullPath, () => { if (active.value) setTimeout(show, 250) })

// A modal panel (the Move details drawer) hides everything outside it from assistive tech and from the pointer.
// The tour card is part of the tour, not of the page, so it clears that mark whenever it is added.
let guard: MutationObserver | undefined
function clearHidden() {
  const el = root.value
  if (!el) return
  el.removeAttribute('aria-hidden')
  el.removeAttribute('data-aria-hidden')
  el.removeAttribute('inert')
}
watch(active, async (on) => {
  guard?.disconnect()
  if (!on) return
  await nextTick()
  if (!root.value) return
  clearHidden()
  guard = new MutationObserver(clearHidden)
  guard.observe(root.value, { attributes: true, attributeFilter: ['aria-hidden', 'data-aria-hidden', 'inert'] })
})

// Keep the spotlight on its target while the page scrolls, resizes or a menu opens.
let raf = 0
function refresh() {
  if (!active.value || wrongScreen.value || !step.value.find) return
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    const el = step.value.find?.()
    if (el && el.getBoundingClientRect().width > 0) { measure(el); place() }
  })
}
function onKey(e: KeyboardEvent) {
  if (!active.value) return
  const t = e.target as HTMLElement | null
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
  if (e.key === 'Escape' && !document.querySelector('[role=menu], [role=dialog]:not(#demo-tour-card), [role=listbox]')) end()
  else if (e.key === 'ArrowRight' && !isAction.value) { e.preventDefault(); go(1) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
}

onMounted(() => {
  window.addEventListener('resize', refresh)
  window.addEventListener('scroll', refresh, true)
  window.addEventListener('keydown', onKey)
  let seen = true
  let resume = -1
  try {
    seen = !!localStorage.getItem(SEEN)
    const p = sessionStorage.getItem(PROGRESS)
    if (p !== null && Number.isInteger(+p) && +p >= 0 && +p < steps.length) resume = +p
  } catch { /* nothing remembered */ }
  if (resume >= 0) start(resume)
  else if (!seen && !navigator.webdriver) start(0)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', refresh)
  window.removeEventListener('scroll', refresh, true)
  window.removeEventListener('keydown', onKey)
  cancelAnimationFrame(raf)
  guard?.disconnect()
  stopPoll()
})

const spot = computed(() => {
  const r = rect.value
  if (!r || wrongScreen.value) return null
  const pad = step.value.pad ?? 6
  return { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` }
})
</script>

<template>
  <button
    type="button"
    class="shrink-0 inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 min-h-7 font-medium text-white hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-white"
    @click="start(0)"
  >
    <UIcon
      name="i-lucide-compass"
      class="size-3.5"
      aria-hidden="true"
    />
    Guide
  </button>

  <Teleport to="body">
    <div
      v-if="active"
      ref="root"
      class="fixed inset-0 z-[2000]"
      style="pointer-events: none"
    >
      <!-- Dim everything; with a target, the spotlight cuts a hole and leaves the target clickable. -->
      <div
        v-if="!spot"
        class="absolute inset-0 bg-slate-950/60"
        aria-hidden="true"
      />
      <div
        v-else
        class="absolute rounded-lg ring-2 ring-white/90 transition-[left,top,width,height] duration-200 motion-reduce:transition-none"
        :style="{ ...spot, boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.6)' }"
        aria-hidden="true"
      />

      <section
        id="demo-tour-card"
        ref="card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="demo-tour-title"
        aria-describedby="demo-tour-body"
        class="absolute w-[min(360px,calc(100vw-24px))] rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl dark:border-slate-600 dark:bg-slate-800 dark:text-[#e2e8f0]"
        :style="{ left: `${cardPos.left}px`, top: `${cardPos.top}px`, pointerEvents: 'auto' }"
      >
        <div class="flex items-center justify-between gap-3 mb-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Step {{ idx + 1 }} of {{ steps.length }}
          </p>
          <button
            type="button"
            class="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline underline-offset-2 rounded focus-visible:outline-2 focus-visible:outline-blue-600"
            @click="end"
          >
            Skip tour
          </button>
        </div>
        <h2
          id="demo-tour-title"
          class="text-base font-semibold text-slate-900 dark:text-white text-balance"
        >
          {{ wrongScreen ? 'This step is on another screen' : step.title }}
        </h2>
        <p
          id="demo-tour-body"
          class="mt-1.5 text-sm text-slate-700 dark:text-[#e2e8f0] text-pretty"
        >
          {{ wrongScreen ? `You have moved away from where this step happens: ${step.title}.` : step.body }}
        </p>
        <p
          v-if="isAction && step.doThis"
          class="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 dark:bg-blue-950 dark:text-white"
        >
          Your turn: {{ step.doThis }}
        </p>
        <p
          v-if="missing && !wrongScreen"
          class="mt-2 text-xs text-slate-600 dark:text-slate-400"
        >
          This part of the screen is not showing right now, so there is nothing to point at.
        </p>
        <div class="mt-4 flex items-center justify-between gap-2">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            label="Back"
            :disabled="idx === 0"
            @click="go(-1)"
          />
          <UButton
            v-if="wrongScreen"
            ref="nextBtn"
            color="primary"
            size="sm"
            label="Take me there"
            @click="takeMeThere"
          />
          <template v-else-if="isAction">
            <UButton
              ref="nextBtn"
              color="neutral"
              variant="ghost"
              size="sm"
              label="Skip this step"
              @click="go(1)"
            />
          </template>
          <UButton
            v-else
            ref="nextBtn"
            color="primary"
            size="sm"
            :label="last ? 'Finish' : idx === 0 ? 'Start the tour' : 'Next'"
            @click="go(1)"
          />
        </div>
        <div
          class="mt-3 flex gap-1"
          aria-hidden="true"
        >
          <span
            v-for="(_, i) in steps"
            :key="i"
            class="h-1 flex-1 rounded-full"
            :class="i <= idx ? 'bg-blue-600 dark:bg-blue-400' : 'bg-slate-200 dark:bg-slate-600'"
          />
        </div>
      </section>
    </div>
  </Teleport>
</template>
