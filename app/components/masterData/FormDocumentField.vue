<script setup lang="ts">
import type { FormField } from '~/data/retrievalForms'
import { useFormFieldValues } from '~/utils/formFieldValues'
import { wrapTokens } from '~/data/templates'
// Explicit import (not relying on Nuxt's components/ auto-import) - a
// brand-new component file needs the dev server's auto-import registry to
// pick it up, which can lag behind a plain page reload for a bit.
import MasterDataFieldRowControls from '~/components/masterData/FieldRowControls.vue'

// This component's template has 5 sibling root rows (one per v-if/else-if
// branch) instead of one - Vue only auto-forwards a parent's non-prop
// bindings (click, dragstart/dragover/drop/dragend, class) onto a SINGLE
// root element, so on a multi-root component they're silently dropped
// unless bound explicitly. That's why the parent's click handler (select-
// field-for-settings), the drag handlers, and its `class` (the selected/
// drag-over outline) all did nothing - `v-bind="$attrs"` on every row
// markup below is what actually applies them. (Note: don't spell out the
// literal opening tag names here in this comment - some part of this
// project's toolchain regex-scans script-block comments for them and
// mistakes it for a second template block, breaking the build.)

interface Props {
  field: FormField
  /** true when this field renders without a shared box - either its
   * section is `layout: 'plain'`, or (for a field with no section at all)
   * the field's own `layout` is 'plain'. No label|value column split, no
   * table box - the whole thing stacks full-width. */
  plain?: boolean
  /** true in the builder canvas - shows a hover-revealed move/duplicate/
   * remove menu in the row's own corner, instead of a dedicated table
   * column (which shrank every real content column to make room, and
   * printed/exported as empty gutters no reader needs). */
  editable?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
  /** false (default) keeps every "required" message hidden - the builder
   * canvas has no submit action, so showing them there is just noise while
   * designing. The fillable views (in-app read mode, /form-preview) pass
   * this as true only after their own Submit button has actually been
   * clicked once. */
  showValidation?: boolean
  /** false makes every answer control (text/number/checkbox/file/signature)
   * inert - typing, checking, drawing, and picking a file all do nothing.
   * Defaults true. The in-app "read" tab (viewing the form's structure, not
   * filling it out) passes this as false; the builder canvas and the real
   * fillable /form-preview link both leave it true. */
  interactive?: boolean
  /** Signature only - when set (a non-empty list of what's still missing),
   * the signature pad renders behind a translucent veil card naming those
   * items, same as the reference mockup's "Signature locked" treatment: a
   * signature is the very last, most consequential control on the form, so
   * it stays visibly blocked until every other required item is done,
   * instead of just failing validation after the fact on submit. */
  lockedReasons?: string[]
}

const props = withDefaults(defineProps<Props>(), { interactive: true })
const emit = defineEmits<{
  'move-up': []
  'move-down': []
  duplicate: []
  remove: []
}>()

// html2canvas (used for the PDF export on the preview page) can't parse the
// oklch() color functions Tailwind v4's named colors compile to - every color
// in this table is a literal hex arbitrary value instead of e.g. `text-gray-600`
// so the exported PDF renders correctly.
//
// The value cells are real, typeable inputs (not static placeholder markup)
// wherever this component renders - the builder canvas, the in-app read
// view, and the standalone /form-preview page all use this same component,
// and this is the document a team member actually fills out and submits, so
// it needs to behave like a form everywhere it shows up, not just look like
// one. There's no backend here to persist answers to, so each instance just
// keeps its own typed-in value locally.
const textValue = ref('')
const checked = ref(false)
const fileName = ref('')
const fileList = ref<{ file: File, name: string }[]>([])
const hasSignature = ref(false)
// FormKit's `hidden` type has no visible UI of its own - it's used purely to
// give the signature pad a real FormKit validation message ("Signature is
// required.") without changing MasterDataSignaturePad's own canvas markup.
const signatureValue = ref('')
watch(hasSignature, v => { signatureValue.value = v ? 'signed' : '' })
watch(fileList, list => { fileName.value = list[0]?.name ?? '' })

// A file_upload field is always an image (accept="image/jpeg,image/png") -
// once one's attached, showing the actual picture is more useful for
// documentation purposes than a filename chip is, so this is what the
// "Choose file" button hands off to once a file exists. Revoked/regenerated
// on every change so only the current file's URL is ever alive.
const filePreviewUrl = ref('')
watch(fileList, (list) => {
  if (filePreviewUrl.value) URL.revokeObjectURL(filePreviewUrl.value)
  filePreviewUrl.value = list[0]?.file ? URL.createObjectURL(list[0].file) : ''
})
onBeforeUnmount(() => {
  if (filePreviewUrl.value) URL.revokeObjectURL(filePreviewUrl.value)
})

// FormKit's own file input is left in the DOM (still what v-model/validation
// reads) but visually hidden (`sr-only` on its input-class below) - this is
// the real "Choose file" trigger, a normal outline UButton, driven through a
// <label for> pointed at the same id rather than a raw native file button
// (which can't be given Nuxt UI's own button styling).
function fileInputId(field: FormField) {
  return `file-input-${field.id}`
}

// Opens the picked file in a new tab (via a throwaway object URL) instead of
// downloading it - the browser's own viewer for that file type already has
// its own download control, so saving it stays the viewer's choice, not
// something this click does on their behalf. Revoked after a beat so it
// doesn't leak - the new tab has already grabbed the bytes it needs by then.
function openFile(file: File | undefined) {
  if (!file) return
  const url = URL.createObjectURL(file)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

// Slotting FormKit's own `fileRemove` section (to get a real chip instead of
// its default plain-text file name) replaces that section's rendering
// entirely, onClick-to-remove included - there's nothing left to fall back
// on, so removal has to be done by hand here, straight against the same
// `fileList` v-model FormKit itself reads/writes.
function removeFile(name: string) {
  fileList.value = fileList.value.filter(f => f.name !== name)
}

// Reports whether this field currently counts as "filled", to whichever page
// rendered it (the builder canvas, the in-app read view, or /form-preview) -
// those pages gate their Submit button on every required field being filled,
// so each field type needs to answer that for itself. Fields that aren't
// answerable at all (a static text block, a button link) never block Submit.
const fieldValues = useFormFieldValues()

function reportFilled(v: boolean) {
  if (fieldValues) fieldValues[props.field.id] = v
}

watch([textValue, checked, fileName, hasSignature], () => {
  if (props.field.type === 'checkbox') reportFilled(checked.value)
  else if (props.field.type === 'file_upload') reportFilled(!!fileName.value)
  else if (props.field.type === 'signature') reportFilled(hasSignature.value)
  else if (props.field.type === 'short_text' || props.field.type === 'paragraph' || props.field.type === 'number') reportFilled(textValue.value.trim() !== '')
}, { immediate: true })

// FormKit's own `number` rule (on top of the type="number" input, which only
// restricts what the browser lets you *type*) is what actually rejects a
// value that isn't numeric - e.g. one pasted in.
const fieldValidation = computed(() => {
  const rules: string[] = []
  if (props.field.required) rules.push('required')
  if (props.field.type === 'number') rules.push('number')
  return rules.length ? rules.join('|') : undefined
})

// Each answerable type gets its own placeholder instead of one generic
// "Type here…" for every field - a number field inviting "0" reads very
// differently than a paragraph inviting a longer answer.
const placeholder = computed(() => {
  switch (props.field.type) {
    case 'number': return 'Enter a number…'
    case 'paragraph': return 'Type your detailed answer…'
    case 'short_text': return 'Type your answer…'
    default: return 'Type your answer…'
  }
})
</script>

<template>
  <!-- Move/duplicate/remove live inside the row's own content (a small
       hover-revealed corner menu), not in a dedicated table column or
       floating out in the page's margin - the latter broke down once the
       viewport got no wider than the paper itself, leaving the controls
       stranded with nothing around them. Every branch below puts the menu
       INSIDE its own <td> (never as a sibling of one) - a bare element
       between <td>s isn't valid inside a <tr> and the HTML parser hoists it
       right out of the table, which is why a v-html cell wraps its content
       in an inner <div> instead of using v-html on the <td> itself: v-html
       replaces all of an element's children, so there'd be nowhere left to
       put the controls alongside it. -->
  <tr v-if="field.type === 'static_text'" v-bind="$attrs" class="group">
    <td
      colspan="2"
      class="relative align-top break-words"
      :class="[
        editable ? 'pl-8 pr-16' : '',
        plain ? 'py-1' : 'border border-[#D1D5DB] px-3 py-3'
      ]"
    >
      <div class="leading-relaxed text-[#374151] prose-tiptap text-sm" v-html="wrapTokens(field.content || '')" />
      <MasterDataFieldRowControls v-if="editable" :can-move-up="canMoveUp" :can-move-down="canMoveDown" @move-up="emit('move-up')" @move-down="emit('move-down')" @duplicate="emit('duplicate')" @remove="emit('remove')" />
    </td>
  </tr>

  <!-- A button link is an action, not a question with an answer, but it's
       still a normal field type like any other - it follows the section's
       boxed/plain look the same way static text and signature do (a
       border+padding box, or a borderless plain row), just always spanning
       the full row width since there's no label|value split for an action. -->
  <tr v-else-if="field.type === 'button_link'" v-bind="$attrs" class="group">
    <td
      colspan="2"
      class="relative align-top"
      :class="[
        editable ? 'pl-8 pr-16' : '',
        plain ? 'py-1' : 'border border-[#D1D5DB] px-3 py-3'
      ]"
    >
      <UButton
        type="button"
        :color="(field.buttonColor as 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' | undefined) || 'primary'"
        variant="solid"
        size="sm"
        :icon="field.buttonIcon || undefined"
        :to="interactive ? (field.buttonUrl || undefined) : undefined"
        :disabled="!interactive"
        target="_blank"
        @click.stop
      >
        {{ field.label || 'Open link' }}
      </UButton>
      <p v-if="field.hint" class="text-xs font-normal text-[#9CA3AF] mt-1.5 normal-case">{{ field.hint }}</p>
      <MasterDataFieldRowControls v-if="editable" :can-move-up="canMoveUp" :can-move-down="canMoveDown" @move-up="emit('move-up')" @move-down="emit('move-down')" @duplicate="emit('duplicate')" @remove="emit('remove')" />
    </td>
  </tr>

  <tr v-else-if="field.type === 'signature'" v-bind="$attrs" class="group">
    <td
      colspan="2"
      class="relative align-top"
      :class="[
        editable ? 'pl-8 pr-16' : '',
        plain ? 'py-1' : 'border border-[#D1D5DB] px-3 py-4'
      ]"
    >
      <div class="relative">
        <MasterDataSignaturePad v-model:has-content="hasSignature" :disabled="!interactive || !!lockedReasons?.length" />
        <div v-if="lockedReasons?.length" class="absolute -inset-1.5 z-[1] flex items-center justify-center rounded-md bg-[#FAFAFD]/95 p-3">
          <div class="max-w-[340px] border border-[#E8C77E] border-l-[3px] border-l-[#E87040] bg-white px-3.5 py-2.5 text-xs text-[#7A5000] shadow-sm">
            <p class="mb-1 font-semibold text-[#B4530F]">Signature locked</p>
            <p class="mb-1">Complete the required items before signing:</p>
            <ul class="list-disc pl-4">
              <li v-for="reason in lockedReasons" :key="reason">{{ reason }}</li>
            </ul>
          </div>
        </div>
      </div>
      <p class="text-xs text-[#6B7280] uppercase tracking-wide mt-1">
        {{ field.label }}<span class="text-[#DC2626]">*</span>
      </p>
      <p v-if="field.hint" class="text-xs font-normal text-[#9CA3AF] mt-0.5 normal-case">{{ field.hint }}</p>
      <FormKit
        type="text"
        v-model="signatureValue"
        :name="field.id"
        :label="field.label"
        validation="required"
        validation-visibility="live"
        outer-class="contents"
        wrapper-class="hidden"
        :message-class="showValidation ? 'text-xs text-[#DC2626] mt-0.5 normal-case' : 'hidden'"
      />
      <MasterDataFieldRowControls v-if="editable" :can-move-up="canMoveUp" :can-move-down="canMoveDown" @move-up="emit('move-up')" @move-down="emit('move-down')" @duplicate="emit('duplicate')" @remove="emit('remove')" />
    </td>
  </tr>

  <!-- A `plain`-layout field: no label|value column split, no shared table
       box - the whole thing spans the full row width. Checkbox and file
       upload put their own label text right beside the control (a checkbox
       with nothing next to it, or a label sitting on its own line above a
       button, both read oddly for a single yes/no action) - every other
       type keeps the label as a small heading above a borderless answer. -->
  <tr v-else-if="plain" v-bind="$attrs" class="group">
    <td colspan="2" class="relative py-1 align-top break-words" :class="editable ? 'pl-8 pr-16' : ''">
      <template v-if="field.type === 'checkbox'">
        <!-- Same green tint as the boxed layout's checkbox row - the whole
             acknowledgement (checkbox + its text), not just the little box. -->
        <div class="rounded-md transition-colors" :class="checked ? 'bg-emerald-50 ring-1 ring-emerald-300 px-2 py-1 -mx-2 -my-1' : ''">
          <FormKit
            type="checkbox"
            v-model="checked"
            :name="field.id"
            :label="field.label"
            :validation="fieldValidation"
            validation-visibility="live"
            :disabled="!interactive"
            outer-class="contents"
            wrapper-class="inline-flex items-center gap-2"
            inner-class="contents"
            input-class="size-4 shrink-0 accent-[#386BE6]"
            :message-class="showValidation ? 'text-xs text-[#DC2626] mt-0.5' : 'hidden'"
            @click.stop
          >
            <template #label>
              <span class="font-semibold text-sm text-[#111827]" :class="interactive ? 'cursor-pointer' : ''">{{ field.label }}<span v-if="field.required" class="text-[#DC2626]">*</span></span>
            </template>
          </FormKit>
          <p v-if="field.hint" class="text-xs font-normal text-[#9CA3AF] mt-0.5">{{ field.hint }}</p>
        </div>
      </template>

      <template v-else-if="field.type === 'file_upload'">
        <div @click.stop>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-sm text-[#111827]">{{ field.label }}<span v-if="field.required" class="text-[#DC2626]">*</span></span>
            <template v-if="!fileList.length">
              <UButton
                as="label"
                :for="fileInputId(field)"
                type="button"
                variant="outline"
                color="neutral"
                size="xs"
                icon="i-lucide-upload"
                :class="interactive ? 'cursor-pointer' : 'pointer-events-none opacity-60'"
              >
                Choose file
              </UButton>
              <span class="text-dimmed text-xs">No file chosen</span>
            </template>
          </div>

          <!-- The image goes below the label (not inline with it) once one's
               attached - a preview, not a filename chip, since the whole
               point of this field is a documentation photo. -->
          <div v-if="fileList.length" class="mt-2 relative inline-block">
            <img
              :src="filePreviewUrl"
              class="max-h-40 rounded-md border border-[#D1D5DB] cursor-pointer"
              alt="Attached file preview"
              @click="openFile(fileList[0]?.file)"
            >
            <UButton
              v-if="interactive"
              type="button"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="solid"
              square
              class="absolute -top-2 -right-2 rounded-full shadow"
              aria-label="Remove attached file"
              @click="removeFile(fileList[0]!.name)"
            />
          </div>

          <FormKit
            type="file"
            v-model="fileList"
            :id="fileInputId(field)"
            :name="field.id"
            :label="field.label"
            :validation="fieldValidation"
            validation-visibility="live"
            :disabled="!interactive"
            accept="image/jpeg,image/png"
            outer-class="contents"
            wrapper-class="contents"
            inner-class="contents"
            label-class="hidden"
            no-files-class="hidden"
            file-list-class="hidden"
            :message-class="showValidation ? 'text-xs text-[#DC2626] mt-0.5 w-full' : 'hidden'"
            input-class="sr-only"
          />
        </div>
        <p v-if="field.hint" class="text-xs font-normal text-[#9CA3AF] mt-0.5">{{ field.hint }}</p>
      </template>

      <template v-else>
        <div class="font-semibold text-[#111827] text-sm">
          {{ field.label }}<span v-if="field.required" class="text-[#DC2626]">*</span>
        </div>
        <p v-if="field.hint" class="text-xs font-normal text-[#9CA3AF] mt-0.5">{{ field.hint }}</p>
        <div class="mt-1.5" @click.stop>
          <FormKit
            :type="field.type === 'paragraph' ? 'textarea' : field.type === 'number' ? 'number' : 'text'"
            v-model="textValue"
            :name="field.id"
            :label="field.label"
            :validation="fieldValidation"
            validation-visibility="live"
            :disabled="!interactive"
            :placeholder="placeholder"
            outer-class="contents"
            wrapper-class="contents"
            inner-class="contents"
            label-class="hidden"
            :input-class="field.type === 'paragraph'
              ? 'w-full resize-none border-0 border-b rounded-none border-[#D1D5DB] px-0 py-1 text-sm bg-transparent focus:outline-none focus:border-[#386BE6] disabled:cursor-not-allowed disabled:opacity-60'
              : 'w-full border-0 border-b rounded-none border-[#D1D5DB] px-0 py-1 text-sm bg-transparent focus:outline-none focus:border-[#386BE6] disabled:cursor-not-allowed disabled:opacity-60'"
            :message-class="showValidation ? 'text-xs text-[#DC2626] mt-0.5' : 'hidden'"
          />
        </div>
      </template>

      <MasterDataFieldRowControls v-if="editable" :can-move-up="canMoveUp" :can-move-down="canMoveDown" @move-up="emit('move-up')" @move-down="emit('move-down')" @duplicate="emit('duplicate')" @remove="emit('remove')" />
    </td>
  </tr>

  <!-- Short text, paragraph, number, checkbox, and file upload are genuinely
       question+answer shaped - a labeled prompt beside a typed/checked/
       uploaded answer - so they keep the two-column row. The grip goes in
       the label cell (the row's true left edge), duplicate/remove in the
       value cell's own corner - together they land at the row's outer
       edges without needing dedicated columns for either. -->
  <tr v-else v-bind="$attrs" class="group">
    <!-- A checked checkbox tints both cells green (label + its answer), matching the
         reference mockup's `.att.on` treatment - the acknowledgement box itself going
         green once accepted, not just the little checkbox square. -->
    <td
      class="relative border border-[#D1D5DB] bg-[#F9FAFB] px-3 py-2 text-sm font-semibold text-[#374151] w-[38%] align-top break-words"
      :class="[editable ? 'pl-8' : '', field.type === 'checkbox' && checked ? '!bg-emerald-50 !border-emerald-300' : '']"
    >
      {{ field.label }}<span v-if="field.required" class="text-[#DC2626]">*</span>
      <p v-if="field.hint" class="text-xs font-normal text-[#9CA3AF] mt-0.5 normal-case break-words">{{ field.hint }}</p>
      <MasterDataFieldRowControls v-if="editable" only="grip" :can-move-up="canMoveUp" :can-move-down="canMoveDown" @move-up="emit('move-up')" @move-down="emit('move-down')" />
    </td>
    <td
      class="relative border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] align-top break-words min-w-0"
      :class="[editable ? 'pr-16' : '', field.type === 'checkbox' && checked ? 'bg-emerald-50 border-emerald-300' : '']"
    >
      <FormKit
        v-if="field.type === 'checkbox'"
        type="checkbox"
        v-model="checked"
        :name="field.id"
        :label="field.label"
        :validation="fieldValidation"
        validation-visibility="live"
        :disabled="!interactive"
        outer-class="contents"
        wrapper-class="contents"
        inner-class="contents"
        label-class="hidden"
        input-class="size-4 shrink-0 accent-[#386BE6]"
        :message-class="showValidation ? 'text-xs text-[#DC2626] mt-0.5' : 'hidden'"
        @click.stop
      />
      <div v-else-if="field.type === 'file_upload'" class="flex flex-col items-center gap-2" @click.stop>
        <div v-if="!fileList.length" class="flex items-center gap-2">
          <UButton
            as="label"
            :for="fileInputId(field)"
            type="button"
            variant="outline"
            color="neutral"
            size="xs"
            icon="i-lucide-upload"
            :class="interactive ? 'cursor-pointer' : 'pointer-events-none opacity-60'"
          >
            Choose file
          </UButton>
          <span class="text-dimmed text-xs">No file chosen</span>
        </div>

        <!-- Centered like the button/empty-state row it replaces - a
             documentation photo, not a filename chip, once one's attached. -->
        <div v-else class="relative inline-block">
          <img
            :src="filePreviewUrl"
            class="max-h-40 rounded-md border border-[#D1D5DB] cursor-pointer"
            alt="Attached file preview"
            @click="openFile(fileList[0]?.file)"
          >
          <UButton
            v-if="interactive"
            type="button"
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="solid"
            square
            class="absolute -top-2 -right-2 rounded-full shadow"
            aria-label="Remove attached file"
            @click="removeFile(fileList[0]!.name)"
          />
        </div>

        <FormKit
          type="file"
          v-model="fileList"
          :id="fileInputId(field)"
          :name="field.id"
          :label="field.label"
          :validation="fieldValidation"
          validation-visibility="live"
          :disabled="!interactive"
          accept="image/jpeg,image/png"
          outer-class="contents"
          wrapper-class="contents"
          inner-class="contents"
          label-class="hidden"
          no-files-class="hidden"
          file-list-class="hidden"
          :message-class="showValidation ? 'text-xs text-[#DC2626] mt-0.5' : 'hidden'"
          input-class="sr-only"
        />
      </div>
      <FormKit
        v-else
        :type="field.type === 'paragraph' ? 'textarea' : field.type === 'number' ? 'number' : 'text'"
        v-model="textValue"
        :name="field.id"
        :label="field.label"
        :validation="fieldValidation"
        validation-visibility="live"
        :disabled="!interactive"
        :placeholder="placeholder"
        outer-class="contents"
        wrapper-class="contents"
        inner-class="contents"
        label-class="hidden"
        :input-class="field.type === 'paragraph'
          ? 'w-full resize-none border-0 px-0 py-0 text-sm bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60'
          : 'w-full border-0 px-0 py-0 text-sm bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60'"
        :message-class="showValidation ? 'text-xs text-[#DC2626] mt-0.5' : 'hidden'"
        @click.stop
      />
      <MasterDataFieldRowControls v-if="editable" only="actions" @duplicate="emit('duplicate')" @remove="emit('remove')" />
    </td>
  </tr>
</template>
