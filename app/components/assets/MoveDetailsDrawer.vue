<script setup lang="ts">
// Move details: what was recorded when a unit was returned to its supplier or pulled out by its client, in a drawer
// over the asset page (the same floating slide-over the retrieval workspace uses for its Activity Log and Placeholder
// Library), so the officer never leaves the asset. Read only, except the replacement unit of a Supplier Return, which
// can be added, swapped or cleared at any time. The rest of an exit is final and is never edited here.
import {
  findAsset, isExited, exitKindOf, badgeDate, openDoc, assetsSimRole, CURRENT_OFFICER,
  replacementOf, replacementGroups, setReplacement, fileSize
} from '~/data/assets'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ tag: string }>()

const router = useRouter()
const toast = useToast()
const LINK = 'text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left'

const asset = computed(() => findAsset(props.tag))
const entry = computed(() => asset.value ? [...asset.value.history].reverse().find(h => exitKindOf(h.status) && h.movement) : undefined)
const isSupplier = computed(() => !!asset.value && exitKindOf(asset.value.status) === 'supplier')
const canEdit = computed(() => assetsSimRole.value === 'officer')

const current = computed(() => asset.value ? replacementOf(asset.value) : '')
const currentUnit = computed(() => current.value ? findAsset(current.value) : undefined)
const options = computed(() => asset.value ? replacementGroups(asset.value.tag) : { supplier: [], similar: [] })

const editing = ref(false)
const draft = ref('')
function startEdit() { draft.value = current.value; editing.value = true }
const changed = computed(() => draft.value !== current.value)
// A closed drawer never reopens halfway through an edit.
watch(open, (v) => { if (!v) editing.value = false })

function save() {
  if (!asset.value) return
  const result = setReplacement(asset.value.tag, draft.value, CURRENT_OFFICER)
  if (!result.ok) {
    toast.add({ title: 'The replacement wasn\'t changed', description: result.reason, icon: 'i-lucide-circle-alert', color: 'error' })
    return
  }
  editing.value = false
  toast.add({
    title: draft.value ? `${draft.value} is the replacement for ${asset.value.tag}` : `The replacement for ${asset.value.tag} was cleared`,
    description: 'Both units show the change in their history.',
    icon: 'i-lucide-circle-check',
    color: 'success'
  })
}

/** Opens a unit's asset page in a new tab, in whichever link style the app is running with. */
function openUnit(t: string) {
  window.open(router.resolve({ path: `/assets/${encodeURIComponent(t)}` }).href, '_blank', 'noopener')
}

const fields = computed<[string, string, string, boolean][]>(() => {
  const e = entry.value
  if (!e) return []
  return [
    ['Date', e.date ? badgeDate(e.date) : '', 'No date recorded', false],
    ['Done by', e.by, 'No name recorded', false],
    ['Movement', e.movement ?? '', 'No movement recorded', false],
    ['Location', e.location ?? '', 'No location recorded', true]
  ]
})
</script>

<template>
  <USlideover
    v-model:open="open"
    side="right"
    inset
    :ui="{ content: 'max-w-[440px] w-[calc(100%-1.5rem)] inset-y-3 right-3 overflow-hidden', header: 'p-4 sm:px-6 min-h-16 bg-card', body: 'p-0 sm:p-0 flex flex-col overflow-hidden bg-card' }"
  >
    <template #header="{ close }">
      <div class="flex items-start gap-3">
        <!-- No tooltip on the close button: a dialog focuses it on open, and a tooltip would show at once. -->
        <UButton
          color="neutral"
          variant="outline"
          size="xs"
          square
          icon="i-lucide-x"
          class="rounded-full shrink-0 mt-0.5"
          aria-label="Close"
          @click="close"
        />
        <div class="min-w-0">
          <h3 class="text-base font-semibold text-highlighted">
            Move details
          </h3>
          <div class="text-xs text-muted mt-0.5 truncate">
            {{ tag }} · What was recorded when this unit left. The move itself is final.
          </div>
        </div>
      </div>
    </template>

    <template #body>
      <div
        v-if="!asset || !isExited(asset) || !entry"
        class="p-6 flex flex-col items-start gap-2 text-sm text-muted"
      >
        <p class="font-medium text-default">
          {{ asset ? `${asset.tag} has no move to show` : `No asset with the tag ${tag}` }}
        </p>
        <p class="text-xs">
          Move details appear once a unit has been returned to its supplier or pulled out by its client.
        </p>
        <UButton
          v-if="asset"
          :to="`/move-asset/${asset.tag}/move`"
          color="neutral"
          variant="outline"
          size="sm"
          label="Move this asset"
        />
      </div>

      <div
        v-else
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain fade-scroll-y px-4 sm:px-6 py-5 space-y-6"
      >
        <!-- The recorded move -->
        <section>
          <p class="text-xs font-semibold uppercase tracking-wide text-dimmed mb-3">
            Move
          </p>
          <dl class="grid grid-cols-2 gap-x-6 gap-y-4">
            <div class="col-span-2">
              <dt class="text-xs font-normal text-muted">
                New status
              </dt>
              <dd class="mt-1">
                <AssetsStatusPill
                  :status="entry.status"
                  :sub="entry.sub"
                  :date="entry.date"
                />
              </dd>
            </div>
            <div
              v-for="[label, value, empty, wide] in fields"
              :key="label"
              :class="wide ? 'col-span-2' : ''"
            >
              <dt class="text-xs font-normal text-muted">
                {{ label }}
              </dt>
              <dd class="text-sm mt-1 break-words">
                <span
                  v-if="value"
                  class="text-highlighted"
                >{{ value }}</span>
                <span
                  v-else
                  class="text-dimmed"
                >{{ empty }}</span>
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="text-xs font-normal text-muted">
                Reason
              </dt>
              <dd class="text-sm mt-1 break-words">
                <span
                  v-if="entry.reason"
                  class="text-highlighted"
                >{{ entry.reason }}</span>
                <span
                  v-else
                  class="text-dimmed"
                >No reason recorded</span>
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="text-xs font-normal text-muted">
                Note
              </dt>
              <dd class="text-sm mt-1 break-words">
                <span
                  v-if="entry.note"
                  class="text-highlighted"
                >{{ entry.note }}</span>
                <span
                  v-else
                  class="text-dimmed"
                >No note recorded</span>
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="text-xs font-normal text-muted mb-1.5">
                {{ isSupplier ? 'Supplier return agreement' : 'Client instruction' }}
              </dt>
              <dd class="text-sm">
                <FileAttachChip
                  v-if="entry.doc"
                  :name="entry.doc.name"
                  :subtitle="fileSize(entry.doc.size)"
                  :icon="entry.doc.type === 'application/pdf' ? 'i-lucide-file-text' : 'i-lucide-image'"
                  preview-tooltip="Open file in a new tab"
                  read-only
                  @preview="openDoc(entry.id, entry.doc)"
                />
                <span
                  v-else
                  class="text-dimmed"
                >No document attached</span>
              </dd>
            </div>
          </dl>
        </section>

        <!-- The replacement, Supplier Return only -->
        <section
          v-if="isSupplier"
          class="border-t border-default pt-5"
        >
          <div class="flex items-center gap-2 mb-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-dimmed">
              Replacement unit from the supplier
            </p>
            <UBadge
              color="neutral"
              variant="outline"
              size="sm"
            >
              Optional
            </UBadge>
          </div>

          <div v-if="!editing">
            <div class="text-sm text-highlighted">
              <div
                v-if="currentUnit"
                class="flex items-center gap-2 flex-wrap"
              >
                <button
                  type="button"
                  :class="[LINK, 'inline-flex items-center gap-1.5']"
                  @click="openUnit(currentUnit.tag)"
                >
                  {{ currentUnit.tag }} · {{ currentUnit.model }}
                  <UIcon
                    name="i-lucide-external-link"
                    class="size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                </button>
                <AssetsStatusPill
                  :status="currentUnit.status"
                  :date="currentUnit.statusDate"
                />
              </div>
              <p
                v-else
                class="text-dimmed"
              >
                Not linked yet
              </p>
            </div>
          </div>

          <div v-else>
            <AssetsReplacementPicker
              id="rep-edit"
              v-model="draft"
              :groups="options"
            />
            <p class="text-xs text-muted mt-1.5">
              Both units show the change in their history. The replacement unit's own status does not change.
            </p>
          </div>

          <div
            v-if="canEdit"
            class="flex gap-2 mt-4"
          >
            <template v-if="!editing">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-pencil"
                :label="current ? 'Edit replacement' : 'Add replacement'"
                @click="startEdit"
              />
            </template>
            <template v-else>
              <UButton
                color="primary"
                size="sm"
                label="Save"
                :disabled="!changed"
                @click="save"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                label="Cancel"
                @click="editing = false"
              />
            </template>
          </div>
        </section>
      </div>
    </template>
  </USlideover>
</template>
