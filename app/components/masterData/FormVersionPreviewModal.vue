<script setup lang="ts">
// Same shell/behavior as the email template's FullPreviewModal (fixed max
// height, scrollable body, Restore-instead-of-Close footer) - just rendering
// a form's sections/fields instead of an email subject/body.
import type { FormSection } from '~/data/retrievalForms'

interface Props {
  title: string
  name: string
  themeColor: string
  sections: FormSection[]
  showRestore?: boolean
}

withDefaults(defineProps<Props>(), {
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
        <UIcon name="i-lucide-history" class="text-primary size-5" />
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
      <div class="rounded-lg border border-default bg-elevated/50 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div class="shrink-0 font-semibold text-sm px-4 pt-4 pb-3 border-b border-dashed border-default text-default">
          {{ name }}
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 fade-scroll-y">
          <table v-for="section in sections" :key="section.id" class="w-full border-collapse mb-4 text-sm">
            <thead>
              <tr>
                <th
                  colspan="2"
                  class="text-left text-white text-xs font-bold uppercase tracking-wide px-3 py-2"
                  :style="{ background: section.color || themeColor }"
                >
                  {{ section.title }}
                </th>
              </tr>
            </thead>
            <tbody>
              <MasterDataFormDocumentField v-for="field in section.fields" :key="field.id" :field="field" />
            </tbody>
          </table>
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
