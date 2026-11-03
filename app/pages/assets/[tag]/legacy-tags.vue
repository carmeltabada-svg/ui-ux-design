<script setup lang="ts">
// Legacy Tags tab, in the asset detail design: a search box, one row per earlier tag with edit and remove,
// a count and a pager. Add, rename and remove work against the session store (see LEGACY_TAGS).
import { LEGACY_TAGS, addLegacyTag, renameLegacyTag, removeLegacyTag, type LegacyTag } from '~/data/assetsDetail'

const route = useRoute()
const toast = useToast()
const tag = computed(() => String(route.params.tag ?? ''))
const all = computed<LegacyTag[]>(() => LEGACY_TAGS[tag.value] ?? [])

const search = ref('')
const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? all.value.filter(t => t.code.toLowerCase().includes(q)) : all.value
})

const PAGE = 10
const page = ref(1)
const pages = computed(() => Math.max(1, Math.ceil(rows.value.length / PAGE)))
watch([search, () => rows.value.length], () => { if (page.value > pages.value) page.value = pages.value })
const shown = computed(() => rows.value.slice((page.value - 1) * PAGE, page.value * PAGE))

// Add or rename: one modal, with the code checked for blanks and duplicates before it saves.
const editing = ref<LegacyTag | null>(null)
const modalOpen = ref(false)
const code = ref('')
const error = ref('')
function openAdd() { editing.value = null; code.value = ''; error.value = ''; modalOpen.value = true }
function openEdit(t: LegacyTag) { editing.value = t; code.value = t.code; error.value = ''; modalOpen.value = true }
function save() {
  const value = code.value.trim()
  if (!value) { error.value = 'Enter the legacy tag.'; return }
  if (all.value.some(t => t.code.toLowerCase() === value.toLowerCase() && t.id !== editing.value?.id)) { error.value = 'This asset already has that legacy tag.'; return }
  if (editing.value) renameLegacyTag(tag.value, editing.value.id, value)
  else addLegacyTag(tag.value, value)
  modalOpen.value = false
  toast.add({ title: editing.value ? 'Legacy tag updated' : 'Legacy tag added', icon: 'i-lucide-circle-check', color: 'success' })
}

const removing = ref<LegacyTag | null>(null)
const removeOpen = computed({ get: () => !!removing.value, set: (v) => { if (!v) removing.value = null } })
function confirmRemove() {
  if (!removing.value) return
  removeLegacyTag(tag.value, removing.value.id)
  toast.add({ title: 'Legacy tag removed', icon: 'i-lucide-trash-2', color: 'success' })
  removing.value = null
}
</script>

<template>
  <div class="stage-enter">
    <div class="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">Legacy Tags</h2>
        <p class="text-sm text-muted mt-1">View and manage legacy tags for this asset</p>
      </div>
      <UButton color="neutral" variant="outline" size="md" icon="i-lucide-plus" label="Add Legacy Tag" class="bg-card" @click="openAdd" />
    </div>

    <div class="rounded-md ring-1 ring-inset ring-default bg-card overflow-hidden">
      <div class="px-6 py-3.5">
        <UInput v-model="search" icon="i-lucide-search" aria-label="Search legacy tags" placeholder="Search legacy tags" size="md" class="w-full sm:max-w-[15rem]" />
      </div>
      <div class="px-6 pb-5 flex flex-col gap-2.5">
        <div v-for="t in shown" :key="t.id" class="rounded-lg border border-default bg-card p-4 flex flex-col gap-0.5">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="inline-flex items-center justify-center size-8 rounded-full bg-yellow-100 text-yellow-600 shrink-0" aria-hidden="true"><UIcon name="i-lucide-tag" class="size-4.5" /></span>
              <span class="text-sm font-medium text-default break-all">{{ t.code }}</span>
            </div>
            <div class="flex items-center gap-2.5">
              <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-pencil" aria-label="Edit legacy tag" @click="openEdit(t)" />
              <UButton color="error" variant="ghost" size="xs" square icon="i-lucide-trash-2" aria-label="Remove legacy tag" @click="removing = t" />
            </div>
          </div>
          <p class="pl-[42px] text-xs text-muted">Added on {{ t.added }}</p>
        </div>
        <p v-if="!rows.length" class="py-8 text-center text-xs text-muted">{{ all.length ? 'No legacy tags match your search.' : 'No legacy tags yet. This asset has kept its original tag.' }}</p>
      </div>
      <div class="flex items-center justify-between gap-3 px-4 py-3.5 border-t border-default">
        <span class="text-sm text-muted">{{ rows.length }} tag(s)</span>
        <div class="flex items-center gap-1">
          <UButton color="neutral" variant="outline" size="xs" square icon="i-lucide-chevrons-left" aria-label="First page" :disabled="page <= 1" @click="page = 1" />
          <UButton color="neutral" variant="outline" size="xs" square icon="i-lucide-chevron-left" aria-label="Previous page" :disabled="page <= 1" @click="page--" />
          <span class="text-xs text-muted px-1.5">Page {{ page }} of {{ pages }}</span>
          <UButton color="neutral" variant="outline" size="xs" square icon="i-lucide-chevron-right" aria-label="Next page" :disabled="page >= pages" @click="page++" />
          <UButton color="neutral" variant="outline" size="xs" square icon="i-lucide-chevrons-right" aria-label="Last page" :disabled="page >= pages" @click="page = pages" />
        </div>
      </div>
    </div>

    <UModal v-model:open="modalOpen" :title="editing ? 'Edit legacy tag' : 'Add legacy tag'" description="The tag this asset carried before it was retagged." :ui="{ content: 'max-w-md' }">
      <template #body>
        <label for="legacy-code" class="text-xs font-normal text-default block mb-2">Legacy tag <span class="text-red-600">*</span></label>
        <UInput id="legacy-code" v-model="code" placeholder="e.g. HP-LTP-0098" class="w-full" :color="error ? 'error' : undefined" autofocus @keydown.enter.prevent="save" @update:model-value="error = ''" />
        <p v-if="error" class="text-xs text-red-600 mt-1" role="alert">{{ error }}</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" size="sm" label="Cancel" @click="modalOpen = false" />
          <UButton color="primary" size="sm" :label="editing ? 'Save' : 'Add tag'" @click="save" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="removeOpen" title="Remove this legacy tag?" :description="removing ? `${removing.code} will no longer be listed on this asset.` : ''" :ui="{ content: 'max-w-md' }">
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" size="sm" label="Keep it" @click="removing = null" />
          <UButton color="error" size="sm" label="Remove tag" @click="confirmRemove" />
        </div>
      </template>
    </UModal>
  </div>
</template>
