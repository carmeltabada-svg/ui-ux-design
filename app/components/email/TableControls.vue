<script setup lang="ts">
// Contextual table controls - only meaningful (and only shown) with the
// cursor actually inside a table, same as Word/Docs only surfacing table
// commands on a table selection instead of cluttering the main toolbar with
// buttons that do nothing everywhere else. Covers the three things a table
// needs beyond insertion: toggling the header row on/off, picking the header
// row's own background color (text color auto-computed for contrast - see
// TableHeaderStyled in ~/utils/tiptapExtensions.ts), and column/row resize,
// which Tiptap's own Table extension already provides via
// `resizable: true` (a drag handle on each column border) - nothing extra to
// build for that part.
import type { Editor } from '@tiptap/vue-3'

interface Props {
  editor?: Editor
}

const props = defineProps<Props>()

const tick = ref(0)
function forceUpdate() {
  tick.value++
}
onMounted(() => {
  props.editor?.on('transaction', forceUpdate)
  props.editor?.on('selectionUpdate', forceUpdate)
})
onBeforeUnmount(() => {
  props.editor?.off('transaction', forceUpdate)
  props.editor?.off('selectionUpdate', forceUpdate)
})

// Plain functions, not `computed()` - a `computed` only recomputes when a
// tracked dependency (`tick.value`) actually changes, but a pure cursor move
// into/out of a table (no document mutation) doesn't reliably reach that -
// same reasoning as `isActive()` in BlockToolbar.vue, which stays a plain
// function re-evaluated fresh on every render for exactly this reason.
function inTable() {
  tick.value
  return props.editor?.isActive('table') ?? false
}

function hasHeaderRow() {
  tick.value
  if (!props.editor) return false
  // A table has a header row when its first row's cells are all
  // `tableHeader` nodes - Tiptap doesn't expose this as a single
  // `isActive` check, so it's read directly off the resolved table node.
  const { state } = props.editor
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === 'table') {
      const firstRow = node.firstChild
      return !!firstRow && firstRow.children.every(cell => cell.type.name === 'tableHeader')
    }
  }
  return false
}

// Softer tints first (dark text, per contrastingTextColor's own luminance
// check in tiptapExtensions.ts) - a table header is a whole shaded row, not
// a small chip, so a heavy saturated fill read as "too dark" for that much
// area; the original 6 bold hues stay available after them for anyone who
// does want a bold header.
const HEADER_COLORS = [
  '#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#ede9fe', '#e2e8f0',
  '#386be6', '#0f172b', '#007f45', '#894b00', '#dc2626', '#64748b'
]

// `updateAttributes('tableHeader', ...)` only touches whichever single cell
// the cursor/selection currently resolves to - a header "color" is a row-
// level choice (like Word's own header-row shading), so this walks the
// table's own first row and stamps every one of its cells, not just the one
// the cursor happens to be in.
function setHeaderColor(color: string | null) {
  const editor = props.editor
  if (!editor) return
  editor.chain().focus().command(({ tr, state }) => {
    const { $from } = state.selection
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth)
      if (node.type.name !== 'table') continue
      const tableStart = $from.before(depth) + 1
      const firstRow = node.firstChild
      if (!firstRow) return false
      let cellStart = tableStart + 1
      firstRow.forEach((cell) => {
        if (cell.type.name === 'tableHeader') {
          tr.setNodeAttribute(cellStart, 'backgroundColor', color)
        }
        cellStart += cell.nodeSize
      })
      return true
    }
    return false
  }).run()
}
</script>

<template>
  <template v-if="inTable()">
    <UTooltip :text="hasHeaderRow() ? 'Remove header row' : 'Add header row'">
      <UButton
        color="neutral"
        :variant="hasHeaderRow() ? 'subtle' : 'ghost'"
        size="xs"
        square
        icon="i-lucide-rows-2"
        :aria-label="hasHeaderRow() ? 'Remove header row' : 'Add header row'"
        @click="editor?.chain().focus().toggleHeaderRow().run()"
      />
    </UTooltip>
    <UPopover>
      <UTooltip text="Header color">
        <UButton color="neutral" variant="ghost" size="xs" square :disabled="!hasHeaderRow()" aria-label="Header color">
          <UIcon name="i-lucide-paint-bucket" class="size-4" />
        </UButton>
      </UTooltip>
      <template #content>
        <div class="grid grid-cols-6 gap-1 p-2">
          <button
            type="button"
            class="size-5 rounded-full ring-1 ring-default bg-card flex items-center justify-center"
            aria-label="No fill"
            @click="setHeaderColor(null)"
          >
            <UIcon name="i-lucide-x" class="size-3 text-dimmed" />
          </button>
          <button
            v-for="c in HEADER_COLORS"
            :key="c"
            type="button"
            class="size-5 rounded-full ring-1 ring-default"
            :style="{ background: c }"
            :aria-label="`Set header color ${c}`"
            @click="setHeaderColor(c)"
          />
        </div>
      </template>
    </UPopover>
    <UTooltip text="Delete table">
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        square
        icon="i-lucide-trash-2"
        aria-label="Delete table"
        class="hover:text-error"
        @click="editor?.chain().focus().deleteTable().run()"
      />
    </UTooltip>
  </template>
</template>
