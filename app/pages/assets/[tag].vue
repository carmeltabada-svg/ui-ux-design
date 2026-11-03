<script setup lang="ts">
// Asset detail, built from the "GoTeam Asset Detail Page" design: a sticky header (back, tag with copy, status,
// movement state, type, name, holder, actions), then a two column grid. The left column is one Asset Details
// card in sections (Identity, Location, Ownership & Finance, Tech Pack, Timestamps) with the pill tabs under
// it. The right rail holds Current Movement, QR Code and Warranty. Edit details turns the card into a form
// (Esc cancels, Cmd or Ctrl+S saves). Every tab reads the same store the Move Asset page writes to, so a move
// shows up in the Activity Feed and Movements straight away. Delete Asset and the model, location, owner and
// purchase order pages already exist in the system, so each one says so in a toast.
import {
  findAsset, isExited, moveHref, locationView, TYPE_ICON, assetsSimRole, assetsSimState, assetsSimCustody, assetsSimWarranty,
  assetsSimTransit, badgeDate, localToday, addMonths, type Asset
} from '~/data/assets'
import { movementsOf, custodyRowsFor } from '~/data/assetsActivity'
import {
  draftOf, draftProblems, saveAssetDetails, MODEL_OPTIONS, LOCATION_OPTIONS, OWNER_OPTIONS, PO_OPTIONS, TECH_PACK_OPTIONS,
  CURRENCY_OPTIONS, stampLabel, initialsOf, type DetailsDraft
} from '~/data/assetsDetail'

// Keyed by the tag, so moving from one asset to another starts a fresh page (no edit draft carried over).
definePageMeta({ layout: 'assets', key: route => String(route.params.tag) })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const tag = computed(() => String(route.params.tag ?? ''))
const asset = computed<Asset | undefined>(() => findAsset(tag.value))
useSeoMeta({ title: () => `${tag.value} - GoTeam Assets` })

const canEdit = computed(() => assetsSimRole.value === 'officer')
const canMove = computed(() => canEdit.value && !!asset.value && !isExited(asset.value))

// Move details open in a drawer over this page: from the header button, or straight from a link with ?moveDetails.
const moveDetailsOpen = ref(!!route.query.moveDetails)
watch(() => route.query.moveDetails, (v) => { if (v) moveDetailsOpen.value = true })
watch(moveDetailsOpen, (open) => {
  if (!open && route.query.moveDetails) router.replace({ query: { ...route.query, moveDetails: undefined } })
})
const movement = computed(() => asset.value ? movementsOf(asset.value)[0] : undefined)
const custody = computed(() => asset.value ? custodyRowsFor(asset.value, localToday()) : [])
const holder = computed(() => {
  if (assetsSimCustody.value !== 'data') {
    const current = custody.value.find(r => !r.to)
    if (current) return `Currently with ${current.member}`
    return custody.value.length ? `Last held by ${custody.value[0]!.member}` : 'No custodian'
  }
  const a = asset.value
  if (a?.status === 'Supplier Return') return 'At the supplier'
  if (a?.status === 'Client Pull-Out') return `Pulled out by ${a.client}`
  return a?.custodian || 'In stock'
})

const tabs = computed(() => [
  { label: 'Activity feed', icon: 'i-lucide-history', to: `/assets/${tag.value}/activity-feed` },
  { label: 'Movements', icon: 'i-lucide-arrow-left-right', to: `/assets/${tag.value}/movements` },
  { label: 'Custody history', icon: 'i-lucide-users', to: `/assets/${tag.value}/custody-history` },
  { label: 'Photos', icon: 'i-lucide-image', to: `/assets/${tag.value}/photos` },
  { label: 'Legacy tags', icon: 'i-lucide-tags', to: `/assets/${tag.value}/legacy-tags` }
])

const initials = initialsOf
function money(a: Asset) {
  return a.cost ? `${a.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
}
function info(title: string, description: string) {
  toast.add({ title, description, icon: 'i-lucide-info', color: 'info' })
}
const copyFlash = useCopyFlash()

// --- QR code: a placeholder with the real print and download actions ---------------------------------
const QR_N = 21
const qrModules = computed(() => {
  let h = 0
  for (const c of tag.value) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296 }
  const corners = [[0, 0], [0, QR_N - 7], [QR_N - 7, 0]]
  const inFinder = (r: number, c: number) => corners.find(([fr, fc]) => r >= fr! && r < fr! + 7 && c >= fc! && c < fc! + 7)
  return Array.from({ length: QR_N * QR_N }, (_, i) => {
    const r = Math.floor(i / QR_N); const c = i % QR_N
    const f = inFinder(r, c)
    if (!f) return rnd() > 0.52
    const rr = r - f[0]!; const cc = c - f[1]!
    return rr === 0 || rr === 6 || cc === 0 || cc === 6 || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4)
  })
})
function qrSvg(): string {
  const q = 2
  const size = QR_N + q * 2
  const rects = qrModules.value.map((on, i) => on ? `<rect x="${(i % QR_N) + q}" y="${Math.floor(i / QR_N) + q}" width="1" height="1"/>` : '').join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="320" height="320" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#0f172a">${rects}</g></svg>`
}
function downloadQr() {
  const url = URL.createObjectURL(new Blob([qrSvg()], { type: 'image/svg+xml' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${tag.value.replace(/[^\w.-]/g, '_')}-qr.svg`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ title: 'QR code downloaded', icon: 'i-lucide-download', color: 'success' })
}
function printQr() {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) { frame.remove(); return }
  doc.open()
  doc.write(`<!doctype html><title>${escapeText(tag.value)}</title><body style="margin:0;display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px;font-family:Inter,sans-serif">${qrSvg()}<div style="font-size:14px">${escapeText(tag.value)}</div></body>`)
  doc.close()
  frame.contentWindow?.focus()
  frame.contentWindow?.print()
  setTimeout(() => frame.remove(), 1000)
}

const menuItems = computed(() => [[
  { label: 'Delete asset', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => info('Delete Asset', 'Deleting an asset is an existing action. It is not changed by this task.') }
]])

const timestampsOpen = ref(false)
const created = computed(() => {
  const h = asset.value?.history[0]
  return asset.value ? stampLabel(h?.date ?? asset.value.statusDate, h?.id ?? asset.value.tag) : ''
})
const updated = computed(() => {
  const h = asset.value?.history[asset.value.history.length - 1]
  return asset.value ? stampLabel(asset.value.statusDate, h?.id ?? asset.value.tag) : ''
})

// --- Warranty --------------------------------------------------------------------------------------
// 12 months from the purchase date, which the sample data reads from the asset's first record.
// One answer for "is a PO linked": the warranty card and the Purchase Order field both read it, so they never disagree.
const effectivePo = computed(() => assetsSimWarranty.value === 'needs-po' ? '' : (asset.value?.po ?? ''))
const needsPo = computed(() => !effectivePo.value)
// A customer owned unit (BYOD) has a PO but no manufacturer warranty to calculate.
const noWarranty = computed(() => !needsPo.value && assetsSimWarranty.value === 'data' && asset.value?.warranty === 'No Warranty')
const warranty = computed(() => {
  const a = asset.value
  if (!a || needsPo.value || noWarranty.value) return null
  const today = new Date(`${localToday()}T00:00:00`)
  const mode = assetsSimWarranty.value
  const start = new Date(`${(mode === 'data' && a.orderDate) || a.history[0]?.date || a.statusDate}T00:00:00`)
  if (mode === 'data' && a.warranty === 'Already Expired' && !a.orderDate) start.setFullYear(start.getFullYear() - 2)
  // A forced state sets the purchase date so the expiry lands where the state says it should.
  if (mode === 'active') { start.setTime(today.getTime()); start.setMonth(start.getMonth() - 5) }
  if (mode === 'expiring') { start.setTime(today.getTime()); start.setFullYear(start.getFullYear() - 1); start.setDate(start.getDate() + 12) }
  if (mode === 'expired') { start.setTime(today.getTime()); start.setFullYear(start.getFullYear() - 1); start.setMonth(start.getMonth() - 7) }
  const months = mode === 'data' && a.orderDate && a.warrantyMonths ? a.warrantyMonths : 12
  const end = addMonths(start, months)
  const days = Math.round((end.getTime() - today.getTime()) / 86400000)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
  const remaining = days < 0 ? `Expired ${Math.max(1, Math.round(-days / 30))} mo ago` : days <= 30 ? `${days} days remaining` : `${Math.round(days / 30)} mo remaining`
  const tone = days < 0 ? 'error' : days <= 30 ? 'warning' : 'success'
  return { months, purchase: fmt(start), expiration: fmt(end), remaining, tone: tone as 'error' | 'warning' | 'success' }
})

// --- Edit details ----------------------------------------------------------------------------------
const scrollerEl = ref<HTMLElement>()
const editing = ref(false)
const draft = reactive<DetailsDraft>({ serial: '', model: '', location: '', owner: '', cost: '', po: '', techPack: '', currency: '' })
const tried = ref(false)
watch(tag, () => { editing.value = false })
const problems = computed(() => tried.value ? draftProblems(draft) : {})
const NONE = '__none'
const poValue = computed({ get: () => draft.po || NONE, set: (v: string) => { draft.po = v === NONE ? '' : v } })
const asItems = (list: string[]) => list.map(v => ({ label: v, value: v }))
const poItems = computed(() => [{ label: 'Not linked', value: NONE }, ...asItems(PO_OPTIONS)])

function startEdit(focus?: 'po') {
  if (!asset.value || !canEdit.value) return
  Object.assign(draft, draftOf(asset.value), { po: effectivePo.value })
  tried.value = false
  editing.value = true
  // Bring the card into view first, as the design does, then point at the field when a link sent us there.
  nextTick(() => {
    const panel = document.getElementById('asset-details-panel')
    const scroller = scrollerEl.value
    if (panel && scroller) {
      const header = scroller.querySelector<HTMLElement>('[data-detail-header]')?.offsetHeight ?? 0
      const top = panel.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - header - 16
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
    if (focus === 'po') {
      setTimeout(() => {
        const field = document.getElementById('po-field')
        if (!field) return
        field.scrollIntoView({ behavior: 'smooth', block: 'center' })
        flashElement(field)
        field.querySelector<HTMLElement>('button, input')?.focus({ preventScroll: true })
      }, 350)
    }
  })
}
function cancelEdit() {
  if (!editing.value) return
  editing.value = false
  toast.add({ title: 'Changes discarded', icon: 'i-lucide-undo-2', color: 'neutral' })
}
function saveEdit() {
  if (!editing.value) return
  tried.value = true
  if (Object.keys(draftProblems(draft)).length) {
    nextTick(() => document.querySelector('[data-edit-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return
  }
  saveAssetDetails(tag.value, draft)
  editing.value = false
  toast.add({ title: 'Asset details saved', icon: 'i-lucide-circle-check', color: 'success' })
}
function onKey(e: KeyboardEvent) {
  if (!editing.value) return
  if (e.key === 'Escape') {
    // An open menu or dialog owns Escape: do not throw the draft away behind it.
    if (e.defaultPrevented || document.querySelector('[role="listbox"], [role="dialog"]')) return
    e.preventDefault()
    cancelEdit()
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveEdit() }
}

// --- Tabs: arrows and edge fades appear only when the row overflows ---------------------------------
const tabsEl = ref<HTMLElement>()
const fadeLeft = ref(false)
const fadeRight = ref(false)
function updateFade() {
  const el = tabsEl.value
  if (!el) return
  fadeLeft.value = el.scrollLeft > 2
  fadeRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
}
function scrollTabs(dx: number) { tabsEl.value?.scrollBy({ left: dx, behavior: 'smooth' }) }

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', updateFade)
  nextTick(updateFade)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', updateFade)
})

// AA text colours for the time remaining badge (the stock subtle badge is 3.4:1 in green).
const WARRANTY_TONE = {
  success: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-950 dark:text-green-300',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300',
  error: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300'
}

const sectionLabel = 'text-xs font-semibold uppercase tracking-wide text-dimmed'
</script>

<template>
  <div
    v-if="assetsSimState === 'notfound' || !asset"
    class="px-6 py-16"
  >
    <div class="flex flex-col items-center text-center gap-2 text-muted">
      <UIcon
        name="i-lucide-search-x"
        class="size-6"
      />
      <p class="text-sm font-medium text-default">
        We couldn't find that asset
      </p>
      <p class="text-xs">
        The tag may be wrong or the unit may have been removed.
      </p>
      <UButton
        to="/assets"
        color="neutral"
        variant="outline"
        size="sm"
        label="Back to Assets"
        class="mt-1"
      />
    </div>
  </div>

  <div
    v-else
    ref="scrollerEl"
    class="h-full overflow-y-auto overscroll-contain bg-gray-50 dark:bg-transparent stage-enter"
  >
    <!-- Header -->
    <div
      data-detail-header
      class="sm:sticky top-0 z-20 bg-card border-b border-default px-4 sm:px-8 pt-5 sm:pt-6 pb-5"
    >
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div class="flex items-start gap-3 min-w-0 flex-1">
          <UTooltip text="Back to Assets">
            <UButton
              to="/assets"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              icon="i-lucide-arrow-left"
              aria-label="Back to Assets"
              class="text-muted shrink-0"
            />
          </UTooltip>
          <div class="min-w-0">
            <h1 class="flex items-center gap-2.5 text-2xl font-semibold text-highlighted leading-none mb-2.5">
              <span class="break-all">{{ asset.tag }}</span>
              <UTooltip :text="copyFlash.isCopied('tag') ? 'Copied' : 'Copy tag'">
                <UButton
                  :class="['shrink-0', { 'copy-flash': copyFlash.isCopied('tag') }]"
                  size="xs"
                  :color="copyFlash.isCopied('tag') ? 'success' : 'primary'"
                  variant="ghost"
                  square
                  :icon="copyFlash.icon('tag')"
                  :aria-label="copyFlash.label('tag', 'Copy tag')"
                  @click="copyFlash.copy('tag', asset.tag)"
                />
              </UTooltip>
            </h1>
            <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
              <AssetsStatusPill
                :status="asset.status"
                :sub="asset.sub"
                :date="asset.statusDate"
              />
              <span>·</span>
              <span
                v-if="movement"
                class="inline-flex items-center gap-1"
              >
                <UIcon
                  :name="movement.type === 'check_in' ? 'i-lucide-log-in' : 'i-lucide-log-out'"
                  class="size-3.5"
                  :class="movement.type === 'check_in' ? 'text-blue-500' : 'text-purple-500'"
                  aria-hidden="true"
                />
                {{ movement.type === 'check_in' ? 'Checked In' : 'Checked Out' }}
              </span>
              <span>·</span>
              <span class="inline-flex items-center gap-1"><UIcon
                :name="TYPE_ICON[asset.type] ?? 'i-lucide-layers'"
                class="size-3.5"
                aria-hidden="true"
              />{{ asset.type }}</span>
              <span>·</span>
              <span class="inline-flex items-center gap-1"><UIcon
                name="i-lucide-laptop"
                class="size-3.5"
                aria-hidden="true"
              />{{ asset.name }}</span>
              <span>·</span>
              <span class="inline-flex items-center gap-1"><UIcon
                name="i-lucide-users"
                class="size-3.5"
                aria-hidden="true"
              />{{ holder }}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 sm:shrink-0">
          <UButton
            v-if="!editing && canEdit"
            color="neutral"
            variant="outline"
            size="md"
            icon="i-lucide-pencil"
            label="Edit details"
            @click="startEdit()"
          />
          <AssetsMoveMenu
            v-if="canMove"
            :asset="asset"
            @select="(kind) => navigateTo(moveHref(asset!.tag, kind))"
          >
            <UButton
              color="neutral"
              variant="outline"
              size="md"
              icon="i-lucide-truck"
              trailing-icon="i-lucide-chevron-down"
              label="Move asset"
            />
          </AssetsMoveMenu>
          <UButton
            v-else-if="isExited(asset)"
            color="neutral"
            variant="outline"
            size="md"
            icon="i-lucide-clipboard-list"
            label="Move details"
            @click="moveDetailsOpen = true"
          />
          <UDropdownMenu
            :items="menuItems"
            :content="{ align: 'end' }"
          >
            <UButton
              color="neutral"
              variant="ghost"
              size="md"
              square
              icon="i-lucide-ellipsis"
              aria-label="More actions"
            />
          </UDropdownMenu>
        </div>
      </div>
    </div>

    <!-- Content grid -->
    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_313px] items-start gap-6 px-4 sm:px-8 py-6">
      <!-- Left -->
      <div class="min-w-0 flex flex-col gap-6">
        <section
          id="asset-details-panel"
          class="rounded-lg border bg-card overflow-hidden scroll-mt-32 transition-shadow"
          :class="editing ? 'border-primary ring-[3px] ring-primary/15' : 'border-default'"
        >
          <p
            v-if="editing"
            class="px-6 py-2.5 bg-primary/10 text-primary text-xs font-medium inline-flex items-center gap-2 w-full"
            role="status"
          >
            <UIcon
              name="i-lucide-pencil"
              class="size-3.5"
              aria-hidden="true"
            />
            Editing asset details. Press Esc to cancel, Cmd+S or Ctrl+S to save.
          </p>
          <div class="p-6 flex flex-col gap-6">
            <div class="flex flex-col gap-2.5">
              <p :class="sectionLabel">
                Identity
              </p>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                <div class="flex flex-col gap-1.5">
                  <dt class="text-xs text-muted">
                    Tag
                  </dt>
                  <dd class="text-sm text-highlighted inline-flex items-center gap-1.5 break-all">
                    <UIcon
                      name="i-lucide-tag"
                      class="size-4 text-dimmed shrink-0"
                      aria-hidden="true"
                    />{{ asset.tag }}
                  </dd>
                </div>
                <div class="flex flex-col gap-1.5">
                  <dt class="text-xs text-muted">
                    <label for="serial-field">Serial</label> <span
                      v-if="editing"
                      class="text-red-600"
                    >*</span>
                  </dt>
                  <dd
                    v-if="!editing"
                    class="text-sm text-highlighted inline-flex items-center gap-1.5"
                  >
                    <UIcon
                      name="i-lucide-hash"
                      class="size-4 text-dimmed shrink-0"
                      aria-hidden="true"
                    />{{ asset.serial }}
                    <UTooltip :text="copyFlash.isCopied('serial') ? 'Copied' : 'Copy serial'">
                      <UButton
                        :class="['shrink-0', { 'copy-flash': copyFlash.isCopied('serial') }]"
                        size="xs"
                        :color="copyFlash.isCopied('serial') ? 'success' : 'primary'"
                        variant="ghost"
                        square
                        :icon="copyFlash.icon('serial')"
                        :aria-label="copyFlash.label('serial', 'Copy serial')"
                        @click="copyFlash.copy('serial', asset.serial)"
                      />
                    </UTooltip>
                  </dd>
                  <dd v-else>
                    <UInput
                      id="serial-field"
                      v-model="draft.serial"
                      icon="i-lucide-hash"
                      placeholder="e.g. 5CD5281W0J"
                      class="w-full"
                      :color="problems.serial ? 'error' : undefined"
                    />
                    <p
                      v-if="problems.serial"
                      data-edit-error
                      class="text-xs text-red-600 mt-1.5"
                    >
                      {{ problems.serial }}
                    </p>
                    <p
                      v-else
                      class="text-xs text-helper mt-1.5"
                    >
                      Manufacturer's serial number
                    </p>
                  </dd>
                </div>
                <div class="flex flex-col gap-1.5">
                  <dt class="text-xs text-muted">
                    Name
                  </dt>
                  <dd class="text-sm text-highlighted inline-flex items-center gap-1.5">
                    <UIcon
                      name="i-lucide-laptop"
                      class="size-4 text-dimmed shrink-0"
                      aria-hidden="true"
                    />{{ asset.name }}
                  </dd>
                </div>
                <div class="flex flex-col gap-1.5">
                  <dt class="text-xs text-muted">
                    Model <span
                      v-if="editing"
                      class="text-red-600"
                    >*</span>
                  </dt>
                  <dd
                    v-if="!editing"
                    class="text-sm inline-flex items-center gap-1.5"
                  >
                    <UIcon
                      name="i-lucide-cpu"
                      class="size-4 shrink-0 text-dimmed"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      class="text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left"
                      @click="info(asset.model, 'This opens the asset model detail page. It is an existing view in the system and out of scope for this task.')"
                    >
                      {{ asset.model }}
                    </button>
                    <UTooltip :text="copyFlash.isCopied('model') ? 'Copied' : 'Copy model'">
                      <UButton
                        :class="['shrink-0', { 'copy-flash': copyFlash.isCopied('model') }]"
                        size="xs"
                        :color="copyFlash.isCopied('model') ? 'success' : 'primary'"
                        variant="ghost"
                        square
                        :icon="copyFlash.icon('model')"
                        :aria-label="copyFlash.label('model', 'Copy model')"
                        @click="copyFlash.copy('model', asset.model)"
                      />
                    </UTooltip>
                  </dd>
                  <dd v-else>
                    <SharedSelect
                      v-model="draft.model"
                      :items="asItems(MODEL_OPTIONS)"
                      icon="i-lucide-cpu"
                      placeholder="Select model"
                      class="w-full"
                      :color="problems.model ? 'error' : undefined"
                      aria-label="Model"
                    />
                    <p
                      v-if="problems.model"
                      data-edit-error
                      class="text-xs text-red-600 mt-1.5"
                    >
                      {{ problems.model }}
                    </p>
                    <p
                      v-else
                      class="text-xs text-helper mt-1.5"
                    >
                      Pick the exact model this unit is
                    </p>
                  </dd>
                </div>
              </dl>
            </div>

            <div class="flex flex-col gap-3">
              <p :class="sectionLabel">
                Location <span
                  v-if="editing"
                  class="text-red-600"
                >*</span>
              </p>
              <p
                v-if="!editing"
                class="text-sm inline-flex items-start gap-1.5"
              >
                <UIcon
                  :name="locationView(asset).icon"
                  class="size-4 shrink-0 mt-0.5 text-dimmed"
                  aria-hidden="true"
                />
                <!-- Only an office from the Locations page is a link. A team member's address, a supplier and a client are plain text. -->
                <UTooltip :text="locationView(asset).tip">
                  <button
                    v-if="locationView(asset).kind === 'location'"
                    type="button"
                    class="text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left break-words"
                    @click="info('Location', 'This opens the location page. It is an existing view in the system and out of scope for this task.')"
                  >
                    {{ locationView(asset).text }}
                  </button>
                  <span
                    v-else
                    class="text-highlighted break-words"
                  >{{ locationView(asset).text }}</span>
                </UTooltip>
              </p>
              <div v-else>
                <SharedSelect
                  v-model="draft.location"
                  :items="asItems(LOCATION_OPTIONS)"
                  icon="i-lucide-map-pin"
                  placeholder="Select location"
                  class="w-full"
                  :color="problems.location ? 'error' : undefined"
                  aria-label="Location"
                />
                <p
                  v-if="problems.location"
                  data-edit-error
                  class="text-xs text-red-600 mt-1.5"
                >
                  {{ problems.location }}
                </p>
                <p
                  v-else
                  class="text-xs text-helper mt-1.5"
                >
                  Where this asset currently lives
                </p>
              </div>
            </div>

            <div class="flex flex-col gap-2.5">
              <p :class="sectionLabel">
                Ownership &amp; finance
              </p>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                <div class="flex flex-col gap-1.5">
                  <dt class="text-xs text-muted">
                    Owner <span
                      v-if="editing"
                      class="text-red-600"
                    >*</span>
                  </dt>
                  <dd
                    v-if="!editing"
                    class="text-sm inline-flex items-center gap-2"
                  >
                    <span
                      class="inline-flex items-center justify-center shrink-0 rounded-md bg-elevated size-6 text-xs font-medium text-slate-600 dark:text-slate-300"
                      aria-hidden="true"
                    >{{ initials(asset.owner) }}</span>
                    <button
                      type="button"
                      class="text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left"
                      @click="info(asset.owner, 'This opens the client page. It is an existing view in the system and out of scope for this task.')"
                    >
                      {{ asset.owner }}
                    </button>
                  </dd>
                  <dd v-else>
                    <SharedSelect
                      v-model="draft.owner"
                      :items="asItems(OWNER_OPTIONS)"
                      placeholder="Select owner"
                      class="w-full"
                      :color="problems.owner ? 'error' : undefined"
                      aria-label="Owner"
                    />
                    <p
                      v-if="problems.owner"
                      data-edit-error
                      class="text-xs text-red-600 mt-1.5"
                    >
                      {{ problems.owner }}
                    </p>
                    <p
                      v-else
                      class="text-xs text-helper mt-1.5"
                    >
                      Legal owner entity of this asset
                    </p>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-refresh-cw"
                      label="Use GoTeam (default)"
                      class="mt-1 -ml-2"
                      @click="draft.owner = 'GoTeam'"
                    />
                  </dd>
                </div>
                <div class="flex flex-col gap-1.5">
                  <dt class="text-xs text-muted">
                    Acquisition Cost ({{ editing ? draft.currency : asset.currency }}) <span
                      v-if="editing"
                      class="text-red-600"
                    >*</span>
                  </dt>
                  <dd
                    v-if="!editing"
                    class="text-sm text-highlighted tabular-nums"
                  >
                    <template v-if="money(asset)">
                      {{ money(asset) }}
                    </template>
                    <AssetsEmptyMark v-else />
                  </dd>
                  <dd v-else>
                    <UInput
                      v-model="draft.cost"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      class="w-full"
                      :color="problems.cost ? 'error' : undefined"
                      aria-label="Acquisition cost"
                    />
                    <p
                      v-if="problems.cost"
                      data-edit-error
                      class="text-xs text-red-600 mt-1.5"
                    >
                      {{ problems.cost }}
                    </p>
                    <p
                      v-else
                      class="text-xs text-helper mt-1.5"
                    >
                      Enter 0 if there was no cost
                    </p>
                  </dd>
                </div>
                <div
                  id="po-field"
                  class="flex flex-col gap-1.5 scroll-mt-40"
                >
                  <dt class="text-xs text-muted">
                    Purchase Order
                  </dt>
                  <dd
                    v-if="!editing"
                    class="text-sm text-highlighted inline-flex items-center gap-1.5"
                  >
                    <UIcon
                      name="i-lucide-file-text"
                      class="size-4 text-dimmed shrink-0"
                      aria-hidden="true"
                    />
                    <button
                      v-if="effectivePo"
                      type="button"
                      class="text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left"
                      @click="info(effectivePo, 'This opens the purchase order page. It is an existing view in the system and out of scope for this task.')"
                    >
                      {{ effectivePo }}
                    </button>
                    <span
                      v-else
                      class="text-placeholder"
                    >Not linked</span>
                  </dd>
                  <dd v-else>
                    <div class="flex items-center gap-2">
                      <SharedSelect
                        v-model="poValue"
                        :items="poItems"
                        placeholder="Select purchase order"
                        class="flex-1"
                        aria-label="Purchase order"
                      />
                      <UTooltip text="Clear selection">
                        <UButton
                          color="neutral"
                          variant="outline"
                          size="sm"
                          square
                          icon="i-lucide-x"
                          aria-label="Clear selection"
                          :disabled="!draft.po"
                          @click="draft.po = ''"
                        />
                      </UTooltip>
                    </div>
                  </dd>
                </div>
              </dl>
            </div>

            <div class="flex flex-col gap-2.5">
              <p :class="sectionLabel">
                Tech pack
              </p>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                <div class="flex flex-col gap-1.5">
                  <dt class="text-xs text-muted">
                    Type <span
                      v-if="editing"
                      class="text-red-600"
                    >*</span>
                  </dt>
                  <dd v-if="!editing">
                    <AssetsTechPackBadge
                      :type="asset.techPack"
                      :tier="asset.tier"
                    />
                  </dd>
                  <dd v-else>
                    <SharedSelect
                      v-model="draft.techPack"
                      :items="asItems(TECH_PACK_OPTIONS)"
                      class="w-full"
                      aria-label="Tech pack type"
                    />
                  </dd>
                </div>
                <div class="flex flex-col gap-1.5">
                  <dt class="text-xs text-muted">
                    Currency <span
                      v-if="editing"
                      class="text-red-600"
                    >*</span>
                  </dt>
                  <dd
                    v-if="!editing"
                    class="text-sm text-highlighted inline-flex items-center gap-1.5"
                  >
                    <UIcon
                      name="i-lucide-banknote"
                      class="size-4 text-dimmed shrink-0"
                      aria-hidden="true"
                    />{{ asset.currency }}
                  </dd>
                  <dd v-else>
                    <URadioGroup
                      v-model="draft.currency"
                      :items="asItems(CURRENCY_OPTIONS)"
                      orientation="horizontal"
                      color="primary"
                      aria-label="Currency"
                    />
                    <p class="text-xs text-helper mt-1.5">
                      Currency the acquisition cost is in
                    </p>
                  </dd>
                </div>
              </dl>
            </div>

            <div class="flex flex-col gap-2.5">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 text-left"
                :class="sectionLabel"
                :aria-expanded="timestampsOpen"
                @click="timestampsOpen = !timestampsOpen"
              >
                <UIcon
                  :name="timestampsOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                  class="size-3.5"
                  aria-hidden="true"
                />Timestamps
              </button>
              <dl
                v-if="timestampsOpen"
                class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5"
              >
                <div class="flex flex-col gap-1.5">
                  <dt class="text-xs text-muted">
                    Created
                  </dt>
                  <dd class="text-sm text-highlighted inline-flex items-center gap-1.5">
                    <UIcon
                      name="i-lucide-calendar"
                      class="size-4 text-dimmed"
                      aria-hidden="true"
                    />{{ created }}
                  </dd>
                </div>
                <div class="flex flex-col gap-1.5">
                  <dt class="text-xs text-muted">
                    Updated
                  </dt>
                  <dd class="text-sm text-highlighted inline-flex items-center gap-1.5">
                    <UIcon
                      name="i-lucide-calendar"
                      class="size-4 text-dimmed"
                      aria-hidden="true"
                    />{{ updated }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div
            v-if="editing"
            class="px-6 py-3.5 bg-elevated/50 border-t border-default flex justify-end gap-2"
          >
            <UButton
              color="neutral"
              variant="outline"
              size="md"
              label="Cancel"
              @click="cancelEdit"
            />
            <UButton
              color="primary"
              size="md"
              label="Save changes"
              @click="saveEdit"
            />
          </div>
        </section>

        <!-- Pill tabs: each is its own route, like the live page -->
        <div>
          <div class="relative mb-5">
            <nav
              ref="tabsEl"
              class="flex gap-1 overflow-x-auto [scrollbar-width:none]"
              aria-label="Asset sections"
              @scroll="updateFade"
            >
              <NuxtLink
                v-for="t in tabs"
                :key="t.to"
                :to="t.to"
                class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors"
                :class="route.path === t.to ? 'text-blue-600 ring-1 ring-inset ring-default bg-card' : 'text-muted hover:text-default hover:bg-elevated'"
              >
                <UIcon
                  :name="t.icon"
                  class="size-4"
                  aria-hidden="true"
                />{{ t.label }}
              </NuxtLink>
            </nav>
            <template v-if="fadeLeft">
              <span
                class="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-gray-50 to-transparent"
                aria-hidden="true"
              />
              <UButton
                color="neutral"
                variant="outline"
                size="xs"
                square
                icon="i-lucide-chevron-left"
                aria-label="Scroll tabs left"
                class="absolute left-0 top-1/2 -translate-y-1/2 bg-card"
                @click="scrollTabs(-160)"
              />
            </template>
            <template v-if="fadeRight">
              <span
                class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-gray-50 to-transparent"
                aria-hidden="true"
              />
              <UButton
                color="neutral"
                variant="outline"
                size="xs"
                square
                icon="i-lucide-chevron-right"
                aria-label="Scroll tabs right"
                class="absolute right-0 top-1/2 -translate-y-1/2 bg-card"
                @click="scrollTabs(160)"
              />
            </template>
          </div>
          <NuxtPage :transition="false" />
        </div>
      </div>

      <!-- Right rail -->
      <aside class="flex flex-col gap-4 xl:sticky xl:top-[7.5rem]">
        <section class="rounded-lg border border-default bg-card overflow-hidden">
          <p class="px-4 py-2.5 bg-slate-50 dark:bg-gray-800/60 border-b border-default inline-flex items-center gap-2 w-full text-xs font-semibold uppercase tracking-wide text-default">
            Current movement
          </p>
          <div
            v-if="movement"
            class="p-4 flex flex-col gap-6"
          >
            <div class="min-w-0">
              <div class="text-xs font-normal text-default">
                Status
              </div>
              <div class="text-sm text-highlighted mt-1 flex items-center gap-2">
                <UIcon
                  :name="movement.type === 'check_in' ? 'i-lucide-log-in' : 'i-lucide-log-out'"
                  class="size-4"
                  :class="movement.type === 'check_in' ? 'text-blue-500' : 'text-purple-500'"
                  aria-hidden="true"
                />
                {{ movement.type === 'check_in' ? 'Checked In' : 'Checked Out' }}
                <span
                  v-if="assetsSimTransit === 'transit'"
                  class="ml-auto inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="WARRANTY_TONE.warning"
                >Receipt open</span>
                <span
                  v-else-if="assetsSimTransit === 'inuse'"
                  class="ml-auto inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="WARRANTY_TONE.success"
                >Receipt confirmed</span>
              </div>
            </div>
            <div class="min-w-0">
              <div class="text-xs font-normal text-default">
                Date
              </div>
              <div class="text-sm text-highlighted mt-1 flex items-center gap-1.5">
                <UIcon
                  name="i-lucide-calendar"
                  class="size-4 text-dimmed shrink-0"
                  aria-hidden="true"
                />{{ badgeDate(movement.date) }}
              </div>
            </div>
            <div class="min-w-0">
              <div class="text-xs font-normal text-default">
                Location
              </div>
              <div class="text-sm text-highlighted mt-1 flex items-start gap-1.5">
                <UIcon
                  :name="movement.locationIcon"
                  class="size-4 mt-0.5 text-dimmed shrink-0"
                  aria-hidden="true"
                /><span class="break-words min-w-0">{{ movement.location }}</span>
              </div>
            </div>
            <div class="min-w-0">
              <div class="text-xs font-normal text-default">
                {{ movement.member ? 'Checked out to' : 'Checked in by' }}
              </div>
              <div class="text-sm text-highlighted mt-1 flex items-center gap-2">
                <span
                  class="inline-flex items-center justify-center rounded-full size-6 text-xs font-semibold bg-blue-100 text-blue-700"
                  aria-hidden="true"
                >{{ initials(movement.member || movement.by) }}</span>{{ movement.member || movement.by }}
              </div>
            </div>
          </div>
          <p
            v-else
            class="p-4 text-sm text-placeholder"
          >
            No movement recorded yet.
          </p>
        </section>

        <section class="rounded-lg border border-default bg-card overflow-hidden">
          <p class="px-4 py-2.5 bg-slate-50 dark:bg-gray-800/60 border-b border-default inline-flex items-center gap-2 w-full text-xs font-semibold uppercase tracking-wide text-default">
            QR code
          </p>
          <div class="p-4 flex flex-col gap-4">
            <div class="flex items-center gap-4">
              <div
                class="size-[142px] shrink-0 rounded bg-white ring-1 ring-inset ring-gray-200 p-2 flex items-center justify-center"
                role="img"
                :aria-label="`QR code for ${asset.tag}`"
              >
                <div class="grid grid-cols-[repeat(21,1fr)] size-full">
                  <div
                    v-for="(on, i) in qrModules"
                    :key="i"
                    class="aspect-square"
                    :class="on ? 'bg-slate-900' : 'bg-white'"
                  />
                </div>
              </div>
              <div class="min-w-0 flex-1 flex flex-col gap-1.5">
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-printer"
                  label="Print"
                  block
                  @click="printQr"
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-download"
                  label="Download"
                  block
                  @click="downloadQr"
                />
              </div>
            </div>
            <p class="text-xs text-muted flex items-center gap-1.5">
              <UIcon
                name="i-lucide-scan-line"
                class="size-4 text-dimmed shrink-0"
                aria-hidden="true"
              />Scan this QR code to quickly access this asset.
            </p>
          </div>
        </section>

        <section class="rounded-lg border border-default bg-card overflow-hidden">
          <p class="px-4 py-2.5 bg-slate-50 dark:bg-gray-800/60 border-b border-default inline-flex items-center gap-2 w-full text-xs font-semibold uppercase tracking-wide text-default">
            Warranty
          </p>
          <div class="p-4">
            <div
              v-if="warranty"
              class="flex flex-col gap-6"
            >
              <div class="min-w-0">
                <div class="text-xs font-normal text-default">
                  Asset model
                </div>
                <div class="text-sm mt-1 flex items-center gap-1.5">
                  <UIcon
                    name="i-lucide-cpu"
                    class="size-4 text-dimmed shrink-0"
                    aria-hidden="true"
                  /><button
                    type="button"
                    class="text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left"
                    @click="info(asset.model, 'This opens the asset model detail page. It is an existing view in the system and out of scope for this task.')"
                  >
                    {{ asset.model }}
                  </button>
                </div>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-normal text-default">
                  Warranty period
                </div>
                <div class="text-sm text-highlighted mt-1 flex items-center gap-1.5">
                  <UIcon
                    name="i-lucide-shield-check"
                    class="size-4 text-dimmed shrink-0"
                    aria-hidden="true"
                  />{{ warranty.months }} months from the purchase date
                </div>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-normal text-default">
                  Purchase date
                </div>
                <div class="text-sm text-highlighted mt-1 flex items-center gap-1.5">
                  <UIcon
                    name="i-lucide-calendar-plus"
                    class="size-4 text-dimmed shrink-0"
                    aria-hidden="true"
                  />{{ warranty.purchase }}
                </div>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-normal text-default">
                  Expiration date
                </div>
                <div class="text-sm text-highlighted mt-1 flex items-center gap-1.5">
                  <UIcon
                    name="i-lucide-calendar-x"
                    class="size-4 text-dimmed shrink-0"
                    aria-hidden="true"
                  />{{ warranty.expiration }}
                </div>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-normal text-default">
                  Time remaining
                </div>
                <div class="mt-1 flex items-center gap-1.5">
                  <UIcon
                    name="i-lucide-hourglass"
                    class="size-4 text-dimmed shrink-0"
                    aria-hidden="true"
                  /><span
                    class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                    :class="WARRANTY_TONE[warranty.tone]"
                  >{{ warranty.remaining }}</span>
                </div>
              </div>
              <p class="text-xs text-helper">
                Calculated from the purchase order's order date and the asset model's set warranty period.
              </p>
            </div>
            <div
              v-else
              class="flex flex-col gap-3"
            >
              <p
                v-if="noWarranty"
                class="text-sm text-placeholder"
              >
                No manufacturer warranty. This unit is covered by its owner, not by GoTeam.
              </p>
              <p
                v-else
                class="text-sm text-placeholder"
              >
                Coverage can't be calculated yet. It needs a linked purchase order and the asset model's warranty period.
              </p>
              <UButton
                v-if="canEdit && needsPo"
                color="primary"
                variant="link"
                size="sm"
                trailing-icon="i-lucide-arrow-right"
                label="Link PO"
                class="self-start -ml-2.5"
                @click="startEdit('po')"
              />
            </div>
          </div>
        </section>
      </aside>
    </div>

    <!-- Move details, in a drawer over this page -->
    <AssetsMoveDetailsDrawer
      v-if="asset"
      v-model:open="moveDetailsOpen"
      :tag="asset.tag"
    />
  </div>
</template>
