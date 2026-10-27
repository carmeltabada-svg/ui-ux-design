<script setup lang="ts">
interface Props {
  title: string
  subject: string
  body: string
  icon?: string
  showRestore?: boolean
  /** Show a Copy button that puts the rendered subject + body on the clipboard. */
  copyable?: boolean
  /** When set, show an Edit button that opens this address (the template editor) in a new tab. */
  editHref?: string
  /** Show a "Download EML" button (a fallback for when in-system sending fails). Emits `download`. */
  downloadable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'i-lucide-mail',
  showRestore: false,
  copyable: false,
  editHref: '',
  downloadable: false
})

const emit = defineEmits<{
  restore: []
  download: []
}>()

const open = defineModel<boolean>({ default: false })

// The rendered subject/body are HTML (highlighted token spans). Copy the
// visible text the recipient would read, not the markup - innerText off the
// two rendered nodes gives exactly that, resolved values included.
const subjectEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)
const copyFlash = useCopyFlash()
async function copyEmail() {
  const subjectText = subjectEl.value?.innerText?.trim() ?? ''
  const bodyText = bodyEl.value?.innerText?.trim() ?? ''
  const text = subjectText ? `${subjectText}\n\n${bodyText}` : bodyText
  await copyFlash.copy('email', text)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{
      content: 'max-w-[720px] divide-y-0 max-h-[85vh] flex flex-col',
      header: 'p-6 sm:p-6 shrink-0',
      body: 'p-6 sm:p-6 pt-[10px] sm:pt-[10px] flex flex-col min-h-0',
      footer: 'p-6 sm:p-6 shrink-0'
    }"
  >
    <template #header="{ close }">
      <h2 class="text-base font-semibold text-highlighted flex items-center gap-2 flex-1 min-w-0">
        <UIcon :name="icon" class="text-primary size-5" />
        {{ title }}
      </h2>
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
      <div class="ticket-email-preview rounded-lg border border-default bg-muted flex flex-col flex-1 min-h-0 overflow-hidden">
        <div ref="subjectEl" class="shrink-0 font-semibold text-sm px-4 pt-4 pb-3 border-b border-dashed border-default text-default" v-html="subject" />
        <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 text-xs leading-relaxed fade-scroll-y">
          <div ref="bodyEl" class="text-sm leading-relaxed text-default prose-tiptap" v-html="body" />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center gap-2 w-full">
        <!-- Secondary actions sit on the left so the close/restore primary
             stays anchored at the end where it was. -->
        <UButton
          v-if="copyable"
          :color="copyFlash.isCopied('email') ? 'success' : 'primary'"
          variant="outline"
          size="md"
          :icon="copyFlash.icon('email')"
          @click="copyEmail"
        >
          {{ copyFlash.label('email') }}
        </UButton>
        <UButton
          v-if="editHref"
          color="neutral"
          variant="outline"
          size="md"
          icon="i-lucide-pencil"
          :to="editHref"
          target="_blank"
          rel="noopener"
        >
          Edit
        </UButton>
        <UTooltip
          v-if="downloadable"
          text="Download this email as an .eml file to send from your own mail client, in case in-system sending is unavailable."
          :ui="{ content: 'max-w-xs whitespace-normal text-center' }"
        >
          <UButton color="neutral" variant="outline" size="md" icon="i-lucide-download" @click="emit('download')">
            Download EML
          </UButton>
        </UTooltip>

        <div class="flex-1" />

        <UButton
          v-if="showRestore"
          color="primary"
          variant="solid"
          size="md"
          icon="i-lucide-rotate-ccw"
          @click="emit('restore')"
        >
          Restore this version
        </UButton>
        <UButton v-else color="neutral" variant="outline" size="md" @click="open = false">
          Close
        </UButton>
      </div>
    </template>
  </UModal>
</template>
