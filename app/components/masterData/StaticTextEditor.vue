<script setup lang="ts">
// Replaces a raw "edit the HTML source" textarea with the same WYSIWYG editor
// used for email bodies - form builders are largely non-technical staff, so
// asking them to hand-edit <p>/<ol> tags isn't a reasonable ask. This renders
// through the same Tiptap stack as EmailBodyField, including the full
// (non-compact) toolbar - a Text Block can carry a table, a message banner,
// or a callout just like an email body can, per the reference document this
// was modeled on (GoTeam_Asset_Receiving_Commitment_Form_Mockup_v1.html),
// which uses all three inside its clause text. Inserted {{PLACEHOLDER}}
// tokens aren't highlighted live while typing here either (matching
// EmailBodyField - see its own comment: tokens only get the `.tok-hl` treatment
// in the read-only rendered view, via `wrapTokens()`, not inside the live
// Tiptap document) - that highlighting happens in FormDocumentField.vue's
// read-mode render of this same content.
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import { FontSize, Callout, MessageBanner, QuoteCommand, ButtonLink, TableHeaderStyled } from '~/utils/tiptapExtensions'

interface Props {
  modelValue?: string
}

const props = withDefaults(defineProps<Props>(), { modelValue: '' })
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    TextAlign.configure({ types: ['paragraph', 'heading'] }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    FontSize,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeaderStyled,
    TableCell,
    Callout,
    MessageBanner,
    QuoteCommand,
    ButtonLink
  ],
  editorProps: {
    attributes: {
      class: 'min-h-32 p-3 text-sm text-default leading-relaxed rounded-b-lg focus:outline-none prose-tiptap'
    }
  },
  onUpdate: ({ editor: e }) => {
    emit('update:modelValue', e.getHTML())
  }
})

watch(() => props.modelValue, (value) => {
  if (editor.value && value !== editor.value.getHTML()) {
    editor.value.commands.setContent(value, { emitUpdate: false })
  }
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

// Called by the parent (field-settings panel) after a placeholder is picked
// from the drawer - inserted at the current cursor position like any other
// typed text, not appended to the end, since a Text Block is free-form prose
// a token might belong anywhere in.
function insertToken(code: string) {
  editor.value?.chain().focus().insertContent(`{{${code}}}`).run()
}

defineExpose({ insertToken })
</script>

<template>
  <div class="border border-default rounded-lg overflow-hidden">
    <EmailBlockToolbar :editor="editor" />
    <EditorContent :editor="editor" />
  </div>
</template>
