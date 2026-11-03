<script setup lang="ts">
// Move Asset. Changing the status to a Terminal-lane exit status (Supplier Return or
// Client Pull-Out) reveals the required exit details inline, the same way Charged Deduction
// reveals its document fields in the live app. Because an exit is terminal and hard to undo, a
// confirm step with named buttons sits before the save. Movement type and location are derived
// from the status and shown read only. The New Status field is a searchable, grouped picker.
import {
  findAsset, statusPickerOptions, STATUSES, docProblem, missingForExit, exitMovement,
  replacementCandidates, exitAsset, emptyExitForm, DOC_ACCEPT, fileSize, CURRENT_OFFICER,
  badgeDate, assetsSimState, isExited, missingKeys, locationView, openDoc, TYPE_ICON, TECH_PACK_STYLE, type Asset, type ExitKind, type MissingKey
} from '~/data/assets'

definePageMeta({ layout: 'assets', key: route => String(route.params.tag) })

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

const pickerOptions = computed(() => asset.value ? statusPickerOptions(asset.value) : [])

const chosenStatus = ref('')
const chosenDef = computed(() => STATUSES.find(s => s.name === chosenStatus.value))
const exitKind = computed<ExitKind | undefined>(() => chosenDef.value?.exit)
const form = reactive(emptyExitForm())
const fileError = ref('')
const showErrors = ref(false)
const confirmOpen = ref(false)
const fileInput = ref<HTMLInputElement>()

const derived = computed(() => (exitKind.value && asset.value) ? exitMovement(exitKind.value, asset.value) : null)
const docLabel = computed(() => exitKind.value === 'supplier' ? 'Supplier return agreement' : 'Client instruction')
const candidates = computed(() => asset.value ? replacementCandidates(asset.value.tag) : [])
const replacementItems = computed(() => candidates.value.map(c => ({ label: `${c.tag} · ${c.model}`, value: c.tag })))

const missing = computed(() => (exitKind.value ? missingForExit(exitKind.value, form) : []))
const noStatus = computed(() => !exitKind.value)
const errorText = computed(() => {
  if (noStatus.value) return 'Choose the new status first. The details to fill in depend on it.'
  return missing.value.length ? `Can't move the asset yet. Still needed: ${missing.value.join(', ')}.` : ''
})
// Once a save has been tried, each missing field is marked, the same way the retrieval forms do it.
const invalid = computed<Set<MissingKey | 'status'>>(() => {
  if (!showErrors.value) return new Set()
  if (noStatus.value) return new Set(['status'])
  return new Set(missingKeys(exitKind.value!, form))
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
function openAttached() {
  if (!form.file) return
  const url = URL.createObjectURL(form.file)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

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
  if (!exitKind.value || missing.value.length) { revealProblem(); return }
  confirmOpen.value = true
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
  Object.assign(form, emptyExitForm())
  fileError.value = ''
  showErrors.value = false
})

const confirmSummary = computed(() => {
  const a = asset.value
  if (!a || !exitKind.value) return []
  return [
    ['Asset', `${a.tag} · ${a.model}`],
    ['New status', exitKind.value === 'supplier' ? 'Supplier Return' : `Client Pull-Out · ${form.sub}`],
    ['Movement', `${derived.value?.movement} · ${derived.value?.location}`],
    ['Date', badgeDate(form.date)],
    ['Document', form.file?.name ?? ''],
    ...(exitKind.value === 'supplier' && form.replacement ? [['Replacement unit', form.replacement]] as [string, string][] : []),
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
      <UButton
        :to="`/assets/${asset.tag}`"
        color="neutral"
        variant="outline"
        size="sm"
        label="View asset"
        class="mt-1"
      />
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
            Change this unit's status and record the movement.
          </p>
        </div>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain fade-scroll-y px-6 py-6">
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

          <!-- Movement details -->
          <section class="rounded-lg border border-default bg-card overflow-hidden">
            <div class="px-5 py-3 border-b border-default bg-elevated">
              <p class="text-xs font-semibold uppercase tracking-wide text-default">
                Movement
              </p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 p-5">
              <!-- New status: fills its column; the derived movement sits beside it -->
              <div>
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
              <div>
                <p class="text-xs font-normal text-muted mb-1.5">
                  Movement type
                </p>
                <p
                  v-if="derived"
                  class="text-sm text-highlighted min-h-9 flex items-center"
                >
                  {{ derived.movement }}
                </p>
                <p
                  v-else
                  class="text-sm text-placeholder min-h-9 flex items-center"
                >
                  Set when you pick the status
                </p>
              </div>

              <div>
                <p class="text-xs font-normal text-muted mb-1.5">
                  {{ exitKind === 'supplier' ? 'Checked in by' : 'Checked out by' }}
                </p>
                <p class="text-sm text-highlighted flex items-center gap-2">
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
              <div>
                <p class="text-xs font-normal text-muted mb-1.5">
                  Location
                </p>
                <p
                  v-if="derived"
                  class="text-sm text-highlighted break-words"
                >
                  {{ derived.location }}
                </p>
                <p
                  v-else
                  class="text-sm text-placeholder"
                >
                  Set when you pick the status
                </p>
              </div>

              <!-- Exit details (revealed only for the two exit statuses) -->
              <div
                v-if="exitKind"
                class="md:col-span-2 rounded-lg border border-warning-300 bg-warning-50/50 dark:border-warning-800 dark:bg-warning-950/20 p-4"
              >
                <p class="text-sm font-semibold text-highlighted flex items-center gap-2 mb-4">
                  {{ exitKind === 'supplier' ? 'Supplier Return details' : 'Client Pull-Out details' }}
                  <span class="inline-flex items-center rounded-md bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 px-1.5 py-0.5 text-xs font-medium dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800">All required</span>
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
                      class="text-xs font-normal text-muted block mb-1.5"
                    >Date <span class="text-red-600">*</span></label>
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
                      class="text-xs font-normal text-muted block mb-1.5"
                    >Replacement unit from the supplier <UBadge
                      color="neutral"
                      variant="outline"
                      size="sm"
                    >Optional</UBadge></label>
                    <SharedSelect
                      id="rep"
                      v-model="form.replacement"
                      class="w-full"
                      placeholder="Not linked yet"
                      :items="replacementItems"
                    />
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

              <!-- Note -->
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
                    class="text-sm text-placeholder mt-0.5"
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
