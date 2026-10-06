<script setup lang="ts">
// Master Data > Offboarding Checklists. The Asset Team owns the checklist
// every retrieval ticket is issued at notice (FR-003.6). A template holds the
// tasks, whether each is required or optional, and which reasons and modes it
// is the default for. A ticket gets its own copy when it is created.
import {
  useChecklistTemplates, saveChecklistTemplate, updateChecklistTemplate, duplicateChecklistTemplate, deleteChecklistTemplate,
  type ChecklistTask
} from '~/data/checklistTemplates'
import { MATRIX, REASON_LABELS, type TicketReason } from '~/data/ticketTrackers'

definePageMeta({ layout: 'retrieval' })

useSeoMeta({ title: 'AMS · Offboarding Checklists' })

const toast = useToast()
const templates = useChecklistTemplates()

const selectedId = ref<string>(templates[0]?.id ?? '')
const draft = reactive<{ name: string, tasks: ChecklistTask[], defaultFor: string[] }>({ name: '', tasks: [], defaultFor: [] })
const error = ref('')
const newTaskText = ref('')

const selected = computed(() => templates.find(t => t.id === selectedId.value) ?? null)
function loadDraft() {
  const t = selected.value
  draft.name = t?.name ?? ''
  draft.tasks = (t?.tasks ?? []).map(x => ({ ...x }))
  draft.defaultFor = [...(t?.defaultFor ?? [])]
  error.value = ''
  newTaskText.value = ''
}
watch(selectedId, loadDraft, { immediate: true })

const dirty = computed(() => {
  const t = selected.value
  if (!t) return false
  return draft.name !== t.name
    || JSON.stringify(draft.tasks) !== JSON.stringify(t.tasks)
    || JSON.stringify([...draft.defaultFor].sort()) !== JSON.stringify([...t.defaultFor].sort())
})

/** Every reason and mode a ticket can be created for. Unexplained Absence has no onsite path. */
const pathOptions = (Object.keys(REASON_LABELS) as TicketReason[]).map(reason => ({
  reason,
  label: REASON_LABELS[reason],
  modes: (['onsite', 'remote'] as const).filter(m => !!MATRIX[reason]?.[m])
}))
const pathLabel = (key: string) => {
  if (key === '*') return 'Every other path'
  const [reason, mode] = key.split(':') as [TicketReason, string]
  return `${REASON_LABELS[reason] ?? reason}, ${mode === 'onsite' ? 'Onsite' : 'Remote'}`
}
function togglePath(key: string, on: boolean) {
  draft.defaultFor = on ? [...new Set([...draft.defaultFor, key])] : draft.defaultFor.filter(k => k !== key)
}
/** Which other template currently holds a path, so the page can say saving will take it. */
function ownerOf(key: string) {
  return templates.find(t => t.id !== selectedId.value && t.defaultFor.includes(key))?.name ?? null
}

function addTask() {
  const text = newTaskText.value.trim()
  if (!text) return
  draft.tasks.push({ text, required: true })
  newTaskText.value = ''
}
function moveTask(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= draft.tasks.length) return
  const [t] = draft.tasks.splice(i, 1)
  draft.tasks.splice(j, 0, t!)
}
function save() {
  const res = updateChecklistTemplate(selectedId.value, { name: draft.name, tasks: draft.tasks, defaultFor: draft.defaultFor })
  if (!res.ok) { error.value = res.error; return }
  error.value = ''
  toast.add({ title: 'Template saved', description: 'New tickets use it from now on. Tickets already open keep their own checklist.', icon: 'i-lucide-check', color: 'success' })
}
function createNew() {
  let name = 'New checklist'
  let n = 2
  while (templates.some(t => t.name.toLowerCase() === name.toLowerCase())) name = `New checklist ${n++}`
  const res = saveChecklistTemplate(name, [{ text: 'First task', required: true }])
  if (res.ok) selectedId.value = res.template.id
}
function duplicate() {
  const id = duplicateChecklistTemplate(selectedId.value)
  if (id) selectedId.value = id
}
const deleteOpen = ref(false)
function confirmDelete() {
  const res = deleteChecklistTemplate(selectedId.value)
  deleteOpen.value = false
  if (!res.ok) { toast.add({ title: 'Cannot delete', description: res.error, icon: 'i-lucide-info', color: 'warning' }); return }
  selectedId.value = templates[0]?.id ?? ''
}
</script>

<template>
  <div class="bg-gray-50 min-h-screen">
    <div class="sticky top-16 z-10 bg-white px-6 py-6 border-b border-default">
      <NuxtLink to="/master-data" class="inline-flex items-center gap-1 text-xs font-semibold text-primary mb-2"><UIcon name="i-lucide-arrow-left" class="size-3.5" aria-hidden="true" /> Master Data</NuxtLink>
      <h1 class="text-2xl font-semibold text-highlighted">Offboarding Checklists</h1>
      <p class="text-sm text-muted max-w-[680px] pt-1">
        The checklist every retrieval ticket is issued at notice. Set the tasks, mark each as required or optional, and choose which reasons and modes start from it.
      </p>
    </div>

    <div class="px-6 py-6 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
      <!-- Templates -->
      <section class="rounded-lg border border-default bg-white">
        <div class="flex items-center justify-between px-4 py-3 border-b border-default">
          <h2 class="text-sm font-semibold text-default">Templates</h2>
          <UButton size="xs" color="primary" variant="soft" icon="i-lucide-plus" @click="createNew">New</UButton>
        </div>
        <ul class="divide-y divide-default">
          <li v-for="t in templates" :key="t.id">
            <button
              type="button"
              class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-4"
              :class="t.id === selectedId ? 'border-l-primary bg-primary/5' : 'border-l-transparent'"
              :aria-current="t.id === selectedId"
              @click="selectedId = t.id"
            >
              <div class="text-sm font-medium text-default">{{ t.name }}</div>
              <div class="text-xs text-muted mt-0.5">{{ t.tasks.length }} task{{ t.tasks.length === 1 ? '' : 's' }}<template v-if="t.tasks.some(x => !x.required)"> &middot; {{ t.tasks.filter(x => !x.required).length }} optional</template></div>
              <div v-if="t.defaultFor.length" class="mt-1.5 flex flex-wrap gap-1">
                <span v-for="k in t.defaultFor.slice(0, 2)" :key="k" class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-default">{{ pathLabel(k) }}</span>
                <span v-if="t.defaultFor.length > 2" class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-default">+{{ t.defaultFor.length - 2 }} more</span>
              </div>
            </button>
          </li>
        </ul>
      </section>

      <!-- Editor -->
      <section v-if="selected" class="rounded-lg border border-default bg-white">
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-default">
          <h2 class="text-sm font-semibold text-default">Edit template</h2>
          <div class="flex items-center gap-2">
            <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-copy" @click="duplicate">Duplicate</UButton>
            <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-trash-2" @click="deleteOpen = true">Delete</UButton>
          </div>
        </div>

        <div class="p-5 flex flex-col gap-6">
          <div>
            <label for="tpl-name" class="text-xs font-medium text-default block mb-1.5">Name</label>
            <UInput id="tpl-name" v-model="draft.name" size="md" class="w-full max-w-md" />
          </div>

          <div>
            <div class="text-xs font-medium text-default mb-1.5">Tasks</div>
            <ul class="rounded-lg border border-default divide-y divide-default">
              <li v-for="(task, i) in draft.tasks" :key="i" class="flex items-center gap-2 px-3 py-2">
                <div class="flex flex-col">
                  <button type="button" class="text-muted hover:text-default disabled:opacity-30" :disabled="i === 0" aria-label="Move up" @click="moveTask(i, -1)"><UIcon name="i-lucide-chevron-up" class="size-4" /></button>
                  <button type="button" class="text-muted hover:text-default disabled:opacity-30" :disabled="i === draft.tasks.length - 1" aria-label="Move down" @click="moveTask(i, 1)"><UIcon name="i-lucide-chevron-down" class="size-4" /></button>
                </div>
                <UInput v-model="task.text" size="sm" class="flex-1" :aria-label="`Task ${i + 1}`" />
                <button
                  type="button"
                  class="inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors"
                  :class="task.required ? 'bg-orange-700 text-white hover:bg-orange-800' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'"
                  :aria-label="`${task.required ? 'Required' : 'Optional'}. Switch to ${task.required ? 'optional' : 'required'}`"
                  @click="task.required = !task.required"
                >
                  <UIcon name="i-lucide-repeat" class="size-3" aria-hidden="true" />
                  {{ task.required ? 'Required' : 'Optional' }}
                </button>
                <UButton size="xs" color="neutral" variant="ghost" square icon="i-lucide-trash-2" aria-label="Remove task" @click="draft.tasks.splice(i, 1)" />
              </li>
              <li v-if="!draft.tasks.length" class="px-3 py-3 text-xs text-muted">No tasks yet. Add one below.</li>
            </ul>
            <div class="flex items-center gap-2 mt-2">
              <UInput v-model="newTaskText" size="sm" placeholder="Add a task..." class="flex-1" @keyup.enter="addTask" />
              <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-plus" :disabled="!newTaskText.trim()" @click="addTask">Add</UButton>
            </div>
            <p class="text-xs text-muted mt-1.5">Required tasks must be done before the final review. Optional tasks never block it.</p>
          </div>

          <div>
            <div class="text-xs font-medium text-default mb-1.5">Starts every ticket for</div>
            <div class="rounded-lg border border-default divide-y divide-default">
              <div v-for="opt in pathOptions" :key="opt.reason" class="flex flex-wrap items-center gap-x-6 gap-y-1.5 px-4 py-2.5">
                <span class="w-44 shrink-0 text-sm text-default">{{ opt.label }}</span>
                <label v-for="m in opt.modes" :key="m" class="inline-flex items-center gap-2 text-sm text-default cursor-pointer">
                  <UCheckbox :model-value="draft.defaultFor.includes(`${opt.reason}:${m}`)" @update:model-value="(v) => togglePath(`${opt.reason}:${m}`, !!v)" />
                  {{ m === 'onsite' ? 'Onsite' : 'Remote' }}
                  <span v-if="ownerOf(`${opt.reason}:${m}`) && draft.defaultFor.includes(`${opt.reason}:${m}`)" class="text-xs text-muted">(from {{ ownerOf(`${opt.reason}:${m}`) }})</span>
                </label>
              </div>
              <div class="flex items-center gap-2 px-4 py-2.5">
                <label class="inline-flex items-center gap-2 text-sm text-default cursor-pointer">
                  <UCheckbox :model-value="draft.defaultFor.includes('*')" @update:model-value="(v) => togglePath('*', !!v)" />
                  Every path that has no template of its own
                </label>
              </div>
            </div>
            <p class="text-xs text-muted mt-1.5">A path uses one template. Choosing a path here takes it from the template that had it.</p>
          </div>

          <SharedBanner v-if="error" tone="danger" role="alert" title="This template cannot be saved yet">{{ error }}</SharedBanner>
        </div>

        <div class="flex items-center justify-between gap-3 px-5 py-3 border-t border-default">
          <span class="text-xs text-muted">{{ dirty ? 'You have unsaved changes.' : 'All changes saved.' }} Tickets already open keep their own checklist.</span>
          <div class="flex gap-2">
            <UButton color="neutral" variant="outline" size="sm" :disabled="!dirty" @click="loadDraft">Discard</UButton>
            <UButton color="primary" size="sm" :disabled="!dirty" @click="save">Save changes</UButton>
          </div>
        </div>
      </section>
    </div>

    <UModal v-model:open="deleteOpen" :ui="{ content: 'max-w-md' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex-1">Delete this template?</h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Close" @click="close" />
      </template>
      <template #body>
        <p class="text-sm text-default">"{{ selected?.name }}" is removed. Its paths move to the first remaining template. Tickets that already use it keep their own checklist.</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="deleteOpen = false">Keep it</UButton>
          <UButton color="error" @click="confirmDelete">Delete template</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
