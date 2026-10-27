<script setup lang="ts">
import { SAMPLE_VALUES } from '~/data/templates'

interface Token {
  code: string
  name: string
}

interface TokenGroup {
  label: string
  note?: string
  tokens: Token[]
}

interface Props {
  groups: TokenGroup[]
  usedCodes: string[]
  contextLabel: string
  contextMode: 'onsite' | 'remote'
  /** Browse-only: rows copy the token and show its sample value instead of inserting it. */
  readOnly?: boolean
  /** Where an insert lands ( "Subject line" or "Body" ), shown in the header. */
  targetLabel?: string
  /**
   * Puts a token into the editor and says whether it went in. A token is only marked Added when it did.
   * `keepFocus` is true when the pick came from the keyboard, so focus can stay on the token row.
   */
  inserter?: (code: string, keepFocus: boolean) => boolean
}

const props = defineProps<Props>()

const open = defineModel<boolean>({ default: false })

// Narrow screens get a bottom sheet so the field being edited stays visible and clickable above it.
const narrow = ref(false)
onMounted(() => {
  const mq = window.matchMedia('(max-width: 639px)')
  narrow.value = mq.matches
  mq.addEventListener('change', e => { narrow.value = e.matches })
})

// The drawer is non-modal and ignores outside clicks (the author keeps clicking the editor), so
// Escape is handled here: it closes the drawer while focus is inside it.
function closeOnEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value && !props.readOnly && (e.target as HTMLElement | null)?.closest('[role="dialog"]')) open.value = false
}
onMounted(() => document.addEventListener('keydown', closeOnEscape))
onBeforeUnmount(() => document.removeEventListener('keydown', closeOnEscape))

const search = ref('')
const filter = ref<'all' | 'used'>('all')

// Several placeholders can be inserted in a row, so the drawer stays open. While it is open the
// lists are grouped by what was used when it opened (a token does not jump sections under the
// pointer after each insert), and each token shows how many times it was added this time.
const groupingUsed = ref<string[]>([])
const addedCounts = ref<Record<string, number>>({})
watch(open, (isOpen) => {
  if (isOpen) {
    groupingUsed.value = [...props.usedCodes]
    addedCounts.value = {}
    search.value = ""
  }
}, { immediate: true })
// Counts follow the same snapshot as the lists, so a chip never disagrees with the section under it.
const usedCount = computed(() => open.value ? groupingUsed.value.length : props.usedCodes.length)
const addedTotal = computed(() => Object.values(addedCounts.value).reduce((n, c) => n + c, 0))

const flatUsed = computed(() => {
  const used = new Set(groupingUsed.value)
  const q = search.value.toLowerCase()
  const result: { group: string; tok: Token }[] = []
  for (const group of props.groups) {
    for (const tok of group.tokens) {
      if (!used.has(tok.code)) continue
      if (q && !tok.name.toLowerCase().includes(q) && !tok.code.toLowerCase().includes(q)) continue
      result.push({ group: group.label, tok })
    }
  }
  return result
})

const flatUnused = computed(() => {
  const used = new Set(groupingUsed.value)
  const q = search.value.toLowerCase()
  const result: { group: string; tok: Token }[] = []
  for (const group of props.groups) {
    for (const tok of group.tokens) {
      if (used.has(tok.code)) continue
      if (filter.value === 'used') continue
      if (q && !tok.name.toLowerCase().includes(q) && !tok.code.toLowerCase().includes(q)) continue
      result.push({ group: group.label, tok })
    }
  }
  return result
})

function groupedRows(rows: { group: string; tok: Token }[]) {
  const groups: { label: string; tokens: Token[] }[] = []
  for (const row of rows) {
    let g = groups.find(g => g.label === row.group)
    if (!g) {
      g = { label: row.group, tokens: [] }
      groups.push(g)
    }
    g.tokens.push(row.tok)
  }
  return groups
}

function tokenLabel(code: string) {
  return ['{', '{', code, '}', '}'].join('')
}

const { copy, isCopied } = useCopyFlash()

function select(code: string, e: MouseEvent) {
  if (props.readOnly) {
    copy(code, tokenLabel(code))
    return
  }
  // detail is 0 for a keyboard activation (Enter or Space)
  if (!props.inserter?.(code, e.detail === 0)) return
  addedCounts.value = { ...addedCounts.value, [code]: (addedCounts.value[code] ?? 0) + 1 }
}
</script>

<template>
  <USlideover v-model:open="open" inset :side="narrow ? 'bottom' : 'right'" :modal="readOnly" :dismissible="readOnly" :overlay="readOnly" :ui="{ content: narrow ? 'h-[45vh] overflow-hidden' : 'max-w-[440px] w-[calc(100%-1.5rem)] inset-y-3 right-3 overflow-hidden', header: 'p-4 sm:px-6 min-h-16 bg-card', body: 'p-0 sm:p-0 flex flex-col overflow-hidden bg-card' }">
    <template #header="{ close }">
      <div class="flex-1 min-w-0">
        <h2 class="text-base font-semibold text-highlighted">Placeholder Library</h2>
        <p class="mt-0.5">
          <EmailDrawerContextBadge :label="contextLabel" :mode="contextMode" />
        </p>
        <p v-if="!readOnly && targetLabel" class="mt-1.5 text-xs text-muted">
          Inserting into <span class="font-semibold text-default">{{ targetLabel }}</span> at your cursor. Pick as many as you need.
          <span v-if="addedTotal" class="text-ams-success font-medium" role="status">{{ addedTotal }} added.</span>
        </p>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-x"
        aria-label="Close"
        class="absolute top-4 end-4"
        @click="close"
      />
    </template>

    <template #body>
      <!-- Pinned so search/filter stay reachable while the token list below
           scrolls, instead of scrolling away with it. -->
      <div class="shrink-0 px-4 sm:px-6 pt-4 pb-4 border-b border-default">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search placeholders..."
          size="md"
          class="w-full mb-3"
        />

        <div class="flex gap-2">
          <UButton
            :color="filter === 'all' ? 'primary' : 'neutral'"
            :variant="filter === 'all' ? 'solid' : 'outline'"
            size="xs"
            class="rounded-full"
            @click="filter = 'all'"
          >
            All
          </UButton>
          <UButton
            :color="filter === 'used' ? 'primary' : 'neutral'"
            :variant="filter === 'used' ? 'solid' : 'outline'"
            size="xs"
            class="rounded-full"
            @click="filter = 'used'"
          >
            Used in template
            <UBadge color="neutral" variant="soft" size="xs" class="rounded-full">{{ usedCount }}</UBadge>
          </UButton>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pt-[10px] pb-4 sm:px-6 sm:pb-6 fade-scroll-y">
        <template v-if="flatUsed.length">
          <div class="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 mb-1.5">
            <span class="text-xs font-semibold uppercase tracking-wide text-primary">Used in this template</span>
            <UBadge color="primary" variant="solid" size="xs" class="rounded-full">{{ flatUsed.length }}</UBadge>
          </div>
          <template v-for="group in groupedRows(flatUsed)" :key="'used-' + group.label">
            <div class="text-xs font-semibold uppercase tracking-wide text-dimmed mt-4 mb-1.5 first:mt-0">
              {{ group.label }}
            </div>
            <button
              v-for="tok in group.tokens"
              :key="tok.code"
              type="button"
              class="group w-full flex items-start gap-2 rounded-lg px-2.5 py-2 mb-0.5 text-left hover:bg-elevated"
              :aria-label="readOnly ? `Copy ${tok.name} placeholder` : undefined"
              @click="select(tok.code, $event)"
            >
              <span class="flex flex-col items-start min-w-0 flex-1">
                <span class="text-sm font-semibold text-default">{{ tok.name }}</span>
                <span class="text-xs text-dimmed mt-0.5">{{ tokenLabel(tok.code) }}</span>
                <span v-if="readOnly && SAMPLE_VALUES[tok.code]" class="text-xs text-muted mt-0.5 break-words">Sample: {{ SAMPLE_VALUES[tok.code] }}</span>
              </span>
              <span v-if="readOnly" class="shrink-0 mt-0.5 transition-opacity" :class="isCopied(tok.code) ? 'opacity-100 text-success copy-flash' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 text-primary'" aria-hidden="true">
                <UIcon :name="isCopied(tok.code) ? 'i-lucide-check' : 'i-lucide-copy'" class="size-4" />
              </span>
              <span v-else-if="addedCounts[tok.code]" class="shrink-0 mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-ams-success">
                <UIcon name="i-lucide-check" class="size-4" aria-hidden="true" />
                <span>Added<template v-if="addedCounts[tok.code]! > 1"> {{ addedCounts[tok.code] }} times</template></span>
              </span>
            </button>
          </template>
        </template>

        <template v-if="filter === 'all' && flatUnused.length">
          <div class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-2 mt-4 mb-1.5">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted">Not used in this template</span>
            <UBadge color="neutral" variant="solid" size="xs" class="rounded-full">{{ flatUnused.length }}</UBadge>
          </div>
          <template v-for="group in groupedRows(flatUnused)" :key="'unused-' + group.label">
            <div class="text-xs font-semibold uppercase tracking-wide text-dimmed mt-4 mb-1.5 first:mt-0">
              {{ group.label }}
            </div>
            <button
              v-for="tok in group.tokens"
              :key="tok.code"
              type="button"
              class="group w-full flex items-start gap-2 rounded-lg px-2.5 py-2 mb-0.5 text-left hover:bg-elevated"
              :aria-label="readOnly ? `Copy ${tok.name} placeholder` : undefined"
              @click="select(tok.code, $event)"
            >
              <span class="flex flex-col items-start min-w-0 flex-1">
                <span class="text-sm font-semibold text-default">{{ tok.name }}</span>
                <span class="text-xs text-dimmed mt-0.5">{{ tokenLabel(tok.code) }}</span>
                <span v-if="readOnly && SAMPLE_VALUES[tok.code]" class="text-xs text-muted mt-0.5 break-words">Sample: {{ SAMPLE_VALUES[tok.code] }}</span>
              </span>
              <span v-if="readOnly" class="shrink-0 mt-0.5 transition-opacity" :class="isCopied(tok.code) ? 'opacity-100 text-success copy-flash' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 text-primary'" aria-hidden="true">
                <UIcon :name="isCopied(tok.code) ? 'i-lucide-check' : 'i-lucide-copy'" class="size-4" />
              </span>
              <span v-else-if="addedCounts[tok.code]" class="shrink-0 mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-ams-success">
                <UIcon name="i-lucide-check" class="size-4" aria-hidden="true" />
                <span>Added<template v-if="addedCounts[tok.code]! > 1"> {{ addedCounts[tok.code] }} times</template></span>
              </span>
            </button>
          </template>
        </template>

        <div v-if="!flatUsed.length && !flatUnused.length" class="flex flex-col items-center text-center gap-2 py-12 text-muted">
          <UIcon name="i-lucide-file-x" class="size-6" />
          <div class="text-sm font-medium text-default">No placeholders found</div>
        </div>
      </div>

    </template>
  </USlideover>
</template>
