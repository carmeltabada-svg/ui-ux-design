<script setup lang="ts">
import { wrapTokens, SAMPLE_VALUES } from '~/data/templates'

interface Props {
  subject: string
  body: string
  /** Solid color behind the rendered email card - matches what
   * buildEmailExportHtml stamps onto the actual copy/EML export, so this
   * preview shows the same canvas color a real recipient would see. */
  background?: string
  /** Small print below the white card, on the same background - see
   * TemplateRuntime's `footerNote` field. */
  footerNote?: string
}

const props = defineProps<Props>()

const { onTokenClick } = useTokenHighlight()

const subjectHtml = computed(() => wrapTokens(props.subject, SAMPLE_VALUES))
const bodyHtml = computed(() => wrapTokens(props.body, SAMPLE_VALUES))
</script>

<template>
  <div class="flex flex-col overflow-hidden bg-card lg:w-[min(460px,40%)] lg:min-w-60 rounded-lg border border-default">
    <div class="flex items-center justify-between min-h-[68px] px-5 py-2.5 border-b border-default shrink-0 sticky top-0 bg-card z-[1]">
      <span class="text-xs font-semibold uppercase tracking-wide text-dimmed">Sample preview</span>
    </div>

    <div class="flex-1 overflow-y-auto p-6 flex flex-col fade-scroll-y" data-pane="preview" @click="onTokenClick">
      <div
        v-if="!subject.trim() && !body.trim()"
        class="flex-1 flex flex-col items-center justify-center text-center gap-2 rounded-lg border border-dashed border-default p-4 text-muted"
      >
        <UIcon name="i-lucide-mail-open" class="size-6" />
        <div class="text-sm font-medium text-default">Nothing to preview yet</div>
        <div class="text-xs max-w-[220px]">Write a subject line and body to see how this email will look.</div>
      </div>
      <div
        v-else
        class="flex-1 flex flex-col rounded-lg border border-default p-4"
        :style="background ? { background } : undefined"
        :class="background ? '' : 'bg-elevated/50'"
      >
        <div class="rounded-lg bg-card p-4 text-xs leading-relaxed" :class="background ? 'shadow-sm' : ''">
          <div class="font-semibold text-sm pb-3 mb-3 border-b border-dashed border-default text-default" v-html="subjectHtml" />
          <div class="flex-1 text-sm leading-relaxed text-default prose-tiptap" v-html="bodyHtml" />
        </div>
        <p v-if="footerNote?.trim()" class="text-center text-[11px] leading-relaxed text-dimmed pt-3 px-2">
          {{ footerNote }}
        </p>
      </div>
    </div>
  </div>
</template>
