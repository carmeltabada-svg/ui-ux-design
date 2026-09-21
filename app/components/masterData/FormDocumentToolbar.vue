<script setup lang="ts">
// The form document canvas's own formatting/insert toolbar - a separate,
// full-width bar the host page attaches directly under its own page header,
// not something nested inside (and width-constrained by) the canvas panel's
// own padding/border. It used to live inside FormDocumentEditor.vue itself,
// which meant it inherited that panel's `px-6` page padding and rounded
// border instead of running edge-to-edge like a real toolbar. Talks to the
// document purely through the `editor` instance FormDocumentEditor.vue now
// exposes via defineExpose, so it works on any Editor instance without
// needing to know about the canvas around it.
import type { Editor } from '@tiptap/vue-3'
import { TOKEN_GROUPS } from '~/data/templates'

interface Props {
  editor?: Editor
  /** The document's current HTML - only read to derive which placeholder
   * tokens are already used, for the drawer's "Used in template" filter. */
  content: string
  placeholdersEnabled: boolean
  formMode: 'onsite' | 'remote'
}

const props = defineProps<Props>()

const placeholderOpen = ref(false)
const placeholderUsedCodes = computed(() => {
  const matches = props.content.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map(m => m.slice(2, -2)))]
})

function insertPlaceholderToken(code: string) {
  // `insertContentAt(pos, ...)` with a single position (not a range) always
  // inserts there without touching whatever was selected beforehand -
  // `insertContent()` instead inserts at/replaces the *current selection*,
  // which is the bug this works around: a `formField` node is `atom: true`
  // (see formFieldNode.ts), so right after inserting one, ProseMirror leaves
  // it selected as a whole NodeSelection - not a collapsed cursor. Clicking
  // a toolbar button next doesn't change that selection at all (nothing was
  // clicked *in the document*), so a plain `insertContent()` call replaced
  // that still-selected field instead of adding new content after it.
  const editor = props.editor
  if (!editor) return
  editor.chain().focus().insertContentAt(editor.state.selection.to, `{{${code}}}`).run()
}

// Every field renders "plain" now (see formFieldNode.ts - the `layout`
// attribute and its card-box look were removed entirely). The one thing
// insertion still decides automatically is `hideLabel`: a field dropped
// into a table cell defaults to no label (the cell's own neighboring label
// cell, from the *other* table-insert path, already names it - see main.css/
// TableControls.vue for that plain informational table), while a standalone
// field defaults to showing its own label. Either way it's just a starting
// default - always flippable afterward via the field's own "Show label"
// setting (FormFieldNodeView.vue).
function insertField(fieldType: string, label: string) {
  const editor = props.editor
  if (!editor) return
  const insideTableCell = editor.isActive('tableCell') || editor.isActive('tableHeader')
  // See insertPlaceholderToken() above for why this is `insertContentAt` at
  // the selection's own end, not a plain `insertContent()` - a `formField`
  // is an atom node, so the field just inserted (or any other atom, like a
  // previous field) is very likely still the *whole* current selection, and
  // `insertContent()` would replace it instead of adding a new field next to
  // it - the exact "inserting a field replaces the last one" bug this fixes.
  editor.chain().focus().insertContentAt(editor.state.selection.to, {
    type: 'formField',
    attrs: {
      id: crypto.randomUUID(),
      fieldType,
      label,
      hint: '',
      required: fieldType !== 'button_link',
      buttonUrl: '',
      buttonColor: 'primary',
      hideLabel: insideTableCell
    }
  }).run()
}

const insertFieldMenuItems = computed(() => [[
  { label: 'Short text', icon: 'i-lucide-type', onSelect: () => insertField('short_text', 'Short answer') },
  { label: 'Paragraph', icon: 'i-lucide-align-left', onSelect: () => insertField('paragraph', 'Long answer') },
  { label: 'Number', icon: 'i-lucide-hash', onSelect: () => insertField('number', 'Number') },
  { label: 'Checkbox', icon: 'i-lucide-square-check', onSelect: () => insertField('checkbox', 'I acknowledge') },
  { label: 'File upload', icon: 'i-lucide-upload', onSelect: () => insertField('file_upload', 'Attachment') },
  { label: 'Required signature box', icon: 'i-lucide-pen-line', onSelect: () => insertField('signature', 'Signature') },
  { label: 'Button link', icon: 'i-lucide-external-link', onSelect: () => insertField('button_link', 'Open link') }
]])
</script>

<template>
  <div class="shrink-0 flex items-center gap-1 flex-wrap border-b border-default bg-elevated/50 px-3 py-1.5">
    <EmailBlockToolbar :editor="editor" flush />
    <div class="w-px h-4.5 bg-border mx-1" />
    <UTooltip :text="placeholdersEnabled ? 'Insert placeholder' : 'Insert placeholder (attach this form to an email template first)'">
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        square
        icon="i-lucide-braces"
        aria-label="Insert placeholder"
        :disabled="!placeholdersEnabled"
        @click="placeholderOpen = true"
      />
    </UTooltip>
    <UTooltip text="Insert field">
      <UDropdownMenu :items="insertFieldMenuItems">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          square
          icon="i-lucide-text-cursor-input"
          aria-label="Insert field"
        />
      </UDropdownMenu>
    </UTooltip>
  </div>

  <EmailPlaceholderDrawer
    v-if="placeholdersEnabled"
    v-model="placeholderOpen"
    :groups="TOKEN_GROUPS"
    :used-codes="placeholderUsedCodes"
    context-label="Document"
    :context-mode="formMode"
    @insert="insertPlaceholderToken"
  />
</template>
