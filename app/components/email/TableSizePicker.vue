<script setup lang="ts">
// A hover-to-pick grid for choosing a table's row/column count before
// inserting it - the same interaction Word/Google Docs/Notion all use,
// instead of always inserting a fixed 3x3 and making someone add/remove
// rows and columns by hand afterward to get the size they actually wanted.
interface Props {
  editor?: import('@tiptap/vue-3').Editor
}
defineProps<Props>()

const MAX_COLS = 8
const MAX_ROWS = 6

const open = ref(false)
const hoverRows = ref(0)
const hoverCols = ref(0)

function reset() {
  hoverRows.value = 0
  hoverCols.value = 0
}

function insert(rows: number, cols: number, editor?: import('@tiptap/vue-3').Editor) {
  editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
  open.value = false
  reset()
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ side: 'bottom', align: 'start', sideOffset: 8 }" @update:open="(v: boolean) => !v && reset()">
    <UTooltip text="Insert table">
      <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-table" aria-label="Insert table" />
    </UTooltip>

    <template #content>
      <div class="p-3">
        <p class="text-xs text-dimmed mb-2">
          {{ hoverRows && hoverCols ? `${hoverRows} × ${hoverCols}` : 'Pick a table size' }}
        </p>
        <div
          class="grid gap-[3px]"
          :style="{ gridTemplateColumns: `repeat(${MAX_COLS}, 16px)` }"
          @mouseleave="reset"
        >
          <button
            v-for="i in MAX_ROWS * MAX_COLS"
            :key="i"
            type="button"
            class="size-4 rounded-[2px] border transition-colors"
            :class="Math.ceil(i / MAX_COLS) <= hoverRows && ((i - 1) % MAX_COLS) + 1 <= hoverCols
              ? 'bg-primary border-primary'
              : 'bg-elevated border-default'"
            :aria-label="`${Math.ceil(i / MAX_COLS)} by ${((i - 1) % MAX_COLS) + 1} table`"
            @mouseenter="hoverRows = Math.ceil(i / MAX_COLS); hoverCols = ((i - 1) % MAX_COLS) + 1"
            @click="insert(Math.ceil(i / MAX_COLS), ((i - 1) % MAX_COLS) + 1, editor)"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
