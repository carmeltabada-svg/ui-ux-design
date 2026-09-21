<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

interface Props {
  editor?: Editor
  /** Trims the toolbar to just the essentials (bold/italic/underline, align,
   * lists) - for small, single-block static text fields where the full
   * email-composer toolbar (font size, colors, tables, banners, callouts...)
   * is more chrome than content, the same decluttering most editors apply
   * to an inline/contextual toolbar vs. a full document one. */
  compact?: boolean
  /** Drops the toolbar's own border/rounded-top styling, for a host that
   * docks this flush against something else (e.g. the form document
   * canvas's page header) instead of floating it as its own bordered card
   * above an `EditorContent` block. */
  flush?: boolean
}

const props = defineProps<Props>()

// re-render toolbar active-state on every editor transaction
const tick = ref(0)
function forceUpdate() {
  tick.value++
}

onMounted(() => {
  props.editor?.on('transaction', forceUpdate)
  props.editor?.on('selectionUpdate', forceUpdate)
})
onBeforeUnmount(() => {
  props.editor?.off('transaction', forceUpdate)
  props.editor?.off('selectionUpdate', forceUpdate)
})

function isActive(name: string, attrs?: Record<string, unknown>) {
  tick.value
  return props.editor?.isActive(name, attrs) ?? false
}

const fontSizeItems = [
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '14px' },
  { label: 'Large', value: '18px' },
  { label: 'Heading', value: 'heading' }
]

const fontSizePopoverOpen = ref(false)

const fontSize = computed({
  get: () => {
    tick.value
    if (!props.editor) return '14px'
    if (props.editor.isActive('heading', { level: 2 })) return 'heading'
    return (props.editor.getAttributes('textStyle').fontSize as string) || '14px'
  },
  set: (value: string) => {
    if (!props.editor) return
    if (value === 'heading') {
      props.editor.chain().focus().setHeading({ level: 2 }).run()
    } else {
      if (props.editor.isActive('heading')) props.editor.chain().focus().setParagraph().run()
      props.editor.chain().focus().setFontSize(value).run()
    }
  }
})

// Every value here needs to stay readable as body text on a white page, so
// each one is picked to clear WCAG 2.2's 4.5:1 AA contrast ratio against
// white (#ffffff) at normal text size - not just "looks dark enough".
const TEXT_COLORS = [
  '#0f172b', '#386be6', '#007f45', '#894b00', '#dc2626', '#64748b',
  '#7c3aed', '#0e7490', '#be185d', '#4d7c0f', '#c2410c', '#334155'
]
const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e2e8f0']

const currentTextColor = computed(() => {
  tick.value
  return props.editor?.getAttributes('textStyle').color || undefined
})

const linkPopoverOpen = ref(false)
const linkUrl = ref('')
const linkLabel = ref('')

function openLinkPopover() {
  linkUrl.value = ''
  linkLabel.value = ''
  linkPopoverOpen.value = true
}

function insertButtonLink() {
  const href = linkUrl.value.trim()
  const label = linkLabel.value.trim() || 'Click here'
  if (!href) return
  props.editor?.chain().focus().insertButtonLink({ href, label }).run()
  linkPopoverOpen.value = false
}

// The Align left/center/right buttons already in this toolbar (below) are
// the *same* three buttons for text, an image, or a button link - not a
// separate control per node type. Neither `image` nor `buttonLink` has a
// `textAlign`-style command of its own (that's a per-mark/paragraph concept
// from TextAlign), so this just branches on whichever type is currently
// selected and calls `updateAttributes` on that node's own `align` attribute
// instead - both nodes are only ever selected one at a time, so there's no
// ambiguity about which one a click should target. Falls through to the
// normal `setTextAlign` for everything else, unchanged from before.
function currentAlign(): string {
  tick.value
  if (props.editor?.isActive('image')) return (props.editor.getAttributes('image').align as string) || 'left'
  if (props.editor?.isActive('buttonLink')) return (props.editor.getAttributes('buttonLink').align as string) || 'left'
  return ''
}

function setAlign(value: 'left' | 'center' | 'right') {
  if (!props.editor) return
  if (props.editor.isActive('image')) {
    props.editor.chain().focus().updateAttributes('image', { align: value }).run()
    return
  }
  if (props.editor.isActive('buttonLink')) {
    props.editor.chain().focus().updateAttributes('buttonLink', { align: value }).run()
    return
  }
  props.editor.chain().focus().setTextAlign(value).run()
}

function isAlignActive(value: 'left' | 'center' | 'right'): boolean {
  tick.value
  if (props.editor?.isActive('image') || props.editor?.isActive('buttonLink')) return currentAlign() === value
  return isActive({ textAlign: value } as unknown as string)
}

const imagePopoverOpen = ref(false)
const imageUrl = ref('')
const imageAlt = ref('')
// A data: URL (from a local upload) rather than an external link - there's
// no backend/asset host in this app (see templateRuntime.ts's own "no
// persistence" note), so an uploaded file has nowhere else to live. It's
// exactly what a `<img>` tag's `src` accepts either way, so the insert path
// downstream (here and in emailExportHtml.ts) never needs to know which kind
// of URL it got.
const imageFileInput = ref<HTMLInputElement>()

function openImagePopover() {
  imageUrl.value = ''
  imageAlt.value = ''
  imagePopoverOpen.value = true
}

function insertImageFromUrl() {
  const src = imageUrl.value.trim()
  if (!src) return
  props.editor?.chain().focus().setImage({ src, alt: imageAlt.value.trim() || undefined }).run()
  imagePopoverOpen.value = false
}

function pickImageFile() {
  imageFileInput.value?.click()
}

function onImageFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    props.editor?.chain().focus().setImage({ src: reader.result as string, alt: imageAlt.value.trim() || undefined }).run()
    imagePopoverOpen.value = false
  }
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

const quoteLabel = computed(() => {
  tick.value
  return props.editor && !props.editor.state.selection.empty ? 'Quote highlighted parts' : 'Insert quote'
})
</script>

<template>
  <div
    class="flex items-center gap-1 p-1.5 flex-wrap bg-elevated/50"
    :class="flush ? '' : 'border border-default border-b-0 rounded-t-lg'"
  >
    <UTooltip text="Bold">
      <UButton color="neutral" :variant="isActive('bold') ? 'subtle' : 'ghost'" size="xs" square icon="i-lucide-bold" aria-label="Bold" @click="editor?.chain().focus().toggleBold().run()" />
    </UTooltip>
    <UTooltip text="Italic">
      <UButton color="neutral" :variant="isActive('italic') ? 'subtle' : 'ghost'" size="xs" square icon="i-lucide-italic" aria-label="Italic" @click="editor?.chain().focus().toggleItalic().run()" />
    </UTooltip>
    <UTooltip text="Underline">
      <UButton color="neutral" :variant="isActive('underline') ? 'subtle' : 'ghost'" size="xs" square icon="i-lucide-underline" aria-label="Underline" @click="editor?.chain().focus().toggleUnderline().run()" />
    </UTooltip>

    <div class="w-px h-4.5 bg-border mx-1" />

    <UTooltip text="Align left">
      <UButton color="neutral" :variant="isAlignActive('left') ? 'subtle' : 'ghost'" size="xs" square icon="i-lucide-align-left" aria-label="Align left" @click="setAlign('left')" />
    </UTooltip>
    <UTooltip text="Align center">
      <UButton color="neutral" :variant="isAlignActive('center') ? 'subtle' : 'ghost'" size="xs" square icon="i-lucide-align-center" aria-label="Align center" @click="setAlign('center')" />
    </UTooltip>
    <UTooltip text="Align right">
      <UButton color="neutral" :variant="isAlignActive('right') ? 'subtle' : 'ghost'" size="xs" square icon="i-lucide-align-right" aria-label="Align right" @click="setAlign('right')" />
    </UTooltip>

    <div class="w-px h-4.5 bg-border mx-1" />

    <UTooltip text="Bulleted list">
      <UButton color="neutral" :variant="isActive('bulletList') ? 'subtle' : 'ghost'" size="xs" square icon="i-lucide-list" aria-label="Bulleted list" @click="editor?.chain().focus().toggleBulletList().run()" />
    </UTooltip>
    <UTooltip text="Numbered list">
      <UButton color="neutral" :variant="isActive('orderedList') ? 'subtle' : 'ghost'" size="xs" square icon="i-lucide-list-ordered" aria-label="Numbered list" @click="editor?.chain().focus().toggleOrderedList().run()" />
    </UTooltip>

    <div class="w-px h-4.5 bg-border mx-1" />

    <!-- The one text-size control lives here, in the editor itself, rather
         than as a separate side-panel dropdown driving a CSS class - so it's
         available regardless of `compact` (a single static-text block still
         needs to size its own text) even though the rest of the full toolbar
         (colors, tables, banners...) stays behind `compact`. -->
    <UPopover v-model:open="fontSizePopoverOpen">
      <UTooltip text="Text size">
        <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-a-large-small" aria-label="Text size" />
      </UTooltip>
      <template #content>
        <div class="flex flex-col gap-0.5 p-1 w-36">
          <button
            v-for="item in fontSizeItems"
            :key="item.value"
            type="button"
            class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-elevated"
            :class="fontSize === item.value ? 'text-primary font-medium' : 'text-default'"
            @click="fontSize = item.value; fontSizePopoverOpen = false"
          >
            {{ item.label }}
            <UIcon v-if="fontSize === item.value" name="i-lucide-check" class="size-3.5" />
          </button>
        </div>
      </template>
    </UPopover>

    <template v-if="!compact">
    <UPopover>
      <UTooltip text="Text color">
        <UButton color="neutral" variant="ghost" size="xs" square aria-label="Text color">
          <span class="relative inline-flex items-center justify-center size-4">
            <UIcon name="i-lucide-baseline" class="size-4" />
            <span class="absolute -bottom-0.5 w-3 h-0.5 rounded-sm" :style="{ background: currentTextColor || 'rgb(15,23,43)' }" />
          </span>
        </UButton>
      </UTooltip>
      <template #content>
        <div class="grid grid-cols-6 gap-1 p-2">
          <button
            v-for="c in TEXT_COLORS"
            :key="c"
            type="button"
            class="size-5 rounded-full ring-1 ring-default"
            :style="{ background: c }"
            :aria-label="`Set text color ${c}`"
            @click="editor?.chain().focus().setColor(c).run()"
          />
        </div>
      </template>
    </UPopover>
    <UPopover>
      <UTooltip text="Highlight">
        <UButton color="neutral" :variant="isActive('highlight') ? 'subtle' : 'ghost'" size="xs" square icon="i-lucide-highlighter" aria-label="Highlight" class="text-[rgb(208,135,0)]" />
      </UTooltip>
      <template #content>
        <div class="grid grid-cols-6 gap-1 p-2">
          <button
            v-for="c in HIGHLIGHT_COLORS"
            :key="c"
            type="button"
            class="size-5 rounded-full ring-1 ring-default"
            :style="{ background: c }"
            :aria-label="`Highlight ${c}`"
            @click="editor?.chain().focus().toggleHighlight({ color: c }).run()"
          />
        </div>
      </template>
    </UPopover>

    <div class="w-px h-4.5 bg-border mx-1" />

    <UPopover v-model:open="linkPopoverOpen">
      <UTooltip text="Insert button link">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          square
          icon="i-lucide-link"
          aria-label="Insert button link"
          @click="openLinkPopover"
        />
      </UTooltip>
      <template #content>
        <form class="flex flex-col gap-2 p-3 w-64" @submit.prevent="insertButtonLink">
          <UFormField label="URL" :ui="{ label: 'text-xs' }">
            <UInput v-model="linkUrl" placeholder="https://…" size="xs" class="w-full text-sm" autofocus />
          </UFormField>
          <UFormField label="Button label" :ui="{ label: 'text-xs' }">
            <UInput v-model="linkLabel" placeholder="e.g. Open registration form" size="xs" class="w-full text-sm" />
          </UFormField>
          <UButton type="submit" color="primary" size="xs" block :disabled="!linkUrl.trim()">
            Insert button
          </UButton>
        </form>
      </template>
    </UPopover>

    <UPopover v-model:open="imagePopoverOpen">
      <UTooltip text="Insert image">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          square
          icon="i-lucide-image"
          aria-label="Insert image"
          @click="openImagePopover"
        />
      </UTooltip>
      <template #content>
        <form class="flex flex-col gap-2 p-3 w-64" @submit.prevent="insertImageFromUrl">
          <UFormField label="Alt text" :ui="{ label: 'text-xs' }">
            <UInput v-model="imageAlt" placeholder="Describes the image" size="xs" class="w-full text-sm" />
          </UFormField>
          <UFormField label="Image URL" :ui="{ label: 'text-xs' }">
            <UInput v-model="imageUrl" placeholder="https://…" size="xs" class="w-full text-sm" autofocus />
          </UFormField>
          <UButton type="submit" color="primary" size="xs" block :disabled="!imageUrl.trim()">
            Insert from URL
          </UButton>
          <div class="flex items-center gap-2 text-xs text-dimmed">
            <span class="flex-1 h-px bg-border" />
            or
            <span class="flex-1 h-px bg-border" />
          </div>
          <UButton color="neutral" variant="outline" size="xs" block icon="i-lucide-upload" @click="pickImageFile">
            Upload a file
          </UButton>
          <input ref="imageFileInput" type="file" accept="image/*" class="hidden" @change="onImageFileChange">
          <div class="text-xs text-dimmed pt-1 border-t border-default space-y-1">
            <p>Tip: use its settings icon to set it as a Header or Footer banner.</p>
            <dl class="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-0.5">
              <dt class="font-medium">Header:</dt><dd>640×140</dd>
              <dt class="font-medium">Footer:</dt><dd>640×100</dd>
            </dl>
          </div>
        </form>
      </template>
    </UPopover>

    <div class="w-px h-4.5 bg-border mx-1" />

    <EmailTableSizePicker :editor="editor" />
    <EmailTableControls :editor="editor" />
    <UTooltip text="Insert message banner">
      <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-megaphone" aria-label="Insert message banner" @click="editor?.chain().focus().insertMessageBanner().run()" />
    </UTooltip>
    <UTooltip :text="quoteLabel">
      <UButton color="neutral" :variant="isActive('blockquote') ? 'subtle' : 'ghost'" size="xs" square icon="i-lucide-quote" :aria-label="quoteLabel" @click="editor?.chain().focus().insertQuote().run()" />
    </UTooltip>
    <UTooltip text="Insert callout">
      <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-triangle-alert" aria-label="Insert callout" @click="editor?.chain().focus().insertCallout().run()" />
    </UTooltip>

    <div class="w-px h-4.5 bg-border mx-1" />

    <UTooltip text="Insert line break">
      <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-corner-down-left" label="BR" aria-label="Insert line break" @click="editor?.chain().focus().setHardBreak().run()" />
    </UTooltip>
    </template>
  </div>
</template>
