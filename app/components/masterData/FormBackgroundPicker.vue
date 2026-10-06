<script setup lang="ts">
// Solid + gradient color picking now goes through vue3-colorpicker instead
// of the hand-rolled solid-only UColorPicker - it natively supports a
// gradient editor (drag stops, angle wheel, per-stop alpha) that a custom
// build would've had to reinvent. Image upload stays hand-built (a file
// input + FileReader data URL, or a pasted URL) since the library doesn't
// cover that; recommended type/resolution guidance is shown next to it.
//
// Loaded via a client-only defineAsyncComponent (not a plain top-level
// import) because the package references `HTMLElement` at module scope (for
// a prop's runtime type validation) - evaluating that module during Nuxt's
// Node-based SSR pass throws "HTMLElement is not defined" even though this
// component only ever renders inside a client-side popover. A static import
// gets evaluated as soon as this SFC's module loads, SSR included; wrapping
// it in an async loader defers evaluation until something actually mounts
// it, and this component's own usage site wraps it in <ClientOnly> too, so
// that never happens on the server.
import 'vue3-colorpicker/style.css'
import { BACKGROUND_SWATCHES, type FormBackground } from '~/data/retrievalForms'

const ColorPicker = defineAsyncComponent(() => import('vue3-colorpicker').then(m => m.ColorPicker))

const background = defineModel<FormBackground | undefined>()

const tab = ref<'solid' | 'gradient' | 'image'>(background.value?.type ?? 'solid')
const solidColor = ref(background.value?.type === 'solid' ? background.value.value : '#FFFFFF')
// vue3-colorpicker's gradient value is a full `linear-gradient(...)` CSS
// string already, so it can be written straight into FormBackground.value
// with no translation.
const gradientColor = ref(background.value?.type === 'gradient' ? background.value.value : BACKGROUND_SWATCHES.find(s => s.type === 'gradient')!.value)
const imageUrl = ref(background.value?.type === 'image' ? background.value.value : '')

function onSolidChange(c: string) {
  solidColor.value = c
  if (tab.value === 'solid') background.value = { type: 'solid', value: c }
}

function onGradientChange(g: string) {
  gradientColor.value = g
  if (tab.value === 'gradient') background.value = { type: 'gradient', value: g }
}

function applySwatch(sw: { type: 'solid' | 'gradient', value: string }) {
  if (sw.type === 'solid') {
    solidColor.value = sw.value
    background.value = { type: 'solid', value: sw.value }
  } else {
    gradientColor.value = sw.value
    background.value = { type: 'gradient', value: sw.value }
  }
}

function selectTab(t: 'solid' | 'gradient' | 'image') {
  tab.value = t
  if (t === 'solid') background.value = { type: 'solid', value: solidColor.value }
  else if (t === 'gradient') background.value = { type: 'gradient', value: gradientColor.value }
}

function applyImageUrl() {
  if (!imageUrl.value.trim()) return
  background.value = { type: 'image', value: imageUrl.value.trim() }
}

const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const toast = useToast()

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > IMAGE_MAX_BYTES) {
    toast.add({ title: 'Image too large', description: 'Please use a file under 5 MB.', icon: 'i-lucide-triangle-alert', color: 'warning' })
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    background.value = { type: 'image', value: reader.result as string }
  }
  reader.readAsDataURL(file)
}

function reset() {
  background.value = undefined
  tab.value = 'solid'
  solidColor.value = '#FFFFFF'
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex gap-1">
      <UButton
        v-for="t in (['solid', 'gradient', 'image'] as const)"
        :key="t"
        :color="tab === t ? 'primary' : 'neutral'"
        :variant="tab === t ? 'subtle' : 'ghost'"
        size="xs"
        class="capitalize flex-1"
        @click="selectTab(t)"
      >
        {{ t }}
      </UButton>
    </div>

    <div v-if="tab === 'solid'" class="space-y-2">
      <div class="grid grid-cols-6 gap-1.5">
        <button
          v-for="sw in BACKGROUND_SWATCHES.filter(s => s.type === 'solid')"
          :key="sw.value"
          type="button"
          class="size-7 rounded ring-1 ring-default"
          :style="{ background: sw.value }"
          :aria-label="`Set background ${sw.value}`"
          @click="applySwatch(sw)"
        />
      </div>
      <ColorPicker
        is-widget
        picker-type="chrome"
        format="hex"
        lang="En"
        :pure-color="solidColor"
        @update:pure-color="onSolidChange"
      />
    </div>

    <div v-else-if="tab === 'gradient'" class="space-y-2">
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="sw in BACKGROUND_SWATCHES.filter(s => s.type === 'gradient')"
          :key="sw.value"
          type="button"
          class="h-10 rounded-md ring-1 ring-default transition-transform hover:scale-105"
          :style="{ backgroundImage: sw.value }"
          aria-label="Set gradient background"
          @click="applySwatch(sw)"
        />
      </div>
      <ColorPicker
        is-widget
        picker-type="chrome"
        use-type="gradient"
        format="hex"
        lang="En"
        :gradient-color="gradientColor"
        @update:gradient-color="onGradientChange"
      />
    </div>

    <div v-else class="space-y-2">
      <UInput v-model="imageUrl" placeholder="Paste an image URL" size="sm" class="w-full" @keyup.enter="applyImageUrl" />
      <UButton size="xs" color="neutral" variant="outline" block @click="applyImageUrl">
        Use URL
      </UButton>
      <label class="block">
        <span class="text-xs text-dimmed">or upload a file</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" class="block w-full text-xs mt-1" @change="onFileChange">
        <span class="block text-[11px] text-dimmed mt-1">PNG, JPG, or WebP. Recommended at least 1600×1200px, under 5 MB.</span>
      </label>
    </div>

    <UButton v-if="background" size="xs" color="neutral" variant="ghost" block icon="i-lucide-rotate-ccw" @click="reset">
      Reset to white
    </UButton>
  </div>
</template>
