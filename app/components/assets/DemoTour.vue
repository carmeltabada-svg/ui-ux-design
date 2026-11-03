<script setup lang="ts">
// Guided tour of the Assets prototype, for demos and user testing. Prototype scaffolding in the same way as the simulator
// bar, and it lives only on the demo-guide branch: it walks the visitor through the real screens with a spotlight and a
// card, and it touches no product page. It finds its targets by selector and text, so nothing in the pages carries a
// tour attribute. Delete this file and its two tags (layouts/assets.vue, SimulatorBar.vue) and the tour is gone.
const route = useRoute()
const router = useRouter()

const SEEN = 'ams:assets:tour:seen:v1'
const PROGRESS = 'ams:assets:tour:progress:v1'

interface Step {
  path?: string
  title: string
  body: string
  /** Finds the element to spotlight. No finder, or none found, shows the card in the middle. */
  find?: () => Element | null
  pad?: number
}

const UNIT = 'GT-CE-LTP-1233-0926-0013'
const byText = (sel: string, text: string) => () => [...document.querySelectorAll(sel)].find(e => (e.textContent ?? '').trim().startsWith(text)) ?? null

const steps: Step[] = [
  {
    path: '/assets',
    title: 'Welcome to the new Assets screens',
    body: 'This short tour shows how to find a unit, read its history and move it. Everything here is sample data, so go ahead and click around. You can leave at any time with Skip.'
  },
  {
    path: '/assets',
    title: 'Every unit, in one list',
    body: 'The heading counts the units, and the line under it says how many are with team members, at our locations, and at a supplier or client.',
    find: () => document.querySelector('main h1')
  },
  {
    path: '/assets',
    title: 'Narrow it down',
    body: 'Filter by status, type and more. The older statuses, such as Under Repair and In Transit, are in a Legacy group at the bottom of the status list.',
    find: () => document.querySelector('[aria-label="Filter by Status"]'),
    pad: 6
  },
  {
    path: '/assets',
    title: 'Move a unit from its row',
    body: 'Open this menu to check a unit in or out, return it to its supplier, or record a client pull-out. If an option is greyed out, hover it to see why.',
    find: () => document.querySelector('tbody tr:first-child button[aria-label^="Move "]'),
    pad: 6
  },
  {
    path: '/assets',
    title: 'Open a unit',
    body: 'Click a tag to open the unit. We will open one for you next.',
    find: () => document.querySelector('tbody tr:first-child td:nth-child(2) a, tbody tr:first-child td:nth-child(2) button'),
    pad: 6
  },
  {
    path: `/assets/${UNIT}`,
    title: 'Start a move from here too',
    body: 'The same menu is at the top of every unit, next to Edit details.',
    find: byText('button', 'Move asset'),
    pad: 6
  },
  {
    path: `/assets/${UNIT}`,
    title: 'Everything that happened to it',
    body: 'Custody history, Movements and the Activity feed keep a record of every status change and move, so you can always see who had a unit and when.',
    find: byText('a, button', 'Custody history'),
    pad: 6
  },
  {
    path: `/move-asset/${UNIT}/move`,
    title: 'Check In or Check Out',
    body: 'Choose the movement first. A Check In always goes to one of our locations. A Check Out goes to a team member or a supplier.',
    find: () => document.querySelectorAll('[role=radiogroup]')[0] ?? null,
    pad: 6
  },
  {
    path: `/move-asset/${UNIT}/move`,
    title: 'Where it is going',
    body: 'Pick the kind of place, then the place itself. Team members can be found by name, employee number or email.',
    find: () => document.querySelectorAll('[role=radiogroup]')[1] ?? null,
    pad: 6
  },
  {
    path: `/move-asset/${UNIT}/move`,
    title: 'The new status comes last',
    body: 'Choose the status once you know where the unit is going. Legacy statuses are at the bottom of the list.',
    find: () => document.querySelector('label[for=new-status]')?.parentElement ?? null,
    pad: 8
  },
  {
    path: '/move-asset/GT-CE-LTP-1180-0326-0042/move?kind=supplier',
    title: 'Returning a unit to its supplier',
    body: 'The status and the supplier address are filled in for you. Attach the signed agreement and say why the unit is going back.',
    find: byText('p', 'Supplier Return details'),
    pad: 10
  },
  {
    path: '/move-asset/GT-CE-LTP-1180-0326-0042/move?kind=supplier',
    title: 'A replacement is optional',
    body: 'Pick one now, or add it later from the unit. The question marks inside the list explain how the units are grouped.',
    find: () => document.querySelector('#rep'),
    pad: 8
  },
  {
    path: '/assets/GT-CE-LTP-0826-0005?moveDetails=1',
    title: 'Move details',
    body: 'Once a unit has been returned, this panel shows what was recorded. The replacement can still be added or changed here. Use the arrow keys to move through the tour while this panel is open.',
    find: () => document.querySelector('[role=dialog]:not(#demo-tour-card)'),
    pad: 0
  },
  {
    path: '/assets',
    title: 'That is the tour',
    body: 'Press Reset sample data in the dark bar to start again with fresh units. Choose Guide any time to see the tour again.'
  }
]

const active = ref(false)
const idx = ref(0)
const rect = ref<DOMRect | null>(null)
const missing = ref(false)
const card = ref<HTMLElement>()
const cardPos = ref({ left: 12, top: 12 })
const nextBtn = ref<{ $el?: HTMLElement } | null>(null)
const root = ref<HTMLElement>()

const step = computed(() => steps[idx.value]!)
const last = computed(() => idx.value === steps.length - 1)
const cardId = 'demo-tour-card'

function remember(seen: boolean) {
  try {
    if (seen) localStorage.setItem(SEEN, '1')
    if (active.value) sessionStorage.setItem(PROGRESS, String(idx.value))
    else sessionStorage.removeItem(PROGRESS)
  } catch { /* storage can be unavailable; the tour still works */ }
}

function matchesRoute(p?: string) {
  if (!p) return true
  const [path, query] = p.split('?')
  if (route.path !== path) return false
  if (query) return route.fullPath.endsWith(query) || Object.keys(route.query).length > 0
  return true
}

let token = 0
async function show() {
  const my = ++token
  rect.value = null
  missing.value = false
  const s = step.value
  if (s.path && !matchesRoute(s.path)) await router.push(s.path)
  if (my !== token) return
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
  // Panels and menus slide in; measure again once they have settled.
  setTimeout(() => { if (my === token) refresh() }, 350)
  setTimeout(() => { if (my === token) refresh() }, 800)
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
  const vh = window.innerHeight
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
  remember(true)
}
function go(delta: number) {
  const n = idx.value + delta
  if (n < 0) return
  if (n >= steps.length) { end(); return }
  idx.value = n
}

watch([active, idx], () => {
  if (!active.value) return
  remember(false)
  show()
})

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

// Keep the spotlight on its target while the page scrolls or resizes.
let raf = 0
function refresh() {
  if (!active.value || !step.value.find) return
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    const el = step.value.find?.()
    if (el) { measure(el); place() }
  })
}
function onKey(e: KeyboardEvent) {
  if (!active.value) return
  const t = e.target as HTMLElement | null
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
  if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
  else if (e.key === 'Escape') end()
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
})

const spot = computed(() => {
  const r = rect.value
  if (!r) return null
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
        :id="cardId"
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
          {{ step.title }}
        </h2>
        <p
          id="demo-tour-body"
          class="mt-1.5 text-sm text-slate-700 dark:text-[#e2e8f0] text-pretty"
        >
          {{ step.body }}
        </p>
        <p
          v-if="missing"
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
