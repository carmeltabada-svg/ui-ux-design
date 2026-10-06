<script setup lang="ts">
interface Props {
  title: string
  subject: string
  body: string
  icon?: string
  showRestore?: boolean
}

withDefaults(defineProps<Props>(), {
  icon: 'i-lucide-mail',
  showRestore: false
})

const emit = defineEmits<{
  restore: []
}>()

const open = defineModel<boolean>({ default: false })
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
      <div class="ticket-email-preview rounded-lg border border-default bg-elevated/50 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div class="shrink-0 font-semibold text-sm px-4 pt-4 pb-3 border-b border-dashed border-default text-default" v-html="subject" />
        <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 text-xs leading-relaxed fade-scroll-y">
          <div class="text-sm leading-relaxed text-default prose-tiptap" v-html="body" />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end w-full">
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
