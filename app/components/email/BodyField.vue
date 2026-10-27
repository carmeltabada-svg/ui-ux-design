<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { NodeSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import { Placeholder } from '@tiptap/extensions'
import { FontSize, Callout, MessageBanner, QuoteCommand, ButtonLink, TableHeaderStyled, EmailImage, EmailTrailingNode } from '~/utils/tiptapExtensions'
import { wrapTokens } from '~/data/templates'

interface Props {
  modelValue: string
  editing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editing: false
})

const emit = defineEmits<{ 'update:modelValue': [string]; focus: []; 'open-placeholder': [] }>()

// True once the author has clicked or tabbed into the body in this edit session. Until then the
// editor's selection is just the top of the document, not a place they chose, so a placeholder
// must not be dropped there.
const hasCursor = ref(false)
watch(() => props.editing, () => { hasCursor.value = false })

const { onTokenClick } = useTokenHighlight()

const viewHtml = computed(() => wrapTokens(props.modelValue))

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    // `trailingNode: false` here - not "no trailing-node safety at all",
    // `EmailTrailingNode` below replaces it with the same behavior *except*
    // for a Footer-marked image (see that extension's own comment). Every
    // other trailing block atom (tables, plain/Header images, callouts...)
    // still gets StarterKit's normal safety paragraph; this only carves out
    // the one case that's deliberately meant to be the document's actual
    // final node with nothing after it.
    StarterKit.configure({ trailingNode: false }),
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
    ButtonLink,
    // `inline: false` (the default) - an image is a block of its own line,
    // not text-flow content sitting mid-sentence like a `formField` atom.
    // Its own NodeView (EmailImageNodeView.vue) handles sizing per role
    // (plain/header/footer) directly - see tiptapExtensions.ts.
    EmailImage,
    EmailTrailingNode,
    // The specific guidance text per container is driven by CSS (see
    // `.prose-tiptap [data-callout] p.is-empty::before` etc. in main.css) keyed
    // off the DOM structure, rather than resolving the container node here -
    // Tiptap rebuilds these decorations both via a full document scan and via
    // an incremental per-transaction path, and resolving `pos` against
    // `editor.state.doc` inside this callback occasionally raced one of those
    // paths and picked up a stale/mismatched parent. CSS ancestor selectors
    // don't have that race since they read the final rendered DOM.
    Placeholder.configure({
      includeChildren: true,
      showOnlyCurrent: false
    })
  ],
  editorProps: {
    attributes: {
      class: 'min-h-40 p-3.5 text-sm text-highlighted leading-relaxed rounded-b-lg focus:outline-none prose-tiptap'
    },
    handleDOMEvents: {
      focus: () => {
        hasCursor.value = true
        emit('focus')
        return false
      },
      // A button link (ButtonLink in tiptapExtensions.ts) renders as a real
      // `<a href target="_blank">` wrapped in its own alignment `<div>` (see
      // that node's `renderHTML`) - two problems that need fixing together
      // here, not one: (1) a plain click on it did the browser's own thing -
      // opening the link - instead of ever reaching ProseMirror at all, and
      // (2) even with that stopped, ProseMirror's *own* automatic click-to-
      // NodeSelection resolution never fired for it either (unlike clicking
      // any other atom, e.g. an image) - most likely because the click
      // lands on the wrapping `<div>`'s descendant `<a>`, one DOM layer
      // deeper than ProseMirror's default click handling expects for a leaf
      // atom's own top-level element. Given ProseMirror wasn't going to
      // select it on its own, this resolves and sets that selection by
      // hand via `posAtDOM` (finds the doc position right at/before the DOM
      // node clicked) instead of just hoping default handling picks it up.
      mousedown: (view, event) => {
        const target = event.target as HTMLElement | null
        const anchor = target?.closest('[data-btn-link]') as HTMLElement | null
        if (!anchor) return false
        event.preventDefault()

        const pos = view.posAtDOM(anchor, 0)
        for (const candidate of [pos, pos - 1, pos + 1]) {
          const node = view.state.doc.nodeAt(candidate)
          if (node?.type.name === 'buttonLink') {
            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, candidate)))
            break
          }
        }
        view.focus()
        return true
      }
    }
  },
  onUpdate: ({ editor: e }) => {
    emit('update:modelValue', e.getHTML())
  }
})

// keep the editor's content in sync when switching templates or entering edit mode
watch(() => props.modelValue, (value) => {
  if (editor.value && value !== editor.value.getHTML()) {
    editor.value.commands.setContent(value, { emitUpdate: false })
  }
})

/**
 * Inserts text where the author's cursor is, replacing any text they have selected. The editor
 * keeps its selection when it loses focus (for example while the placeholder drawer is open), so
 * this works without pulling focus back, and repeated calls continue after the previous insert.
 * 'none': the author never chose a place in the body. 'node': an image or button is selected, and
 * inserting would replace it.
 */
function insertAtCursor(text: string): 'ok' | 'none' | 'node' {
  const e = editor.value
  if (!e || !hasCursor.value) return 'none'
  if (e.state.selection instanceof NodeSelection) return 'node'
  e.chain().insertContent({ type: 'text', text }).run()
  return 'ok'
}
defineExpose({ insertAtCursor })

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div>
    <EmailFieldLabel label="Body" />

    <div v-if="editing" class="border border-default rounded-b-lg rounded-t-none overflow-hidden">
      <div class="flex items-center bg-elevated/50 border-b border-default">
        <EmailBlockToolbar :editor="editor" flush class="flex-1" />
        <div class="w-px h-4.5 bg-border mx-1" />
        <UTooltip text="Insert placeholder">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            square
            icon="i-lucide-braces"
            aria-label="Insert placeholder"
            class="mr-1.5"
            @click="emit('open-placeholder')"
          />
        </UTooltip>
      </div>
      <div v-if="!editor" class="p-4 flex flex-col gap-3 min-h-40" role="status" aria-live="polite" aria-label="Loading editor">
        <SharedSkeleton :lines="4" height="h-4" />
        <SharedSkeleton width="w-1/2" height="h-4" />
      </div>
      <EditorContent v-else :editor="editor" />
    </div>

    <div
      v-else
      class="text-sm text-highlighted leading-relaxed pb-2 prose-tiptap"
      data-pane="editor"
      v-html="viewHtml"
      @click="onTokenClick"
    />
  </div>
</template>
