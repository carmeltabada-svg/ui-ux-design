<script setup lang="ts">
// A read-only counterpart to RecipientsSection.vue (the Templates email
// editor's own To/CC/BCC grouping) - same visual language (label row, "To"/
// "CC"/"BCC" chips, the locked itasset@go.team pill), but for a moment
// where the operator is sending, not authoring: nothing here is added or
// removed, so there's no picker, no remove buttons, just the resolved list.
interface Recipient {
  email: string
  locked?: boolean
}

interface Props {
  to: string
  cc: Recipient[]
  bcc: Recipient[]
}

defineProps<Props>()
</script>

<template>
  <div>
    <label class="text-xs font-normal text-default block mb-2">
      Recipients
      <span class="font-normal text-dimmed">· Sent by Asset Management</span>
    </label>

    <div class="flex items-center gap-2.5 py-1">
      <span class="text-xs font-normal text-default min-w-10 shrink-0">To</span>
      <span class="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 bg-primary/10 text-primary truncate max-w-full">{{ to }}</span>
    </div>

    <div class="flex items-start gap-2.5 py-1">
      <span class="text-xs font-normal text-default min-w-10 pt-1.5 shrink-0">CC</span>
      <div v-if="cc.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="r in cc"
          :key="r.email"
          class="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5"
          :class="r.locked ? 'bg-elevated' : 'bg-primary/10 text-primary'"
        >
          <UIcon v-if="r.locked" name="i-lucide-lock" class="size-2.5 text-dimmed shrink-0" />
          {{ r.email }}
        </span>
      </div>
      <span v-else class="text-xs text-dimmed pt-1.5">None</span>
    </div>

    <div class="flex items-start gap-2.5 py-1">
      <span class="text-xs font-normal text-default min-w-10 pt-1.5 shrink-0">BCC</span>
      <div v-if="bcc.length" class="flex flex-wrap gap-1.5">
        <span v-for="r in bcc" :key="r.email" class="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 bg-primary/10 text-primary">
          {{ r.email }}
        </span>
      </div>
      <span v-else class="text-xs text-dimmed pt-1.5">None</span>
    </div>
  </div>
</template>
