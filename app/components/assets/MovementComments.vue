<script setup lang="ts">
// Comments on one movement, as in the asset detail design: a count, the first two comments inline with a
// composer under them (text, attachments, emoji), and a side drawer with the full thread where your own
// comments can be deleted. Comments live in the session only (see MOVEMENT_COMMENTS).
import {
  MOVEMENT_COMMENTS, CURRENT_USER, COMMENT_FILE_TYPES, initialsOf, addMovementComment, deleteMovementComment, type CommentAttachment
} from '~/data/assetsDetail'
import { fileSize } from '~/data/assets'

const props = defineProps<{ movementId: string, title: string, num: string, location: string }>()

const PREVIEW_MAX = 2
const comments = computed(() => MOVEMENT_COMMENTS[props.movementId] ?? [])
const preview = computed(() => comments.value.slice(0, PREVIEW_MAX))
const more = computed(() => Math.max(0, comments.value.length - PREVIEW_MAX))
const drawerOpen = ref(false)
// With no comments yet the card shows one quiet line; the composer opens only when you ask for it.
const composing = ref(false)

const draft = ref('')
const pending = ref<File[]>([])
const fileInput = ref<HTMLInputElement>()
const drawerFileInput = ref<HTMLInputElement>()
const emojiOpen = ref(false)
const fileError = ref('')
const EMOJI = ['👍', '👌', '🙏', '🎉', '✅', '❌', '⚠️', '📦', '🚚', '💻', '🔧', '🔒', '📍', '👀', '😊', '😅']

const canSend = computed(() => draft.value.trim().length > 0 || pending.value.length > 0)

function pick(target: 'inline' | 'drawer') {
  ;(target === 'inline' ? fileInput.value : drawerFileInput.value)?.click()
}
function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  fileError.value = ''
  for (const f of Array.from(input.files ?? [])) {
    // The comment attachment limit is 10 MB, the same as the exit documents.
    if (f.size > 10 * 1024 * 1024) { fileError.value = `${f.name} is over 10 MB.`; continue }
    if (!COMMENT_FILE_TYPES.includes(f.type)) { fileError.value = `${f.name} is not a supported file type. Attach an image, PDF, Office file, text or zip.`; continue }
    pending.value.push(f)
  }
  input.value = ''
}
function removePending(i: number) { pending.value.splice(i, 1) }
function send() {
  if (!canSend.value) return
  addMovementComment(props.movementId, draft.value.trim(), pending.value)
  draft.value = ''
  pending.value = []
  emojiOpen.value = false
  composing.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() }
}
function open(att: CommentAttachment) { window.open(att.url, '_blank', 'noopener') }
</script>

<template>
  <div class="flex flex-col gap-3.5 min-w-0 bg-elevated/50 rounded-md p-3.5">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5 text-xs font-semibold text-highlighted">
        <UIcon name="i-lucide-message-square" class="size-3.5 text-dimmed" aria-hidden="true" />
        <span>Comments</span>
        <UBadge color="neutral" variant="subtle" size="sm">{{ comments.length }}</UBadge>
      </div>
      <UButton v-if="comments.length || !composing" color="neutral" variant="ghost" size="xs" icon="i-lucide-plus" label="Add comment" @click="comments.length ? (drawerOpen = true) : (composing = true)" />
    </div>

    <template v-if="comments.length">
      <div v-for="c in preview" :key="c.id" class="flex gap-2">
        <span class="inline-flex items-center justify-center shrink-0 rounded-full size-6 text-xs font-semibold bg-blue-100 text-blue-700 mt-px" aria-hidden="true">{{ c.initials }}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-xs font-medium text-highlighted">{{ c.author }}</span>
            <template v-if="c.mine"><span class="text-xs text-dimmed">You</span><span class="text-xs text-dimmed">·</span></template>
            <span class="text-xs text-dimmed">{{ c.ts }}</span>
          </div>
          <p class="text-xs text-muted line-clamp-2 break-words">{{ c.text }}</p>
          <div v-if="c.attachments.length" class="flex flex-wrap gap-2 mt-2">
            <FileAttachChip v-for="att in c.attachments" :key="att.url" :name="att.name" :subtitle="fileSize(att.size)" :icon="att.isImage ? 'i-lucide-image' : 'i-lucide-file-text'" read-only preview-tooltip="Open file in a new tab" @preview="open(att)" />
          </div>
        </div>
      </div>
      <UButton v-if="more" color="primary" variant="link" size="xs" class="self-start ml-8" :label="`View all ${comments.length} comments`" @click="drawerOpen = true" />
    </template>

    <!-- Composer: shown inline until there is a first comment, after which the drawer is the place to write -->
    <p v-else-if="!composing" class="text-xs text-muted">No comments yet.</p>

    <div v-else class="flex gap-2 items-start">
      <span class="inline-flex items-center justify-center shrink-0 rounded-full size-6 text-xs font-semibold bg-blue-100 text-blue-700 mt-px" aria-hidden="true">{{ initialsOf(CURRENT_USER) }}</span>
      <div class="flex-1 min-w-0 border border-accented rounded-lg overflow-hidden bg-default focus-within:ring-2 focus-within:ring-primary/40">
        <div class="px-3 pt-2.5 pb-1">
          <textarea v-model="draft" rows="2" autofocus aria-label="Add a comment about this movement" placeholder="Write a comment about this movement…" class="w-full resize-none bg-transparent text-sm text-highlighted placeholder:text-dimmed outline-none" @keydown="onKey" />
        </div>
        <div v-if="pending.length" class="flex flex-wrap gap-1.5 px-3 pb-2">
          <FileAttachChip v-for="(f, i) in pending" :key="f.name + i" :name="f.name" :subtitle="fileSize(f.size)" :icon="f.type.startsWith('image/') ? 'i-lucide-image' : 'i-lucide-file-text'" @remove="removePending(i)" />
        </div>
        <p v-if="fileError" class="text-xs text-red-600 px-3 pb-1.5">{{ fileError }}</p>
        <div class="flex items-center justify-between pl-2.5 pr-2 pb-2 pt-1">
          <div class="flex items-center gap-0.5 relative">
            <input ref="fileInput" type="file" multiple aria-label="Attach files to this comment" class="sr-only" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,text/plain,text/csv,application/zip" @change="onFiles">
            <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-paperclip" aria-label="Attach a file" @click="pick('inline')" />
            <UPopover v-model:open="emojiOpen">
              <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-smile" aria-label="Add an emoji" />
              <template #content>
                <div class="grid grid-cols-8 gap-1 p-2">
                  <button v-for="em in EMOJI" :key="em" type="button" class="size-7 rounded hover:bg-elevated text-base" @click="draft += em; emojiOpen = false">{{ em }}</button>
                </div>
              </template>
            </UPopover>
          </div>
          <UButton color="primary" size="xs" square icon="i-lucide-arrow-up" aria-label="Send comment" :disabled="!canSend" @click="send" />
        </div>
      </div>
    </div>

    <USlideover v-model:open="drawerOpen" side="right" :title="`${title} ${num} · Comments`" :description="location" :ui="{ content: 'max-w-md' }">
      <template #body>
        <div class="flex flex-col gap-3.5">
          <div v-for="c in comments" :key="c.id" class="group flex gap-2 relative pr-6 py-1 rounded-md">
            <span class="inline-flex items-center justify-center shrink-0 rounded-full size-6 text-xs font-semibold bg-blue-100 text-blue-700 mt-px" aria-hidden="true">{{ c.initials }}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline gap-1.5 mb-1">
                <span class="text-xs font-medium text-highlighted">{{ c.author }}</span>
                <template v-if="c.mine"><span class="text-xs text-dimmed">You</span><span class="text-xs text-dimmed">·</span></template>
                <span class="text-xs text-dimmed">{{ c.ts }}</span>
              </div>
              <p class="text-xs text-muted break-words">{{ c.text }}</p>
              <div v-if="c.attachments.length" class="flex flex-wrap gap-2 mt-2">
                <FileAttachChip v-for="att in c.attachments" :key="att.url" :name="att.name" :subtitle="fileSize(att.size)" :icon="att.isImage ? 'i-lucide-image' : 'i-lucide-file-text'" read-only preview-tooltip="Open file in a new tab" @preview="open(att)" />
              </div>
            </div>
            <UButton v-if="c.mine" color="error" variant="ghost" size="xs" square icon="i-lucide-trash-2" aria-label="Delete comment" class="absolute top-0 right-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" @click="deleteMovementComment(movementId, c.id)" />
          </div>
          <p v-if="!comments.length" class="text-xs text-dimmed">No comments yet.</p>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 items-start w-full">
          <span class="inline-flex items-center justify-center shrink-0 rounded-full size-6 text-xs font-semibold bg-blue-100 text-blue-700 mt-px" aria-hidden="true">{{ initialsOf(CURRENT_USER) }}</span>
          <div class="flex-1 min-w-0 border border-accented rounded-lg overflow-hidden bg-default focus-within:ring-2 focus-within:ring-primary/40">
            <div class="px-3 pt-2.5 pb-1">
              <textarea v-model="draft" rows="2" aria-label="Add a comment about this movement" placeholder="Add a comment about this movement…" class="w-full resize-none bg-transparent text-sm text-highlighted placeholder:text-dimmed outline-none" @keydown="onKey" />
            </div>
            <div v-if="pending.length" class="flex flex-wrap gap-1.5 px-3 pb-2">
              <FileAttachChip v-for="(f, i) in pending" :key="f.name + i" :name="f.name" :subtitle="fileSize(f.size)" :icon="f.type.startsWith('image/') ? 'i-lucide-image' : 'i-lucide-file-text'" @remove="removePending(i)" />
            </div>
            <p v-if="fileError" class="text-xs text-red-600 px-3 pb-1.5">{{ fileError }}</p>
            <div class="flex items-center justify-between pl-2.5 pr-2 pb-2 pt-1">
              <div class="flex items-center gap-0.5">
                <input ref="drawerFileInput" type="file" multiple aria-label="Attach files to this comment" class="sr-only" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,text/plain,text/csv,application/zip" @change="onFiles">
                <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-paperclip" aria-label="Attach a file" @click="pick('drawer')" />
                <UPopover>
                  <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-smile" aria-label="Add an emoji" />
                  <template #content>
                    <div class="grid grid-cols-8 gap-1 p-2">
                      <button v-for="em in EMOJI" :key="em" type="button" class="size-7 rounded hover:bg-elevated text-base" @click="draft += em">{{ em }}</button>
                    </div>
                  </template>
                </UPopover>
              </div>
              <UButton color="primary" size="xs" square icon="i-lucide-arrow-up" aria-label="Send comment" :disabled="!canSend" @click="send" />
            </div>
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>
