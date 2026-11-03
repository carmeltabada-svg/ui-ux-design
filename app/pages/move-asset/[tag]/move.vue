<script setup lang="ts">
// Move Asset. The kind of move is chosen before this page opens (see MoveMenu), the way the ticket tracker asks for
// the ticket type before Create Ticket, so the form never rearranges itself after the officer has started:
//  - a Check In or Check Out to any status: the fields and their order follow the live Move Asset page (movement type,
//    location type, the asset location, supplier or team member, who did it, the note, and the new status last), and
//    Charged Deduction adds its two optional documents, as in the live app;
//  - a return to the supplier, or a client pull-out: the movement is fixed (a Check Out to the supplier or the client),
//    so it is shown, not asked, and the required exit details follow. Because an exit is final, a confirm step with named
//    buttons sits before the save.
import {
  findAsset, statusPickerOptions, STATUSES, docProblem, missingForExit, exitMovement,
  replacementGroups, exitAsset, emptyExitForm, DOC_ACCEPT, fileSize, CURRENT_OFFICER,
  badgeDate, assetsSimState, isExited, missingKeys, locationView, openDoc, TYPE_ICON, TECH_PACK_STYLE,
  moveAsset, supplierAddress, assetLocationOptions, supplierOptions, memberAddress, moveHref, moveKindOf, pullOutReason,
  type MoveKind, type Asset, type ExitKind, type MissingKey, type MovementType, type LocationType
} from '~/data/assets'
import { teamMemberOptions } from '~/data/assetsActivity'

definePageMeta({ layout: 'assets', key: route => `${route.params.tag}:${route.query.kind ?? 'move'}` })

const route = useRoute()
const router = useRouter()
const toast = useToast()
// The same clickable values as the asset detail page: the model and the location open their own pages (existing
// views, out of scope here), and the tag, serial and model copy with the same flash.
function info(title: string, description: string) {
  toast.add({ title, description, icon: 'i-lucide-info', color: 'info' })
}
const copyFlash = useCopyFlash()
const LINK = 'text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left'

const tag = computed(() => String(route.params.tag ?? ''))
const asset = computed<Asset | undefined>(() => findAsset(tag.value))
useSeoMeta({ title: () => `Move ${tag.value} - GoTeam Assets` })

// The kind of move, from the menu that opened this page. It fixes the layout for the whole visit.
const kind = computed<MoveKind>(() => moveKindOf(route.query.kind))
const pickerOptions = statusPickerOptions()
const pullOutBlockedReason = computed(() => kind.value === 'client' && asset.value ? pullOutReason(asset.value) : '')
const subtitle = computed(() => kind.value === 'supplier'
  ? 'Return this unit to its supplier.'
  : (kind.value === 'client' ? 'Record the client pulling this unit out.' : 'Check this unit in or out and set its status.'))

const chosenStatus = ref(kind.value === 'supplier' ? 'Supplier Return' : (kind.value === 'client' ? 'Client Pull-Out' : ''))
const chosenDef = computed(() => STATUSES.find(s => s.name === chosenStatus.value))
const exitKind = computed<ExitKind | undefined>(() => chosenDef.value?.exit)
const form = reactive(emptyExitForm())
const fileError = ref('')
const showErrors = ref(false)
const confirmOpen = ref(false)
const fileInput = ref<HTMLInputElement>()

const derived = computed(() => (exitKind.value && asset.value) ? exitMovement(exitKind.value, asset.value) : null)
const docLabel = computed(() => exitKind.value === 'supplier' ? 'Supplier return agreement' : 'Client instruction')
const replacementOptions = computed(() => asset.value ? replacementGroups(asset.value.tag) : { supplier: [], similar: [] })

// --- The movement, in the order of the live Move Asset page ------------------------------------------------------
const MOVEMENT_TYPES = [
  { value: 'check_in', label: 'Check In', icon: 'i-lucide-log-in' },
  { value: 'check_out', label: 'Check Out', icon: 'i-lucide-log-out' }
] as const
const LOCATION_TYPES = [
  { value: 'asset_location', label: 'Asset Location', icon: 'i-lucide-map-pin', description: 'A physical location where the asset is stored' },
  { value: 'user_address', label: 'User Address', icon: 'i-lucide-house', description: 'The asset goes to a team member\'s address' },
  { value: 'supplier', label: 'Supplier', icon: 'i-lucide-truck', description: 'The asset is at a supplier\'s facility' }
] as const

const movementType = ref<'' | MovementType>('')
const locationType = ref<'' | LocationType>('')
const assetLocation = ref('')
const supplier = ref('')
const memberTo = ref('')
// True while the form sets its own values (a default, or a status that fixes the movement), so the watchers below
// don't treat it as the officer changing a field.
const applying = ref(false)

// The unit comes back in when it is out, and goes out when it is in (the live page's default).
function defaultMovement(): MovementType { return asset.value?.movementStatus === 'Checked Out' ? 'check_in' : 'check_out' }
// A return to the supplier is a Check Out to the supplier; a client pull-out is a Check Out to the client, with the team
// member who has the unit. Anything else starts from the default.
function applyInitial() {
  const a = asset.value
  if (!a) return
  applying.value = true
  assetLocation.value = ''
  if (kind.value === 'supplier') {
    movementType.value = 'check_out'
    locationType.value = 'supplier'
    supplier.value = a.supplier
    memberTo.value = ''
  } else if (kind.value === 'client') {
    movementType.value = 'check_out'
    locationType.value = 'user_address'
    supplier.value = ''
    memberTo.value = a.custodian
  } else {
    movementType.value = defaultMovement()
    locationType.value = movementType.value === 'check_in' ? 'asset_location' : 'user_address'
    supplier.value = ''
    memberTo.value = ''
  }
  nextTick(() => { applying.value = false })
}
watch(asset, (a, old) => { if (a && a.tag !== old?.tag) applyInitial() }, { immediate: true })

watch(movementType, (type) => {
  if (applying.value) return
  locationType.value = type === 'check_in' ? 'asset_location' : 'user_address'
  assetLocation.value = ''
  supplier.value = ''
  memberTo.value = ''
})
watch(locationType, () => {
  if (applying.value) return
  assetLocation.value = ''
  supplier.value = ''
  memberTo.value = ''
})

// A Supplier Return or a Client Pull-Out is always a Check Out, to the supplier or to the client. Choosing one sets the
// movement and locks it; choosing anything else gives the movement back its defaults.
const effectiveLocationType = computed<'' | LocationType>(() => movementType.value === 'check_in' ? 'asset_location' : locationType.value)
const locationItems = computed(() => assetLocationOptions().map(v => ({ label: v, value: v })))
const supplierItems = computed(() => supplierOptions().map(v => ({ label: v, value: v })))
// Two lines, as in the retrieval ticket's team member search: the name, then the employee number and the email.
const memberItems = computed(() => teamMemberOptions().map(m => ({ label: m.name, value: m.name, empNo: m.empNo, email: m.email })))
const locationTypeItems = computed(() => LOCATION_TYPES.map(o => ({
  value: o.value, label: o.label, description: o.description, icon: o.icon,
  // A Check In always goes to an asset location.
  disabled: movementType.value === 'check_in' && o.value !== 'asset_location'
})))
// The icon cards of the retrieval workspace (Return Check routing, the case outcome): same classes, same selected state.
const CARD_UI = {
  legend: 'text-xs font-normal text-default mb-2',
  root: 'w-full',
  fieldset: 'w-full grid grid-cols-1 sm:grid-cols-3 gap-2',
  item: 'group w-full items-center py-2.5 px-4 has-data-[state=checked]:bg-primary/5',
  icon: 'transition-colors group-has-data-[state=checked]:text-primary size-4',
  label: 'transition-colors group-has-data-[state=checked]:text-blue-700 dark:group-has-data-[state=checked]:text-primary text-sm',
  description: 'transition-colors text-xs group-has-data-[state=checked]:text-default'
}
const byLabel = computed(() => movementType.value === 'check_in' ? 'Checked in by' : (movementType.value === 'check_out' ? 'Checked out by' : 'Moved by'))
// Where the unit will be, spelled out under the field that picks it.
const whereText = computed(() => {
  if (exitKind.value && derived.value) return derived.value.location
  if (effectiveLocationType.value === 'supplier') return supplier.value ? supplierAddress(supplier.value) : ''
  if (effectiveLocationType.value === 'user_address') return memberTo.value ? memberAddress(memberTo.value) : ''
  return ''
})

// --- Charged Deduction: two optional documents, as in the live app ----------------------------------------------
const authorityFile = ref<File | null>(null)
const clearanceFile = ref<File | null>(null)
const authorityInput = ref<HTMLInputElement>()
const clearanceInput = ref<HTMLInputElement>()
const docError = ref('')
const isChargedDeduction = computed(() => chosenStatus.value === 'Charged Deduction')
function onDeductionDoc(which: 'authority' | 'clearance', e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  const problem = docProblem({ name: f.name, type: f.type, size: f.size })
  if (problem) { docError.value = problem } else {
    docError.value = ''
    if (which === 'authority') authorityFile.value = f
    else clearanceFile.value = f
  }
  input.value = ''
}
function openFile(f: File | null) {
  if (!f) return
  const url = URL.createObjectURL(f)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// --- What is still missing ---------------------------------------------------------------------------------------
type FieldKey = MissingKey | 'status' | 'movement' | 'locationType' | 'assetLocation' | 'supplier' | 'member'
const moveMissing = computed<{ key: FieldKey, label: string }[]>(() => {
  const out: { key: FieldKey, label: string }[] = []
  if (!movementType.value) out.push({ key: 'movement', label: 'the movement type' })
  else if (movementType.value === 'check_out' && !locationType.value) out.push({ key: 'locationType', label: 'the location type' })
  const where = effectiveLocationType.value
  if (where === 'asset_location' && !assetLocation.value) out.push({ key: 'assetLocation', label: 'the asset location' })
  if (where === 'supplier' && !supplier.value) out.push({ key: 'supplier', label: 'the supplier' })
  if (where === 'user_address' && !memberTo.value && exitKind.value !== 'client') out.push({ key: 'member', label: 'who it is checked out to' })
  if (!chosenStatus.value) out.push({ key: 'status', label: 'the new status' })
  return out
})
const missing = computed(() => (exitKind.value ? missingForExit(exitKind.value, form) : []))
const allMissing = computed(() => [...moveMissing.value.map(m => m.label), ...missing.value])
const errorText = computed(() => allMissing.value.length ? `Can't move the asset yet. Still needed: ${allMissing.value.join(', ')}.` : '')
// Once a save has been tried, each missing field is marked, the same way the retrieval forms do it.
const invalid = computed<Set<FieldKey>>(() => {
  if (!showErrors.value) return new Set()
  return new Set<FieldKey>([...moveMissing.value.map(m => m.key), ...(exitKind.value ? missingKeys(exitKind.value, form) : [])])
})
const bannerEl = ref<HTMLElement>()

const history = computed(() => asset.value ? [...asset.value.history].reverse() : [])

function pickFile() { fileInput.value?.click() }
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const problem = docProblem({ name: f.name, type: f.type, size: f.size })
  if (problem) { fileError.value = problem; form.file = null } else { fileError.value = ''; form.file = f }
  ;(e.target as HTMLInputElement).value = ''
}
function removeFile() { form.file = null; fileError.value = '' }
// Open the attached file in a new tab, the same way the retrieval forms do: an object URL for the
// picked File, PDF or image alike, opened with window.open.
function openAttached() { openFile(form.file) }

// A blocked save brings the banner into view and pulses it, so the officer sees why nothing happened.
async function revealProblem() {
  await nextTick()
  const el = bannerEl.value
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashElement(el)
}

function trySave() {
  showErrors.value = true
  if (pullOutBlockedReason.value) return
  if (allMissing.value.length) { revealProblem(); return }
  if (exitKind.value) { confirmOpen.value = true; return }
  saveMove()
}

// Any status other than the two exits: save the movement and the status together.
function saveMove() {
  const a = asset.value
  if (!a || !movementType.value || !effectiveLocationType.value) return
  const result = moveAsset(a.tag, {
    movement: movementType.value, locationType: effectiveLocationType.value, assetLocation: assetLocation.value,
    supplier: supplier.value, member: memberTo.value, note: form.note, status: chosenStatus.value, by: CURRENT_OFFICER,
    authorityFile: authorityFile.value, clearanceFile: clearanceFile.value
  })
  if (!result) return
  toast.add({ title: `${result.tag} is now ${result.status}`, description: 'The move is in the asset\'s Movements and Activity Feed.', icon: 'i-lucide-circle-check', color: 'success' })
  router.push(`/move-asset/${result.tag}/done`)
}

function confirmSave() {
  if (!asset.value || !exitKind.value) return
  const result = exitAsset(asset.value.tag, { kind: exitKind.value, form: { ...form }, by: CURRENT_OFFICER })
  confirmOpen.value = false
  if (!result) return
  const label = exitKind.value === 'supplier' ? 'Supplier Return' : `Client Pull-Out · ${form.sub}`
  toast.add({ title: `${result.tag} is now ${label}`, description: 'The unit is out of the active count. Its history has the change and the document.', icon: 'i-lucide-circle-check', color: 'success' })
  router.push(`/move-asset/${result.tag}/done`)
}

// Reset the form each time the status changes, so a half-filled exit never carries over.
watch(chosenStatus, () => {
  const note = form.note
  Object.assign(form, emptyExitForm())
  form.note = note
  fileError.value = ''
  docError.value = ''
  authorityFile.value = null
  clearanceFile.value = null
  showErrors.value = false
})

function replacementLabel(tag: string) {
  const r = findAsset(tag)
  return r ? `${r.tag} · ${r.model}` : tag
}

const confirmSummary = computed(() => {
  const a = asset.value
  if (!a || !exitKind.value) return []
  return [
    ['Asset', `${a.tag} · ${a.model}`],
    ['New status', exitKind.value === 'supplier' ? 'Supplier Return' : `Client Pull-Out · ${form.sub}`],
    ['Movement', `${derived.value?.movement} · ${derived.value?.location}`],
    ['Date', badgeDate(form.date)],
    ['Document', form.file?.name ?? ''],
    ...(exitKind.value === 'supplier' && form.replacement ? [['Replacement unit', replacementLabel(form.replacement)]] as [string, string][] : []),
    ['Reason', form.reason.trim()]
  ] as [string, string][]
})
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
    v-else-if="isExited(asset)"
    class="px-6 py-16"
  >
    <div class="flex flex-col items-center text-center gap-2 text-muted">
      <UIcon
        name="i-lucide-ban"
        class="size-6"
        aria-hidden="true"
      />
      <p class="text-sm font-medium text-default">
        {{ asset.tag }} can't be moved again
      </p>
      <p class="text-xs">
        It has already been returned to the supplier or pulled out by the client. Its history is on the asset page.
      </p>
      <div class="flex gap-2 mt-1">
        <UButton
          :to="`/assets/${asset.tag}?moveDetails=1`"
          color="neutral"
          variant="outline"
          size="sm"
          label="View move details"
        />
        <UButton
          :to="`/assets/${asset.tag}`"
          color="neutral"
          variant="ghost"
          size="sm"
          label="View asset"
        />
      </div>
    </div>
  </div>

  <div
    v-else
    class="h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-transparent stage-enter"
  >
    <!-- Fixed header: icon back button beside the title (ticket tracker detail pattern) -->
    <div class="shrink-0 bg-card border-b border-default px-6 py-4">
      <div class="flex items-start gap-2">
        <UTooltip text="Back to Assets">
          <UButton
            to="/assets"
            color="neutral"
            variant="ghost"
            size="sm"
            square
            icon="i-lucide-arrow-left"
            aria-label="Back to Assets"
            class="text-muted shrink-0 mt-0.5"
          />
        </UTooltip>
        <div class="min-w-0">
          <h1 class="flex items-center gap-2.5 text-2xl font-semibold text-highlighted leading-tight">
            <span class="shrink-0">Moving asset</span>
            <span class="truncate">{{ asset.tag }}</span>
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
          <p class="text-sm text-muted pt-0.5">
            {{ subtitle }}
          </p>
        </div>
        <div class="ml-auto shrink-0">
          <AssetsMoveMenu
            :asset="asset"
            @select="(k) => navigateTo(moveHref(asset!.tag, k), { replace: true })"
          >
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              trailing-icon="i-lucide-chevron-down"
              label="Change move type"
            />
          </AssetsMoveMenu>
        </div>
      </div>
    </div>

    <!-- Scrollable body -->
    <!-- relative: the hidden file input is absolutely positioned and must stay inside this scroll area, or the whole
         window grows a second scroll bar. -->
    <div class="relative flex-1 min-h-0 overflow-y-auto overscroll-contain fade-scroll-y px-6 py-6">
      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <!-- Form -->
        <div class="space-y-6 min-w-0">
          <!-- Asset summary -->
          <section class="rounded-lg border border-default bg-card overflow-hidden">
            <div class="px-5 py-3 border-b border-default bg-elevated">
              <p class="text-xs font-semibold uppercase tracking-wide text-default">
                Asset
              </p>
            </div>
            <dl class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 p-5">
              <div>
                <dt class="text-xs font-normal text-muted">
                  Model
                </dt>
                <dd class="text-sm text-highlighted mt-1 break-words inline-flex items-start gap-2">
                  <UIcon
                    name="i-lucide-cpu"
                    class="size-4 text-muted shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    :class="LINK"
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
              </div>
              <div>
                <dt class="text-xs font-normal text-muted">
                  Serial
                </dt>
                <dd class="text-sm text-highlighted mt-1 break-words inline-flex items-start gap-2">
                  <UIcon
                    name="i-lucide-hash"
                    class="size-4 text-muted shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span class="min-w-0 break-all">{{ asset.serial }}</span>
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
              </div>
              <div>
                <dt class="text-xs font-normal text-muted">
                  Type
                </dt>
                <dd class="text-sm text-highlighted mt-1 break-words inline-flex items-start gap-2">
                  <UIcon
                    v-if="TYPE_ICON[asset.type]"
                    :name="TYPE_ICON[asset.type]!"
                    class="size-4 text-muted shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  {{ asset.type }}
                </dd>
              </div>
              <div>
                <dt class="text-xs font-normal text-muted">
                  Tech Pack
                </dt>
                <dd class="text-sm text-highlighted mt-1 break-words inline-flex items-start gap-2">
                  <UIcon
                    v-if="TECH_PACK_STYLE[asset.techPack]"
                    :name="TECH_PACK_STYLE[asset.techPack]!.icon"
                    class="size-4 text-muted shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  {{ asset.techPack }}
                </dd>
              </div>
              <div class="col-span-2">
                <dt class="text-xs font-normal text-muted">
                  Current status
                </dt>
                <dd class="mt-1">
                  <AssetsStatusPill
                    :status="asset.status"
                    :sub="asset.sub"
                    :date="asset.statusDate"
                  />
                </dd>
              </div>
              <div class="col-span-2">
                <dt class="text-xs font-normal text-muted">
                  Location
                </dt>
                <dd class="text-sm text-highlighted mt-1 break-words inline-flex items-start gap-2">
                  <UIcon
                    :name="locationView(asset).icon"
                    class="size-4 text-muted shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <UTooltip :text="locationView(asset).tip">
                    <button
                      v-if="locationView(asset).kind === 'location'"
                      type="button"
                      :class="[LINK, 'break-words']"
                      @click="info('Location', 'This opens the location page. It is an existing view in the system and out of scope for this task.')"
                    >
                      {{ locationView(asset).text }}
                    </button>
                    <span
                      v-else
                      class="break-words"
                    >{{ locationView(asset).text }}</span>
                  </UTooltip>
                </dd>
              </div>
            </dl>
          </section>

          <!-- Movement -->
          <section class="rounded-lg border border-default bg-card overflow-hidden">
            <div class="px-5 py-3 border-b border-default bg-elevated">
              <p class="text-xs font-semibold uppercase tracking-wide text-default">
                Movement
              </p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 p-5">
              <!-- A kind of move the unit can't have -->
              <UAlert
                v-if="pullOutBlockedReason"
                class="md:col-span-2"
                color="warning"
                variant="subtle"
                icon="i-lucide-triangle-alert"
                title="This unit can't be pulled out by the client"
                :description="pullOutBlockedReason"
                :ui="{ description: 'text-xs' }"
              />

              <template v-if="kind === 'move'">
                <!-- 1. Movement type: the same toggle as Mode on the retrieval ticket -->
                <div class="md:col-span-2">
                  <p
                    id="movement-label"
                    class="text-xs text-default mb-2"
                  >
                    Movement type <span class="text-red-600">*</span>
                  </p>
                  <div
                    role="radiogroup"
                    aria-labelledby="movement-label"
                    class="grid grid-cols-2 gap-2 rounded-md"
                    :class="invalid.has('movement') ? 'ring-2 ring-red-500' : ''"
                  >
                    <button
                      v-for="o in MOVEMENT_TYPES"
                      :key="o.value"
                      type="button"
                      role="radio"
                      :aria-checked="movementType === o.value"
                      class="w-full rounded-md border px-4 py-2.5 text-sm font-medium transition-colors"
                      :class="movementType === o.value ? 'border-primary bg-primary/10 text-blue-700 dark:text-primary font-semibold' : 'border-default text-default hover:bg-elevated/50'"
                      @click="movementType = o.value"
                    >
                      {{ o.label }}
                    </button>
                  </div>
                  <p
                    v-if="invalid.has('movement')"
                    class="text-xs text-red-600 mt-1.5"
                  >
                    Choose Check In or Check Out.
                  </p>
                </div>

                <!-- 2. Location type: icon cards, as in the retrieval workspace. Always shown, so the form keeps its
                     height; a Check In always goes to an asset location, so the other two are off. -->
                <div class="md:col-span-2">
                  <URadioGroup
                    :model-value="locationType || undefined"
                    :items="locationTypeItems"
                    legend="Location type"
                    variant="card"
                    orientation="horizontal"
                    indicator="hidden"
                    size="sm"
                    :ui="CARD_UI"
                    @update:model-value="(v) => (locationType = v as LocationType)"
                    :class="invalid.has('locationType') ? 'rounded-md ring-2 ring-red-500' : ''"
                  >
                    <template #legend>
                      <span class="text-xs font-normal text-default">Location type <span class="text-red-600">*</span></span>
                    </template>
                  </URadioGroup>
                  <p
                    class="text-xs mt-1.5"
                    :class="invalid.has('locationType') ? 'text-red-600' : 'text-muted'"
                  >
                    {{ invalid.has('locationType') ? 'Choose where the unit goes.' : (movementType === 'check_in' ? 'A Check In always goes to an asset location.' : 'Where the unit goes when it leaves.') }}
                  </p>
                </div>

                <!-- 3. Where it goes -->
                <template v-if="effectiveLocationType === 'asset_location'">
                  <div>
                    <label
                      for="asset-location"
                      class="text-xs font-normal text-muted block mb-1.5"
                    >Asset location <span class="text-red-600">*</span></label>
                    <SharedSelect
                      id="asset-location"
                      v-model="assetLocation"
                      class="w-full"
                      placeholder="Search asset location"
                      :color="invalid.has('assetLocation') ? 'error' : undefined"
                      :items="locationItems"
                    />
                    <p
                      v-if="invalid.has('assetLocation')"
                      class="text-xs text-red-600 mt-1.5"
                    >
                      Choose the asset location.
                    </p>
                  </div>
                  <div>
                    <p class="text-xs font-normal text-muted mb-1.5">
                      Location
                    </p>
                    <p
                      class="text-sm min-h-9 flex items-center break-words"
                      :class="assetLocation ? 'text-highlighted' : 'text-muted'"
                    >
                      {{ assetLocation || 'The asset location you choose' }}
                    </p>
                  </div>
                </template>

                <template v-else-if="effectiveLocationType === 'supplier'">
                  <div>
                    <label
                      for="supplier"
                      class="text-xs font-normal text-muted block mb-1.5"
                    >Supplier <span class="text-red-600">*</span></label>
                    <SharedSelect
                      id="supplier"
                      v-model="supplier"
                      class="w-full"
                      placeholder="Search supplier"
                      :color="invalid.has('supplier') ? 'error' : undefined"
                      :items="supplierItems"
                    />
                    <p
                      v-if="invalid.has('supplier')"
                      class="text-xs text-red-600 mt-1.5"
                    >
                      Choose the supplier.
                    </p>
                  </div>
                  <div>
                    <p class="text-xs font-normal text-muted mb-1.5">
                      Location
                    </p>
                    <p
                      class="text-sm min-h-9 flex items-center break-words"
                      :class="whereText ? 'text-highlighted' : 'text-muted'"
                    >
                      {{ whereText || 'The supplier\'s address will be used' }}
                    </p>
                  </div>
                </template>

                <template v-else-if="effectiveLocationType === 'user_address'">
                  <div>
                    <label
                      for="member-to"
                      class="text-xs font-normal text-muted block mb-1.5"
                    >Checked out to <span class="text-red-600">*</span></label>
                    <!-- The retrieval ticket's team member search: the name, then the employee number and the email -->
                    <UInputMenu
                      id="member-to"
                      v-model="memberTo"
                      :items="memberItems"
                      value-key="value"
                      :filter-fields="['label', 'empNo', 'email']"
                      placeholder="Type a name or employee ID..."
                      aria-label="Find team member"
                      icon="i-lucide-search"
                      class="w-full"
                      :color="invalid.has('member') ? 'error' : undefined"
                    >
                      <template #item-label="{ item }">
                        <div class="flex flex-col">
                          <span class="text-sm font-medium">{{ item.label }}</span>
                          <span class="text-xs text-muted">{{ item.empNo }} &middot; {{ item.email }}</span>
                        </div>
                      </template>
                    </UInputMenu>
                    <p
                      v-if="invalid.has('member')"
                      class="text-xs text-red-600 mt-1.5"
                    >
                      Choose who the unit is checked out to.
                    </p>
                  </div>
                  <div>
                    <p class="text-xs font-normal text-muted mb-1.5">
                      Location
                    </p>
                    <p
                      class="text-sm min-h-9 flex items-center break-words"
                      :class="whereText ? 'text-highlighted' : 'text-muted'"
                    >
                      {{ whereText || 'The team member\'s address will be used' }}
                    </p>
                  </div>
                </template>
              </template>

              <!-- A return to the supplier or a client pull-out: the movement is fixed, so it is shown, not asked -->
              <template v-else>
                <div>
                  <p class="text-xs font-normal text-muted mb-1.5">
                    New status
                  </p>
                  <p class="min-h-9 flex items-center">
                    <AssetsStatusPill :status="chosenStatus" />
                  </p>
                </div>
                <div>
                  <p class="text-xs font-normal text-muted mb-1.5">
                    Movement type
                  </p>
                  <p class="text-sm text-highlighted min-h-9 flex items-center">
                    Check Out
                  </p>
                </div>
                <div>
                  <p class="text-xs font-normal text-muted mb-1.5">
                    Location type
                  </p>
                  <p class="text-sm text-highlighted min-h-9 flex items-center">
                    {{ kind === 'supplier' ? 'Supplier' : 'User Address' }}
                  </p>
                </div>
                <div>
                  <p class="text-xs font-normal text-muted mb-1.5">
                    {{ kind === 'supplier' ? 'Supplier' : 'Checked out to' }}
                  </p>
                  <p
                    class="text-sm min-h-9 flex items-center"
                    :class="(kind === 'supplier' ? asset?.supplier : asset?.custodian) ? 'text-highlighted' : 'text-muted'"
                  >
                    {{ (kind === 'supplier' ? asset?.supplier : asset?.custodian) || 'No team member has this unit' }}
                  </p>
                </div>
                <div class="md:col-span-2">
                  <p class="text-xs font-normal text-muted mb-1.5">
                    Location
                  </p>
                  <p class="text-sm text-highlighted break-words">
                    {{ whereText }}
                  </p>
                </div>
              </template>

              <!-- 4. Who did it -->
              <div>
                <p class="text-xs font-normal text-muted mb-1.5">
                  {{ byLabel }}
                </p>
                <p class="text-sm text-highlighted flex items-center gap-2 min-h-9">
                  <span
                    class="inline-flex items-center justify-center shrink-0 rounded-full size-6 text-xs font-semibold bg-blue-100 text-blue-700"
                    aria-hidden="true"
                  >KB</span>
                  {{ CURRENT_OFFICER }}
                  <UBadge
                    color="neutral"
                    variant="soft"
                    size="xs"
                  >
                    You
                  </UBadge>
                </p>
              </div>

              <!-- 5. Note -->
              <div class="md:col-span-2">
                <label
                  for="note"
                  class="text-xs font-normal text-muted block mb-1.5"
                >Note <UBadge
                  color="neutral"
                  variant="outline"
                  size="sm"
                >Optional</UBadge></label>
                <UTextarea
                  id="note"
                  v-model="form.note"
                  :rows="2"
                  placeholder="Add context for this move, such as a ticket number or the reason"
                  class="w-full"
                  :ui="{ base: 'resize-none' }"
                />
              </div>

              <!-- 6. New status, last, as on the live page (the two exits have their status fixed above) -->
              <div
                v-if="kind === 'move'"
                class="md:col-span-2"
              >
                <label
                  for="new-status"
                  class="text-xs font-normal text-muted block mb-1.5"
                >New status <span class="text-red-600">*</span></label>
                <div
                  class="rounded-md"
                  :class="invalid.has('status') ? 'ring-2 ring-red-500' : ''"
                >
                  <AssetsStatusPicker
                    v-model="chosenStatus"
                    :options="pickerOptions"
                    placeholder="Select status"
                    class="w-full"
                  />
                </div>
                <p
                  v-if="invalid.has('status')"
                  class="text-xs text-red-600 mt-1.5"
                >
                  Choose the new status.
                </p>
              </div>

              <!-- Charged Deduction: two optional documents -->
              <!-- Always on screen, switched on only for Charged Deduction, the way the retrieval ticket keeps its sections
                   present and inert: choosing a status never adds or removes anything. -->
              <fieldset
                v-if="kind === 'move'"
                :disabled="!isChargedDeduction"
                class="md:col-span-2 space-y-4 min-w-0 transition-opacity"
                :class="isChargedDeduction ? '' : 'opacity-40 select-none'"
              >
                <UAlert
                  color="warning"
                  variant="subtle"
                  icon="i-lucide-info"
                  title="Supporting documents"
                  description="For Charged Deduction only, and optional: the signed Authority to Deduct and the IT Clearance. PDF, PNG or JPG, up to 10 MB each."
                  :ui="{ description: 'text-xs' }"
                />
                <input
                  ref="authorityInput"
                  type="file"
                  :accept="DOC_ACCEPT"
                  aria-label="Attach the Authority to Deduct"
                  class="sr-only"
                  @change="onDeductionDoc('authority', $event)"
                >
                <input
                  ref="clearanceInput"
                  type="file"
                  :accept="DOC_ACCEPT"
                  aria-label="Attach the IT Clearance"
                  class="sr-only"
                  @change="onDeductionDoc('clearance', $event)"
                >
                <div>
                  <p class="text-xs font-normal text-muted mb-1.5">
                    Authority to Deduct <UBadge
                      color="neutral"
                      variant="outline"
                      size="sm"
                    >Optional</UBadge>
                  </p>
                  <FileAttachChip
                    v-if="authorityFile"
                    :name="authorityFile.name"
                    :subtitle="fileSize(authorityFile.size)"
                    :icon="authorityFile.type === 'application/pdf' ? 'i-lucide-file-text' : 'i-lucide-image'"
                    preview-tooltip="Open file in a new tab"
                    @preview="openFile(authorityFile)"
                    @replace="authorityInput?.click()"
                    @remove="authorityFile = null"
                  />
                  <UButton
                    v-else
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-paperclip"
                    label="Attach document"
                    @click="authorityInput?.click()"
                  />
                </div>
                <div>
                  <p class="text-xs font-normal text-muted mb-1.5">
                    IT Clearance <UBadge
                      color="neutral"
                      variant="outline"
                      size="sm"
                    >Optional</UBadge>
                  </p>
                  <FileAttachChip
                    v-if="clearanceFile"
                    :name="clearanceFile.name"
                    :subtitle="fileSize(clearanceFile.size)"
                    :icon="clearanceFile.type === 'application/pdf' ? 'i-lucide-file-text' : 'i-lucide-image'"
                    preview-tooltip="Open file in a new tab"
                    @preview="openFile(clearanceFile)"
                    @replace="clearanceInput?.click()"
                    @remove="clearanceFile = null"
                  />
                  <UButton
                    v-else
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-paperclip"
                    label="Attach document"
                    @click="clearanceInput?.click()"
                  />
                </div>
                <p
                  v-if="docError"
                  class="text-xs text-red-600"
                >
                  <UIcon
                    name="i-lucide-circle-alert"
                    class="size-3.5 align-text-bottom"
                  /> {{ docError }}
                </p>
              </fieldset>

              <!-- Exit details (revealed only for the two exit statuses) -->
              <div
                v-if="exitKind"
                class="md:col-span-2 rounded-lg border border-warning-300 bg-warning-50/50 dark:border-warning-800 dark:bg-warning-950/20 p-4"
              >
                <p class="text-sm font-semibold text-highlighted flex items-center gap-2 mb-4">
                  {{ exitKind === 'supplier' ? 'Supplier Return details' : 'Client Pull-Out details' }}
                  <span class="inline-flex items-center rounded-md bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 px-1.5 py-0.5 text-xs font-medium dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-800">All required</span>
                </p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div v-if="exitKind === 'client'">
                    <label
                      for="sub"
                      class="text-xs font-normal text-muted block mb-1.5"
                    >Why the client pulled it out <span class="text-red-600">*</span></label>
                    <SharedSelect
                      id="sub"
                      v-model="form.sub"
                      class="w-full"
                      placeholder="Select a reason"
                      :color="invalid.has('sub') ? 'error' : undefined"
                      :items="[{ label: 'Competitor', value: 'Competitor' }, { label: 'Direct Hire', value: 'Direct Hire' }]"
                    />
                    <p
                      v-if="invalid.has('sub')"
                      class="text-xs text-red-600 mt-1.5"
                    >
                      Choose why the client pulled it out.
                    </p>
                  </div>

                  <div>
                    <label
                      for="exit-date"
                      class="flex items-center h-5 text-xs font-normal text-muted mb-1.5"
                    >Date <span class="text-red-600 ml-0.5">*</span></label>
                    <div
                      class="rounded-md"
                      :class="invalid.has('date') ? 'ring-2 ring-red-500' : ''"
                    >
                      <SharedDatePicker
                        id="exit-date"
                        v-model="form.date"
                        class="w-full"
                        aria-label="Exit date"
                      />
                    </div>
                    <p
                      v-if="invalid.has('date')"
                      class="text-xs text-red-600 mt-1.5"
                    >
                      Pick the date.
                    </p>
                  </div>

                  <div v-if="exitKind === 'supplier'">
                    <label
                      for="rep"
                      class="flex items-center gap-1.5 h-5 text-xs font-normal text-muted mb-1.5"
                    >Replacement unit from the supplier <UBadge
                      color="neutral"
                      variant="outline"
                      size="sm"
                    >Optional</UBadge></label>
                    <AssetsReplacementPicker
                      id="rep"
                      v-model="form.replacement"
                      :groups="replacementOptions"
                    />
                    <p class="text-xs text-muted mt-1.5">
                      You can add it later from the move details.
                    </p>
                  </div>

                  <div class="md:col-span-2">
                    <p class="text-xs font-normal text-muted mb-1.5">
                      {{ docLabel }} <span class="text-red-600">*</span> <span class="text-muted">· PDF or image (JPG, PNG), up to 10 MB</span>
                    </p>
                    <input
                      ref="fileInput"
                      type="file"
                      :accept="DOC_ACCEPT"
                      :aria-label="`Attach the ${docLabel.toLowerCase()}`"
                      class="sr-only"
                      @change="onFile"
                    >
                    <FileAttachChip
                      v-if="form.file"
                      :name="form.file.name"
                      :subtitle="fileSize(form.file.size)"
                      :icon="form.file.type === 'application/pdf' ? 'i-lucide-file-text' : 'i-lucide-image'"
                      preview-tooltip="Open file in a new tab"
                      @preview="openAttached"
                      @replace="pickFile"
                      @remove="removeFile"
                    />
                    <UButton
                      v-else
                      :color="invalid.has('file') ? 'error' : 'neutral'"
                      :class="invalid.has('file') ? 'text-red-700 dark:text-red-400' : ''"
                      variant="outline"
                      size="sm"
                      icon="i-lucide-paperclip"
                      label="Attach document"
                      @click="pickFile"
                    />
                    <p
                      v-if="invalid.has('file') && !fileError"
                      class="text-xs text-red-600 mt-1.5"
                    >
                      Attach the {{ docLabel.toLowerCase() }}.
                    </p>
                    <p
                      v-if="fileError"
                      class="text-xs text-red-600 mt-1.5"
                    >
                      <UIcon
                        name="i-lucide-circle-alert"
                        class="size-3.5 align-text-bottom"
                      /> {{ fileError }}
                    </p>
                  </div>

                  <div class="md:col-span-2">
                    <label
                      for="reason"
                      class="text-xs font-normal text-muted block mb-1.5"
                    >Reason <span class="text-red-600">*</span></label>
                    <UTextarea
                      id="reason"
                      v-model="form.reason"
                      :rows="2"
                      class="w-full"
                      :color="invalid.has('reason') ? 'error' : undefined"
                      :ui="{ base: 'resize-none' }"
                      placeholder="For example: the client moved this team member to their own payroll on 20 Oct."
                    />
                    <p
                      v-if="invalid.has('reason')"
                      class="text-xs text-red-600 mt-1.5"
                    >
                      Say why the unit is leaving.
                    </p>
                  </div>
                </div>
              </div>

              <div
                v-if="showErrors && errorText"
                ref="bannerEl"
                class="md:col-span-2 rounded-lg scroll-mt-6"
              >
                <SharedBanner
                  tone="danger"
                  role="alert"
                  compact
                  title="Something is still needed"
                >
                  {{ errorText }}
                </SharedBanner>
              </div>

              <div class="md:col-span-2 flex justify-end gap-2">
                <UButton
                  to="/assets"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  label="Cancel"
                />
                <UButton
                  color="primary"
                  size="sm"
                  label="Move Asset"
                  :disabled="!!pullOutBlockedReason"
                  @click="trySave"
                />
              </div>
            </div>
          </section>
        </div>

        <!-- Status history: an ordered timeline. The dot sits on the vertical centre of the badge row;
             the most recent entry's dot and connector are blue, earlier ones neutral. -->
        <aside class="xl:sticky xl:top-0 h-fit">
          <section class="rounded-lg border border-default bg-card overflow-hidden">
            <div class="px-5 py-3 border-b border-default bg-elevated">
              <p class="text-xs font-semibold uppercase tracking-wide text-default">
                Status history
              </p>
            </div>
            <ol class="p-5">
              <li
                v-for="(h, i) in history"
                :key="h.id"
                class="flex gap-3"
              >
                <div class="flex flex-col items-center shrink-0 w-2">
                  <!-- h-5 matches the badge's height, so the dot centres on the badge -->
                  <div class="h-5 flex items-center">
                    <span
                      class="block size-2 aspect-square rounded-full"
                      :class="i === 0 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'"
                    />
                  </div>
                  <span
                    v-if="i < history.length - 1"
                    class="w-px flex-1 mt-1"
                    :class="i === 0 ? 'bg-primary/40' : 'bg-default'"
                  />
                </div>
                <div class="min-w-0 pb-5">
                  <div class="h-5 flex items-center">
                    <AssetsStatusPill
                      :status="h.status"
                      :sub="h.sub"
                      :date="h.date"
                    />
                  </div>
                  <p class="text-xs text-muted mt-1.5">
                    by {{ h.by }}
                  </p>
                  <p
                    v-if="h.note || h.reason"
                    class="text-sm text-highlighted mt-0.5 text-pretty"
                  >
                    {{ h.reason || h.note }}
                  </p>
                  <p
                    v-else
                    class="text-sm text-muted mt-0.5"
                  >
                    No note recorded
                  </p>
                  <button
                    v-if="h.doc"
                    type="button"
                    class="mt-1 inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 dark:text-blue-400 text-left"
                    @click="openDoc(h.id, h.doc)"
                  >
                    <UIcon
                      name="i-lucide-paperclip"
                      class="size-3.5"
                      aria-hidden="true"
                    />{{ h.doc.name }}<UIcon
                      name="i-lucide-arrow-up-right"
                      class="size-3 opacity-70"
                      aria-hidden="true"
                    />
                  </button>
                  <p
                    v-if="h.replacement"
                    class="text-xs text-muted mt-0.5"
                  >
                    Replacement: <span class="font-medium text-highlighted">{{ h.replacement }}</span>
                  </p>
                </div>
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>

    <!-- Confirm step -->
    <UModal
      v-model:open="confirmOpen"
      :title="exitKind === 'supplier' ? 'Return this unit to the supplier?' : 'Confirm the client pull-out?'"
      :description="'This is a terminal status. The unit leaves the active count, and the change is recorded in its history.'"
      :ui="{ content: 'max-w-md' }"
    >
      <template #body>
        <dl class="divide-y divide-default rounded-md border border-default">
          <div
            v-for="[k, v] in confirmSummary"
            :key="k"
            class="flex gap-3 px-3 py-2"
          >
            <dt class="text-xs text-muted w-28 shrink-0">
              {{ k }}
            </dt>
            <dd class="text-sm text-default min-w-0 break-words">
              {{ v }}
            </dd>
          </div>
        </dl>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            label="Keep editing"
            @click="confirmOpen = false"
          />
          <UButton
            color="primary"
            size="sm"
            :label="exitKind === 'supplier' ? 'Return to supplier' : 'Confirm pull-out'"
            @click="confirmSave"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
