<script setup lang="ts">
// NodeView for the custom `formField` Tiptap node (see ~/utils/formFieldNode.ts) -
// renders one typed, validated form field inside the form document canvas
// (see FormDocumentEditor.vue). Ported from FormDocumentField.vue's per-type
// table-row markup, with two deliberate departures (both confirmed necessary
// during the original Umo-era spike this replaced, see HANDOFF_SUMMARY.md):
// FormKit doesn't render inside a Tiptap NodeView, so
// every input here is a plain Nuxt UI component with validation done by
// hand; and field-to-field awareness (the signature lock, previously a prop
// computed by the host page from `sections`/`fields`) now goes through
// `~/utils/formFieldRegistry.ts`, a shared reactive registry each field
// writes its own filled/required state into - the NodeView equivalent of
// provide/inject working the same way it did in the old builder.
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { useFormFieldRegistry } from '~/utils/formFieldRegistry'
import { useFormSubmitAttempt } from '~/utils/formSubmitAttempt'
import { useFormStructureEditable } from '~/utils/formStructureEditable'
import { useFormFieldsInteractive } from '~/utils/formFieldsInteractive'
import { useFormAttachedToEmail, useFormMode } from '~/utils/formEmailAttachment'
import { TOKEN_GROUPS } from '~/data/templates'
import type { DocumentFieldAttrs, DocumentFieldType } from '~/utils/formFieldNode'

const props = defineProps(nodeViewProps)

const attrs = computed(() => props.node.attrs as DocumentFieldAttrs)

// Two independent gates (see the two util files for the full reasoning):
// whether this field's own definition can be changed (the settings gear),
// and whether its value controls respond at all. Default both to true when
// neither is provided, so any future throwaway test page that renders this
// node without wiring either provider still behaves sensibly.
const structureEditableRef = useFormStructureEditable()
const structureEditable = computed(() => structureEditableRef?.value !== false)
const fieldsInteractiveRef = useFormFieldsInteractive()
const interactive = computed(() => fieldsInteractiveRef?.value !== false)

// Placeholder ({{TOKEN}}) insertion into this field's own Label/Hint - only
// surfaced once this form is actually attached to an email template (see
// ~/utils/formEmailAttachment.ts), mirroring the old builder's
// `placeholdersEnabled` gate on FormFieldPropertiesPanel.vue.
const attachedToEmailRef = useFormAttachedToEmail()
const placeholdersEnabled = computed(() => !!attachedToEmailRef?.value)
const formModeRef = useFormMode()
const formMode = computed(() => formModeRef?.value ?? 'onsite')

// --- Settings popover ----------------------------------------------------
// Lives right here, not in a host-page drawer/popover looking the node up
// by id - `nodeViewProps` already hands this NodeView a live
// `updateAttributes()` bound to its own exact node, which is simpler and
// more robust than the host page re-selecting a node by id through the
// editor's command chain just to call the equivalent built-in command.
// Replaces both the old FormFieldPropertiesPanel.vue drawer and the
// `selectedFormFieldNodeId` bridge module from earlier this round (deleted -
// nothing outside this component needs to know which field is selected
// anymore).
const settingsOpen = ref(false)
const draft = reactive({
  fieldType: attrs.value.fieldType,
  label: attrs.value.label,
  hint: attrs.value.hint,
  required: attrs.value.required,
  buttonUrl: attrs.value.buttonUrl,
  buttonColor: attrs.value.buttonColor,
  hideLabel: attrs.value.hideLabel
})

function openSettings() {
  draft.fieldType = attrs.value.fieldType
  draft.label = attrs.value.label
  draft.hint = attrs.value.hint
  draft.required = attrs.value.required
  draft.buttonUrl = attrs.value.buttonUrl
  draft.buttonColor = attrs.value.buttonColor
  draft.hideLabel = attrs.value.hideLabel
  settingsOpen.value = true
}

// The settings UI reads better as a positive "Show label" checkbox than a
// double-negative "Hide label" one - inverted here rather than flipping the
// stored attribute's own polarity, since `hideLabel: false` (label shown) is
// the more common case and reads clearer as the attribute's own default.
const showLabel = computed({
  get: () => !draft.hideLabel,
  set: (v: boolean) => { draft.hideLabel = !v }
})

// Matches the old FormFieldPropertiesPanel.vue's changeType(): a signature
// box is always required (there's no meaningful "optional signature"), and
// a button link is never answerable so it can't be required either.
watch(() => draft.fieldType, (type) => {
  if (type === 'signature') draft.required = true
  else if (type === 'button_link') draft.required = false
})

// Applied live as each field changes (not a separate Save step) - matches
// how every other setting in this app autosaves, and there's no
// meaningfully different "draft vs committed" state for a field's own
// label/hint/required the way there was for a whole form's name/description.
watch(draft, (value) => {
  props.updateAttributes({ ...value })
}, { deep: true })

// --- Duplicate / remove ---------------------------------------------------
// Mirrors the old sections/fields builder's FieldRowControls.vue (duplicate/
// remove buttons, a drag grip) - lost when that builder was replaced by this
// Tiptap NodeView and never ported over. `getPos()` gives this exact node's
// current document position (NodeViewProps, re-resolved on every call - it
// isn't stale even after earlier edits shift positions), which is what makes
// operating on *this* field instance (not "whichever one has focus") safe.
function duplicateField() {
  const pos = props.getPos()
  if (typeof pos !== 'number') return
  const json = props.node.toJSON()
  props.editor.chain().focus().insertContentAt(pos + props.node.nodeSize, {
    type: 'formField',
    attrs: { ...json.attrs, id: crypto.randomUUID() }
  }).run()
}

function removeField() {
  const pos = props.getPos()
  if (typeof pos !== 'number') return
  props.editor.chain().focus().deleteRange({ from: pos, to: pos + props.node.nodeSize }).run()
}

// --- Placeholder Library drawer ------------------------------------------
// Same EmailPlaceholderDrawer/TOKEN_GROUPS the email editor uses (see
// app/pages/templates/email/[id]/edit.vue) - a token picks up a real code,
// not free text, and gets appended straight onto this field's own draft
// label/hint, which the watch(draft, ...) above already flushes into
// `updateAttributes()` like any other edit.
const placeholderOpen = ref(false)
const placeholderTarget = ref<'label' | 'hint'>('label')
const placeholderUsedCodes = computed(() => {
  const matches = `${draft.label ?? ''} ${draft.hint ?? ''}`.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map(m => m.slice(2, -2)))]
})

function openPlaceholders(target: 'label' | 'hint') {
  placeholderTarget.value = target
  placeholderOpen.value = true
}

function insertPlaceholderToken(code: string) {
  draft[placeholderTarget.value] += `{{${code}}}`
}

const FIELD_TYPE_OPTIONS: { value: DocumentFieldType, label: string }[] = [
  { value: 'short_text', label: 'Short text' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'file_upload', label: 'File upload' },
  { value: 'signature', label: 'Required signature box' },
  { value: 'button_link', label: 'Button link' }
]

// --- Local answer state (ephemeral, matching the old builder - there's no
// backend to persist a filled-in answer to, only the field's own definition
// lives in the document) ------------------------------------------------
const textValue = ref('')
// A `number` field otherwise happily accepted letters/symbols - `type="text"`
// (deliberate, not a native `<input type="number">`, see the input below)
// means nothing at the DOM level ever rejected them. Stripping anything but
// digits/one leading minus/one decimal point as the user types is real,
// live validation, not just an after-the-fact error message once they leave
// the field.
watch(textValue, (value) => {
  if (attrs.value.fieldType !== 'number' || !value) return
  const sign = value.startsWith('-') ? '-' : ''
  const rest = value.slice(sign.length).replace(/[^0-9.]/g, '')
  const firstDot = rest.indexOf('.')
  const cleaned = sign + (firstDot === -1 ? rest : rest.slice(0, firstDot + 1) + rest.slice(firstDot + 1).replace(/\./g, ''))
  if (cleaned !== value) textValue.value = cleaned
})
const checked = ref(false)
const hasSignature = ref(false)
const signatureDataUrl = ref('')
const fileList = ref<{ file: File, name: string }[]>([])
// A real data URL (not just the object URL used for the live on-screen
// preview) - object URLs are revoked the moment `fileList` changes and don't
// survive past this component's own lifetime, but the print/PDF path (see
// ~/utils/formFieldStaticRender.ts, reads this off the field registry below)
// needs the actual image bytes at whatever later moment printing happens.
const fileDataUrl = ref('')
const filePreviewUrl = ref('')
watch(fileList, (list) => {
  if (filePreviewUrl.value) URL.revokeObjectURL(filePreviewUrl.value)
  const file = list[0]?.file
  filePreviewUrl.value = file ? URL.createObjectURL(file) : ''
  if (!file) {
    fileDataUrl.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => { fileDataUrl.value = String(reader.result) }
  reader.readAsDataURL(file)
})
onBeforeUnmount(() => {
  if (filePreviewUrl.value) URL.revokeObjectURL(filePreviewUrl.value)
})

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileList.value = [{ file, name: file.name }]
}

function removeFile() {
  fileList.value = []
}

function openFile() {
  const file = fileList.value[0]?.file
  if (!file) return
  const url = URL.createObjectURL(file)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

const fileInputId = computed(() => `doc-file-input-${attrs.value.id}`)

// --- Field registry (fill state + what the signature veil should list) --
const registry = useFormFieldRegistry()

const filled = computed(() => {
  switch (attrs.value.fieldType) {
    case 'checkbox': return checked.value
    case 'file_upload': return fileList.value.length > 0
    case 'signature': return hasSignature.value
    case 'button_link': return true // not answerable, never blocks
    default: return textValue.value.trim() !== ''
  }
})

// The field's real, live answer, per type - read by the print/PDF path (see
// ~/utils/formFieldStaticRender.ts) so a printed copy shows what was
// actually filled in rather than a blank template.
const value = computed(() => {
  switch (attrs.value.fieldType) {
    case 'checkbox': return String(checked.value)
    case 'file_upload': return fileDataUrl.value
    case 'signature': return signatureDataUrl.value
    case 'button_link': return ''
    default: return textValue.value
  }
})

watchEffect(() => {
  if (!registry) return
  registry[attrs.value.id] = {
    label: attrs.value.label,
    required: !!attrs.value.required,
    filled: filled.value,
    type: attrs.value.fieldType,
    value: value.value
  }
})

onBeforeUnmount(() => {
  if (registry) delete registry[attrs.value.id]
})

const lockedReasons = computed(() => {
  if (attrs.value.fieldType !== 'signature' || !registry) return []
  return Object.entries(registry)
    .filter(([, e]) => e.type !== 'signature' && e.required && !e.filled)
    .map(([id, e]) => ({ id, label: e.label || 'Untitled field' }))
})

// Scrolls straight to the still-unfilled field a "Complete these first"
// bullet names, instead of leaving the user to hunt for it by eye through a
// long document - `data-field-id` (set on this NodeView's own wrapper below)
// is what every field's root element carries for exactly this lookup.
function goToField(id: string) {
  const el = document.querySelector(`[data-field-id="${id}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// --- Validation (manual - no FormKit inside a NodeView, see file header) -
const touched = ref(false)
const submitAttempted = useFormSubmitAttempt()
const isInvalidNumber = computed(() =>
  attrs.value.fieldType === 'number' && !!textValue.value && Number.isNaN(Number(textValue.value)))
const showError = computed(() => (touched.value || !!submitAttempted?.value) &&
  ((attrs.value.required && !filled.value) || isInvalidNumber.value))
const errorMessage = computed(() => {
  if (attrs.value.fieldType === 'number' && textValue.value && Number.isNaN(Number(textValue.value))) {
    return 'Must be a number.'
  }
  return `${attrs.value.fieldType === 'checkbox' ? 'This' : attrs.value.label || 'This field'} is required.`
})

const placeholder = computed(() => {
  switch (attrs.value.fieldType) {
    case 'number': return 'Enter a number…'
    case 'paragraph': return 'Type your detailed answer…'
    default: return 'Type your answer…'
  }
})
</script>

<template>
  <NodeViewWrapper
    data-form-field-node
    :data-field-id="attrs.id"
    class="group relative my-2 py-1 transition-colors rounded-md"
    :class="settingsOpen ? 'bg-primary/5' : ''"
  >
    <!-- Fully floating chrome, like the duplicate/remove/settings toolbar
         below - not inset inside the field's own padding, and not reserving
         a permanent `pl-*` gutter on the field itself either (an earlier
         version did both, which meant the field's own layout width/position
         depended on whether this control existed at all). Drag handle on
         the left, action toolbar on the right - both float vertically
         centered beside the field (Notion/Docs-style margin chrome), clear
         of its content either way, so nothing about the field's own box
         model needs to account for them. (Previously both floated directly
         above the field instead - reported as reading "awkward", since that
         placement sat in the whitespace gap above the field rather than
         beside the content it actually controls, and crowded whatever the
         previous block happened to be right above it.) -->
    <UTooltip v-if="structureEditable" text="Drag to reorder">
      <span
        data-drag-handle
        class="absolute top-1/2 -translate-y-1/2 -left-7 z-10 flex items-center justify-center size-6 rounded-md border border-default bg-default text-dimmed shadow-sm hover:text-default hover:bg-elevated cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <UIcon name="i-lucide-grip-vertical" class="size-4" />
      </span>
    </UTooltip>

    <!-- Floating outside the field's own content, vertically centered on
         the trailing edge - these buttons are independent chrome for
         managing the field, not part of what the field displays, so they
         should never sit on top of (and get crowded/overlapped by) a long
         label or wrapped value inside the field itself. A small card
         (background + border + shadow) makes that floating position read as
         an intentional toolbar, not a stray set of icons. -->
    <div v-if="structureEditable" class="absolute top-1/2 -translate-y-1/2 -right-8 z-10 flex flex-col items-center gap-0.5 rounded-md border border-default bg-default px-0.5 py-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" :class="settingsOpen ? '!opacity-100' : ''">
      <UTooltip text="Duplicate field">
        <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-copy" aria-label="Duplicate field" @mousedown.stop @click.stop="duplicateField" />
      </UTooltip>
      <UTooltip text="Remove field">
        <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-trash-2" aria-label="Remove field" class="hover:text-error" @mousedown.stop @click.stop="removeField" />
      </UTooltip>
      <UPopover v-model:open="settingsOpen" :content="{ side: 'right', align: 'start', sideOffset: 8 }">
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        square
        icon="i-lucide-settings-2"
        aria-label="Field settings"
        @mousedown.stop
        @click.stop="openSettings"
      />
      <template #content>
        <div class="p-3 w-72 space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-dimmed">Field settings</h3>

          <UFormField label="Field type" :ui="{ label: 'text-xs' }">
            <USelectMenu v-model="draft.fieldType" :items="FIELD_TYPE_OPTIONS" value-key="value" class="w-full text-sm" />
          </UFormField>

          <UFormField :label="draft.fieldType === 'button_link' ? 'Button text' : 'Label'" :ui="{ label: 'text-xs' }">
            <UInput v-model="draft.label" class="w-full text-sm">
              <template v-if="placeholdersEnabled" #trailing>
                <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-braces" aria-label="Insert placeholder" @mousedown.stop @click.stop="openPlaceholders('label')" />
              </template>
            </UInput>
          </UFormField>

          <UCheckbox
            v-if="draft.fieldType !== 'button_link'"
            v-model="showLabel"
            label="Show label"
            :ui="{ root: 'items-center', label: 'text-xs' }"
          />

          <UFormField label="Hint" :ui="{ label: 'text-xs', labelWrapper: 'justify-start gap-1.5' }">
            <template #hint><UBadge color="neutral" variant="outline" size="sm">Optional</UBadge></template>
            <UInput v-model="draft.hint" class="w-full text-sm">
              <template v-if="placeholdersEnabled" #trailing>
                <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-braces" aria-label="Insert placeholder" @mousedown.stop @click.stop="openPlaceholders('hint')" />
              </template>
            </UInput>
          </UFormField>

          <UFormField v-if="draft.fieldType === 'button_link'" label="Link URL" :ui="{ label: 'text-xs' }">
            <UInput v-model="draft.buttonUrl" placeholder="https://…" class="w-full text-sm" />
          </UFormField>

          <UCheckbox
            v-if="draft.fieldType !== 'signature' && draft.fieldType !== 'button_link'"
            v-model="draft.required"
            label="Required"
            :ui="{ root: 'items-center', label: 'text-xs' }"
          />
          <p v-else-if="draft.fieldType === 'signature'" class="text-xs text-dimmed flex items-center gap-1.5">
            <UIcon name="i-lucide-info" class="size-3.5 shrink-0" />
            Signature boxes are always required.
          </p>
        </div>
      </template>
      </UPopover>
    </div>

    <!-- short_text / paragraph / number - same shape, just a different input control -->
    <template v-if="['short_text', 'paragraph', 'number'].includes(attrs.fieldType)">
      <label v-if="!attrs.hideLabel" class="flex items-baseline gap-0.5 text-sm font-semibold text-highlighted mb-1 min-w-0">
        <span class="break-words">{{ attrs.label }}</span><span v-if="attrs.required" class="text-red-600 shrink-0">*</span>
      </label>
      <UTextarea
        v-if="attrs.fieldType === 'paragraph'"
        v-model="textValue"
        :rows="2"
        autoresize
        variant="none"
        :disabled="!interactive"
        class="w-full"
        :ui="{ base: 'border-0 border-b rounded-none border-default px-0 py-1 text-sm bg-transparent focus:outline-none focus:border-primary resize-none' }"
        :placeholder="placeholder"
        :aria-label="attrs.label"
        @mousedown.stop
        @click.stop
        @blur="touched = true"
      />
      <UInput
        v-else
        v-model="textValue"
        :type="attrs.fieldType === 'number' ? 'text' : 'text'"
        variant="none"
        :disabled="!interactive"
        class="w-full"
        :ui="{ base: 'border-0 border-b rounded-none border-default px-0 py-1 text-sm bg-transparent focus:outline-none focus:border-primary' }"
        :placeholder="placeholder"
        :aria-label="attrs.label"
        @mousedown.stop
        @click.stop
        @blur="touched = true"
      />
      <p v-if="showError" class="text-xs text-error mt-0.5">{{ errorMessage }}</p>
      <p v-else-if="attrs.hint" class="text-xs text-dimmed mt-1">{{ attrs.hint }}</p>
    </template>

    <!-- checkbox - green tint once checked, matching the old builder's `.att.on` treatment -->
    <template v-else-if="attrs.fieldType === 'checkbox'">
      <div class="rounded-md transition-colors" :class="checked ? 'bg-emerald-50 ring-1 ring-emerald-300 px-2 py-1 -mx-2 -my-1' : ''">
        <label class="flex items-center gap-2 min-w-0" :class="interactive ? 'cursor-pointer' : 'cursor-default'" @mousedown.stop @click.stop>
          <UCheckbox v-model="checked" :disabled="!interactive" class="shrink-0" @change="touched = true" />
          <template v-if="!attrs.hideLabel">
            <span class="font-semibold text-sm text-highlighted break-words min-w-0">{{ attrs.label }}</span><span v-if="attrs.required" class="text-red-600 shrink-0">*</span>
          </template>
        </label>
        <p v-if="attrs.hint" class="text-xs text-dimmed mt-0.5">{{ attrs.hint }}</p>
      </div>
      <p v-if="showError" class="text-xs text-error mt-0.5">{{ errorMessage }}</p>
    </template>

    <!-- file_upload - a real image preview once attached, not a filename chip -->
    <template v-else-if="attrs.fieldType === 'file_upload'">
      <div @mousedown.stop @click.stop>
        <div class="flex items-center gap-2 flex-wrap">
          <template v-if="!attrs.hideLabel">
            <span class="font-semibold text-sm text-highlighted break-words max-w-full">{{ attrs.label }}</span><span v-if="attrs.required" class="text-red-600 shrink-0">*</span>
          </template>
          <template v-if="!fileList.length">
            <UButton as="label" :for="interactive ? fileInputId : undefined" type="button" variant="outline" color="neutral" size="xs" icon="i-lucide-upload" :disabled="!interactive" class="no-print" :class="interactive ? 'cursor-pointer' : ''">
              Choose file
            </UButton>
            <span class="text-dimmed text-xs no-print">No file chosen</span>
          </template>
        </div>
        <div v-if="fileList.length" class="mt-2 relative inline-block">
          <img :src="filePreviewUrl" class="max-h-40 rounded-md border border-default" :class="interactive ? 'cursor-pointer' : ''" alt="Attached file preview" @click="interactive && openFile()">
          <UButton v-if="interactive" type="button" icon="i-lucide-x" size="xs" color="neutral" variant="solid" square class="absolute -top-2 -right-2 rounded-full shadow no-print" aria-label="Remove attached file" @click="removeFile" />
        </div>
        <input :id="fileInputId" type="file" accept="image/jpeg,image/png" class="sr-only" :disabled="!interactive" @change="onFileChange($event); touched = true">
      </div>
      <p v-if="showError" class="text-xs text-error mt-1">{{ errorMessage }}</p>
      <p v-else-if="attrs.hint" class="text-xs text-dimmed mt-0.5">{{ attrs.hint }}</p>
    </template>

    <!-- signature - veiled/locked until every other required field is filled -->
    <template v-else-if="attrs.fieldType === 'signature'">
      <div class="relative" @mousedown.stop @click.stop>
        <MasterDataSignaturePad v-model:has-content="hasSignature" v-model:data-url="signatureDataUrl" :disabled="!interactive || !!lockedReasons.length" />
        <div v-if="lockedReasons.length" class="absolute inset-0 z-1 flex items-center justify-center rounded-md bg-(color:--ams-doc-lock)/90">
          <UTooltip
            :delay-duration="0"
            :content="{ side: 'top' }"
            :ui="{ content: 'h-auto w-64 max-w-64 items-start px-3 py-2 whitespace-normal' }"
          >
            <UBadge color="neutral" variant="subtle" icon="i-lucide-lock" size="md">
              Locked
            </UBadge>
            <template #content>
              <div class="w-full">
                <p class="text-xs font-medium mb-1">Complete these first:</p>
                <!-- `w-full` + `break-words` on both the list and each item -
                     the tooltip content's own width (fixed above, not just a
                     max-width) only constrains ITS box; a long field label
                     inside a plain `<li>` still needs its own wrap behavior
                     to actually respect that width instead of overflowing
                     past the tooltip's padding. Each item jumps straight to
                     its still-unfilled field on click - this popover is the
                     one place a user is told exactly what's missing, so it
                     should also be the fastest way to get there instead of
                     leaving them to scroll and hunt for it by eye. -->
                <ul class="text-xs list-disc pl-3.5 space-y-0.5 w-full">
                  <li
                    v-for="reason in lockedReasons"
                    :key="reason.id"
                    class="break-words cursor-pointer hover:text-primary hover:underline"
                    @mousedown.stop
                    @click.stop="goToField(reason.id)"
                  >
                    {{ reason.label }}
                  </li>
                </ul>
              </div>
            </template>
          </UTooltip>
        </div>
      </div>
      <p v-if="!attrs.hideLabel" class="text-sm text-dimmed uppercase tracking-wide mt-1 break-words">{{ attrs.label }}<span class="text-red-600">*</span></p>
      <p v-if="attrs.hint" class="text-xs text-dimmed mt-0.5">{{ attrs.hint }}</p>
      <p v-if="(touched || !!submitAttempted) && !hasSignature && !lockedReasons.length" class="text-xs text-error mt-0.5">Signature is required.</p>
    </template>

    <!-- button_link - an action, not a question -->
    <template v-else-if="attrs.fieldType === 'button_link'">
      <UButton type="button" :color="(attrs.buttonColor as 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' | undefined) || 'primary'" variant="solid" size="sm" :to="interactive ? (safeUrl(attrs.buttonUrl) || undefined) : undefined" :disabled="!interactive" target="_blank" rel="noopener noreferrer" class="max-w-full" :ui="{ base: 'max-w-full min-w-0' }" @mousedown.stop @click.stop>
        <span class="block break-words min-w-0">{{ attrs.label || 'Open link' }}</span>
      </UButton>
      <p v-if="attrs.hint" class="text-xs text-dimmed mt-1.5">{{ attrs.hint }}</p>
    </template>

    <EmailPlaceholderDrawer
      v-if="placeholdersEnabled"
      v-model="placeholderOpen"
      :groups="TOKEN_GROUPS"
      :used-codes="placeholderUsedCodes"
      :context-label="attrs.label || 'Field settings'"
      :context-mode="formMode"
      @insert="insertPlaceholderToken"
    />
  </NodeViewWrapper>
</template>
