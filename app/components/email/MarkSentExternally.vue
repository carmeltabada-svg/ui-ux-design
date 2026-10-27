<script setup lang="ts">
// A secondary "I sent this myself, outside the system" confirmation that sits
// under a stage's primary Send button. For the real-world case where the
// operator sends the email from their own client (e.g. Outlook) rather than
// through the app - they click this to record the send and move the ticket on.
// variant picks its rank: 'outline' = secondary (beside the primary on a
// single-action step), 'ghost' = tertiary (a quieter fallback on a step that
// already has a primary + secondary, e.g. the reminder's Send + Skip).
withDefaults(defineProps<{ loading?: boolean, variant?: 'outline' | 'ghost' }>(), { variant: 'outline' })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <UTooltip
    text="Use this if you sent this email yourself, from outside the system (e.g. your own Outlook). It records the send and moves the ticket on, without the system sending anything."
    :ui="{ content: 'max-w-xs whitespace-normal text-center' }"
  >
    <UButton
      color="neutral"
      :variant="variant"
      size="sm"
      icon="i-lucide-mail-check"
      :class="variant === 'ghost' ? 'ps-0' : ''"
      :loading="loading"
      @click="emit('confirm')"
    >
      Mark as sent outside the system
    </UButton>
  </UTooltip>
</template>
