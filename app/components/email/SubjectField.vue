<script setup lang="ts">
import { wrapTokens } from '~/data/templates'

interface Props {
  modelValue: string
  editing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editing: false
})

defineEmits<{ 'update:modelValue': [string]; focus: [] }>()

const { onTokenClick } = useTokenHighlight()

const html = computed(() => wrapTokens(props.modelValue))
</script>

<template>
  <div>
    <EmailFieldLabel label="Subject line" class="pt-[10px]" />
    <UInput
      v-if="editing"
      :model-value="modelValue"
      size="lg"
      placeholder="Write a subject line..."
      class="w-full font-semibold mb-1"
      @update:model-value="$emit('update:modelValue', String($event))"
      @focus="$emit('focus')"
    />
    <div
      v-else-if="modelValue"
      class="text-base font-semibold text-default pb-1 leading-relaxed"
      data-pane="editor"
      v-html="html"
      @click="onTokenClick"
    />
    <div v-else class="text-base font-semibold text-dimmed pb-1 leading-relaxed">
      Write a subject line...
    </div>
  </div>
</template>
