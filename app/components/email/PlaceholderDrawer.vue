<script setup lang="ts">
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
}

const props = defineProps<Props>()

const open = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  insert: [string]
}>()

const search = ref('')
const filter = ref<'all' | 'used'>('all')

const usedCount = computed(() => props.usedCodes.length)

const flatUsed = computed(() => {
  const used = new Set(props.usedCodes)
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
  const used = new Set(props.usedCodes)
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

function select(code: string) {
  emit('insert', code)
  open.value = false
}
</script>

<template>
  <USlideover v-model:open="open" :ui="{ content: 'max-w-[440px] m-3 h-[calc(100%-24px)] rounded-lg border border-default overflow-hidden', header: 'p-4 sm:px-6 min-h-16 bg-white', body: 'p-0 sm:p-0 flex flex-col overflow-hidden bg-white' }">
    <template #header="{ close }">
      <div class="flex-1 min-w-0">
        <h2 class="text-base font-semibold text-highlighted">Placeholder Library</h2>
        <p class="mt-0.5">
          <EmailDrawerContextBadge :label="contextLabel" :mode="contextMode" />
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
              class="w-full flex flex-col items-start rounded-lg px-2.5 py-2 mb-0.5 text-left hover:bg-elevated"
              @click="select(tok.code)"
            >
              <span class="text-sm font-semibold text-default">{{ tok.name }}</span>
              <span class="font-mono text-xs text-dimmed mt-0.5">{{ tokenLabel(tok.code) }}</span>
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
              class="w-full flex flex-col items-start rounded-lg px-2.5 py-2 mb-0.5 text-left hover:bg-elevated"
              @click="select(tok.code)"
            >
              <span class="text-sm font-semibold text-default">{{ tok.name }}</span>
              <span class="font-mono text-xs text-dimmed mt-0.5">{{ tokenLabel(tok.code) }}</span>
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
