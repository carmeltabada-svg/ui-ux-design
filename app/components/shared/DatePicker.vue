<script setup lang="ts">
// The one date field for the whole app: Nuxt UI's UInputDate (typed segments)
// with a UCalendar popover, instead of the browser's own date control, which
// looks different in every browser and can't be themed. Values in and out are
// plain 'YYYY-MM-DD' strings ('' when empty), the same shape the old native
// inputs used, so callers don't change how they store dates.
import { CalendarDate, parseDate } from '@internationalized/date'

interface Props {
  modelValue?: string | null
  /** Earliest selectable day, 'YYYY-MM-DD'. */
  min?: string
  /** Latest selectable day, 'YYYY-MM-DD'. */
  max?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), { modelValue: '', size: 'md' })
const emit = defineEmits<{ 'update:modelValue': [value: string], enter: [] }>()

function toCalendar(v?: string | null): CalendarDate | undefined {
  if (!v) return undefined
  try { return parseDate(v) } catch { return undefined }
}

const value = computed<CalendarDate | null>({
  get: () => toCalendar(props.modelValue) ?? null,
  set: v => emit('update:modelValue', v ? v.toString() : '')
})
const minValue = computed(() => toCalendar(props.min))
const maxValue = computed(() => toCalendar(props.max))
const open = ref(false)
const inputDate = useTemplateRef('inputDate')

function pick(v: CalendarDate | null | undefined) {
  value.value = v ?? null
  open.value = false
}
</script>

<template>
  <div class="w-full" @keydown.enter="emit('enter')">
    <UInputDate
      ref="inputDate"
      v-model="value"
      :size="size"
      :disabled="disabled"
      :min-value="minValue"
      :max-value="maxValue"
      :aria-label="ariaLabel"
      class="w-full"
    >
      <template #trailing>
        <UPopover v-model:open="open" :reference="inputDate?.inputsRef?.[3]?.$el">
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            icon="i-lucide-calendar"
            :disabled="disabled"
            aria-label="Open calendar"
            class="px-0"
          />
          <template #content>
            <UCalendar
              :model-value="value ?? undefined"
              :min-value="minValue"
              :max-value="maxValue"
              class="p-2"
              @update:model-value="(v: unknown) => pick(v as CalendarDate | null)"
            />
          </template>
        </UPopover>
      </template>
    </UInputDate>
  </div>
</template>
