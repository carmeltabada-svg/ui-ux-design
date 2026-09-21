<script setup lang="ts">
// A real signature - drawn by hand or uploaded as a transparent-background
// image - instead of the earlier "type your name in cursive" placeholder.
// Ephemeral local state only (no backend to persist to, matching every
// other field in this document).
interface Props {
  disabled?: boolean
}
const props = defineProps<Props>()

const hasContent = defineModel<boolean>('hasContent', { default: false })
// The signature's own real image data - read by FormFieldNodeView.vue's
// registry write so the print/PDF path (~/utils/formFieldStaticRender.ts)
// can show the actual drawn/uploaded signature, not just know one exists.
// Refreshed explicitly after each content-changing action (endDraw, clear,
// upload, remove, mode switch) rather than via a reactive watch of
// `hasDrawn`/`uploadedSrc` alone - `hasDrawn` flips true once on the first
// stroke and stays true for every stroke after, so a watch keyed off it
// would only ever capture the first stroke's pixels, not the final drawing.
const dataUrl = defineModel<string>('dataUrl', { default: '' })
function refreshDataUrl() {
  if (mode.value === 'upload') {
    dataUrl.value = uploadedSrc.value
    return
  }
  dataUrl.value = hasDrawn.value ? (canvas.value?.toDataURL('image/png') ?? '') : ''
}
const mode = ref<'draw' | 'upload'>('draw')
const uploadedSrc = ref('')
const fileInput = ref<HTMLInputElement>()
const canvasWrap = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const hasDrawn = ref(false)
let drawing = false
let lastX = 0
let lastY = 0
let resizeObserver: ResizeObserver | undefined

// The canvas's backing bitmap must match its rendered CSS size 1:1, or the
// stroke lands somewhere other than the cursor - a fixed `width`/`height`
// attribute combined with a fluid `w-full` CSS width stretches whatever gets
// drawn at the bitmap's own resolution, so the on-screen stroke drifts away
// from the pointer the wider the canvas renders. Sizing the bitmap to the
// element's actual rendered box (times devicePixelRatio, for crispness)
// keeps drawing-space and screen-space the same.
function syncCanvasSize() {
  const el = canvas.value
  const wrap = canvasWrap.value
  if (!el || !wrap) return
  const rect = wrap.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const prev = hasDrawn.value ? el.toDataURL() : null
  el.width = Math.max(1, Math.round(rect.width * dpr))
  el.height = Math.max(1, Math.round(72 * dpr))
  const ctx = el.getContext('2d')
  if (ctx) ctx.scale(dpr, dpr)
  if (prev && ctx) {
    const img = new Image()
    img.onload = () => ctx.drawImage(img, 0, 0, rect.width, 72)
    img.src = prev
  }
}

onMounted(() => {
  syncCanvasSize()
  resizeObserver = new ResizeObserver(() => syncCanvasSize())
  if (canvasWrap.value) resizeObserver.observe(canvasWrap.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())

function canvasPoint(e: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function startDraw(e: PointerEvent) {
  if (props.disabled) return
  const el = canvas.value
  if (!el) return
  drawing = true
  hasDrawn.value = true
  const p = canvasPoint(e)
  lastX = p.x
  lastY = p.y
  el.setPointerCapture(e.pointerId)
}

function moveDraw(e: PointerEvent) {
  if (!drawing) return
  const el = canvas.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return
  const p = canvasPoint(e)
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  lastX = p.x
  lastY = p.y
}

function endDraw() {
  if (drawing) refreshDataUrl()
  drawing = false
}

function clearDraw() {
  const el = canvas.value
  if (!el) return
  const ctx = el.getContext('2d')
  ctx?.clearRect(0, 0, el.width, el.height)
  hasDrawn.value = false
  refreshDataUrl()
}

function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { uploadedSrc.value = String(reader.result); refreshDataUrl() }
  reader.readAsDataURL(file)
}

function removeUpload() {
  uploadedSrc.value = ''
  if (fileInput.value) fileInput.value.value = ''
  refreshDataUrl()
}

function switchMode(next: 'draw' | 'upload') {
  mode.value = next
  refreshDataUrl()
}

watch([hasDrawn, uploadedSrc, mode], () => {
  hasContent.value = mode.value === 'draw' ? hasDrawn.value : !!uploadedSrc.value
}, { immediate: true })
</script>

<template>
  <div class="w-full" @click.stop>
    <div class="flex items-center justify-between mb-1.5 no-print">
      <div class="inline-flex rounded-md border border-[#D1D5DB] p-0.5 bg-[#F9FAFB] gap-0.5">
        <UButton
          type="button"
          size="xs"
          :color="mode === 'draw' ? 'primary' : 'neutral'"
          :variant="mode === 'draw' ? 'solid' : 'ghost'"
          class="text-[10px] uppercase tracking-wide px-2 py-0.5"
          :disabled="disabled"
          @click="switchMode('draw')"
        >
          Draw
        </UButton>
        <UButton
          type="button"
          size="xs"
          :color="mode === 'upload' ? 'primary' : 'neutral'"
          :variant="mode === 'upload' ? 'solid' : 'ghost'"
          class="text-[10px] uppercase tracking-wide px-2 py-0.5"
          :disabled="disabled"
          @click="switchMode('upload')"
        >
          Upload
        </UButton>
      </div>

      <UButton
        v-if="mode === 'draw' && hasDrawn"
        type="button"
        size="xs"
        color="primary"
        variant="link"
        class="text-[10px] p-0"
        :disabled="disabled"
        @click="clearDraw"
      >
        Clear
      </UButton>
      <UButton
        v-else-if="mode === 'upload' && uploadedSrc"
        type="button"
        size="xs"
        color="primary"
        variant="link"
        class="text-[10px] p-0"
        :disabled="disabled"
        @click="removeUpload"
      >
        Remove
      </UButton>
    </div>

    <div v-if="mode === 'draw'" ref="canvasWrap" class="relative">
      <canvas
        ref="canvas"
        class="w-full h-[72px] border-0 border-b border-[#9CA3AF] bg-transparent touch-none"
        :class="disabled ? 'cursor-not-allowed' : 'cursor-crosshair'"
        @pointerdown="startDraw"
        @pointermove="moveDraw"
        @pointerup="endDraw"
        @pointerleave="endDraw"
      />
      <span v-if="!hasDrawn" class="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] italic text-[#9CA3AF]">
        Place your signature here
      </span>
    </div>

    <div v-else class="border-0 border-b border-[#9CA3AF]">
      <input ref="fileInput" type="file" accept="image/png,image/webp,image/*" class="hidden" :disabled="disabled" @change="onFilePicked">
      <UButton
        v-if="!uploadedSrc"
        type="button"
        variant="ghost"
        color="neutral"
        block
        class="h-[72px] flex-col gap-1 text-[#9CA3AF] hover:text-[#6B7280]"
        icon="i-lucide-upload"
        :disabled="disabled"
        @click="fileInput?.click()"
      >
        <span class="text-[11px] italic normal-case">Upload a transparent signature image</span>
      </UButton>
      <div v-else class="h-[72px] flex items-center px-2" style="background-image: linear-gradient(45deg, #F3F4F6 25%, transparent 25%), linear-gradient(-45deg, #F3F4F6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #F3F4F6 75%), linear-gradient(-45deg, transparent 75%, #F3F4F6 75%); background-size: 12px 12px; background-position: 0 0, 0 6px, 6px -6px, -6px 0;">
        <img :src="uploadedSrc" alt="Uploaded signature" class="max-h-16 max-w-full object-contain">
      </div>
    </div>
  </div>
</template>
