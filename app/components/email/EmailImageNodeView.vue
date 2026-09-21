<script setup lang="ts">
// NodeView for the custom `EmailImage` node (~/utils/tiptapExtensions.ts) -
// a dropped-in image can be plain (default), or explicitly marked as the
// email's Header or Footer, which makes it render full-bleed with zero
// padding (see ~/utils/emailExportHtml.ts) instead of sitting inside the
// padded content column like a plain inline image. The floating gear here
// is the only way to set/change that - same "hover-revealed chrome, popover
// settings" pattern as FormFieldNodeView.vue's own settings gear.
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { emailImageStyle, cropImageToAspect, HEADER_ASPECT, FOOTER_ASPECT, type EmailImageRole, type EmailImageAlign } from '~/utils/tiptapExtensions'

const props = defineProps(nodeViewProps)
const toast = useToast()

const role = computed<EmailImageRole>(() => (props.node.attrs.role as EmailImageRole) ?? null)
const align = computed<EmailImageAlign>(() => (props.node.attrs.align as EmailImageAlign) ?? 'left')

// Computed here (not read off a stored `style` attribute - there isn't one
// on the node itself) via the same `emailImageStyle()` helper the node's own
// `renderHTML` uses for `getHTML()`/export serialization - a custom Vue
// NodeView takes over on-screen rendering entirely, so without this the two
// could silently drift apart.
const imgStyle = computed(() => emailImageStyle(role.value, align.value))

// No alignment UI here - the toolbar's own existing Align left/center/right
// buttons (BlockToolbar.vue) apply to whichever image is currently selected,
// same as they always did for text. That's why this node has to actually be
// selectable in the first place (see `stopEvent` below).

const ROLE_OPTIONS: { value: EmailImageRole; label: string; hint: string }[] = [
  { value: null, label: 'Plain image', hint: 'Scales to fit, sits inline with the rest of the content' },
  { value: 'header', label: 'Header', hint: 'Full-width banner at the top, no padding' },
  { value: 'footer', label: 'Footer', hint: 'Full-width banner at the bottom, no padding' }
]

const cropping = ref(false)

// Picking Header/Footer crops the image's actual pixels to that banner's
// aspect ratio (see `cropImageToAspect` for why this can't just be a CSS
// effect) - always cropping from the true original (`originalSrc`, saved
// the first time a role is picked), never from an already-cropped `src`, so
// switching Header -> Footer -> Header again doesn't keep narrowing the
// visible portion each time. Picking "Plain image" just restores that
// original untouched.
async function setRole(next: EmailImageRole) {
  if (!next) {
    const original = (props.node.attrs.originalSrc as string | null) ?? props.node.attrs.src
    props.updateAttributes({ role: null, src: original, originalSrc: null })
    return
  }

  const source = (props.node.attrs.originalSrc as string | null) ?? (props.node.attrs.src as string)
  cropping.value = true
  try {
    const cropped = await cropImageToAspect(source, next === 'header' ? HEADER_ASPECT : FOOTER_ASPECT)
    props.updateAttributes({ role: next, src: cropped, originalSrc: source })
  } catch {
    // Most likely a cross-origin image URL whose server doesn't send
    // permissive CORS headers - the canvas can't read pixel data back out
    // of it to crop. Still apply the role (full-width, no padding) so the
    // banner behavior works, just without a guaranteed-undistorted crop.
    props.updateAttributes({ role: next, originalSrc: source })
    toast.add({
      title: 'Could not crop this image',
      description: 'This image is hosted elsewhere and can\'t be cropped in the browser - upload the file directly for a guaranteed clean fit.',
      icon: 'i-lucide-triangle-alert',
      color: 'warning'
    })
  } finally {
    cropping.value = false
  }
  moveToEdge(next)
}

function isEmptyParagraph(n: import('@tiptap/pm/model').Node | null): boolean {
  return !!n && n.type.name === 'paragraph' && n.content.size === 0
}

// A Header/Footer is meant to be a fixed position in the email, not
// wherever the cursor happened to be when it was inserted - so picking
// either role also moves the image to the actual top/bottom of the
// document, regardless of where it currently sits. Whichever side it lands
// against, an adjacent *empty* paragraph (most commonly a fresh document's
// own starting blank line) is dropped too, rather than left sitting right
// next to a banner that's supposed to have zero padding around it - that
// stray empty line was the real source of the "empty space" that kept
// showing up below a Header/Footer even after every export-side padding
// fix, since it's a genuine (if blank) paragraph in the document, not
// something a copy/export function can tell apart from content someone
// actually meant to keep.
//
// The image is inserted at its new position *before* any empty-paragraph
// cleanup runs, not after - stripping first and inserting last (an earlier
// version of this did that) could walk the document down to zero children
// on the way there, and Tiptap's document schema requires at least one
// block node at all times - so ProseMirror silently refills a brand new
// empty paragraph the instant the count would hit zero. The cleanup loop
// then just sees that fresh paragraph as "still empty" and deletes it
// again forever: a genuine infinite loop that hung the whole tab, not just
// a logic gap. Inserting the image first means it alone always satisfies
// that minimum, so the cleanup below can safely remove every other empty
// sibling without ever tripping the auto-refill.
function moveToEdge(target: 'header' | 'footer') {
  const editor = props.editor
  const pos = props.getPos()
  if (!editor || typeof pos !== 'number') return

  editor.chain().focus().command(({ tr }) => {
    const node = tr.doc.nodeAt(pos)
    if (!node) return false
    tr.delete(pos, pos + node.nodeSize)
    tr.insert(target === 'header' ? 0 : tr.doc.content.size, node)

    // Loops, not a single check - inserting a block image into the middle
    // of an *empty* paragraph splits that one paragraph into two empty
    // halves (one on each side of the image's old position), not just one -
    // a single strip left the other half behind as the new outermost
    // sibling, which is exactly the "empty space still exists" bug: it was
    // never the same paragraph being missed twice, it was two different
    // empty paragraphs with only one ever being removed.
    if (target === 'footer') {
      // The image is now the last child - keep checking the sibling just
      // *before* it (never the image itself).
      while (tr.doc.childCount > 1) {
        const before = tr.doc.child(tr.doc.childCount - 2)
        if (!isEmptyParagraph(before)) break
        const from = tr.doc.content.size - node.nodeSize - before.nodeSize
        tr.delete(from, from + before.nodeSize)
      }
    } else {
      // The image is now the first child - keep checking the sibling just
      // *after* it.
      while (tr.doc.childCount > 1) {
        const after = tr.doc.child(1)
        if (!isEmptyParagraph(after)) break
        tr.delete(node.nodeSize, node.nodeSize + after.nodeSize)
      }
    }

    return true
  }).run()
}

const settingsOpen = ref(false)
</script>

<template>
  <!-- `draggable="true"` goes on the wrapper, not the `<img>` - the wrapper
       is what NodeViewWrapper wires to Tiptap's own `onDragstart` (see
       @tiptap/vue-3's NodeViewWrapper.ts), which is what turns a drag into an
       actual "move this block within the document" ProseMirror operation.
       The `<img>` itself is explicitly `draggable="false"` so the browser's
       own generic "drag this image out of the page" behavior doesn't compete
       with (and win over) that - without it, starting a drag from on top of
       the image did the browser's native image-drag instead of reordering
       the node, which is why dragging didn't appear to do anything. -->
  <NodeViewWrapper data-email-image-node class="group relative" draggable="true" :class="role ? 'my-0' : 'my-2'">
    <img :src="node.attrs.src" :alt="node.attrs.alt" :style="imgStyle" draggable="false">

    <!-- Same floating-chrome card (bordered, ghost icon button, hover-reveal)
         as FormFieldNodeView.vue's own settings gear - one visual language
         for "this node has a settings popover" everywhere it appears. -->
    <div
      data-email-image-chrome
      class="absolute top-2 right-2 z-10 rounded-md border border-default bg-default px-0.5 py-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
      :class="settingsOpen ? '!opacity-100' : ''"
    >
      <UPopover v-model:open="settingsOpen" :content="{ side: 'bottom', align: 'end', sideOffset: 8 }">
        <UTooltip text="Image options">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            square
            icon="i-lucide-settings-2"
            aria-label="Image options"
            @mousedown.stop
          />
        </UTooltip>
        <template #content>
          <div class="p-3 w-72 space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-dimmed px-1 pb-1">Use this image as</h3>
            <button
              v-for="opt in ROLE_OPTIONS"
              :key="String(opt.value)"
              type="button"
              :disabled="cropping"
              class="w-full flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :class="role === opt.value ? 'bg-primary/5' : ''"
              @click="setRole(opt.value)"
            >
              <span>
                <span class="block text-sm" :class="role === opt.value ? 'text-primary font-medium' : 'text-default'">{{ opt.label }}</span>
                <span class="block text-xs text-dimmed">{{ opt.hint }}</span>
              </span>
              <UIcon v-if="cropping && role !== opt.value" name="i-lucide-loader-2" class="size-3.5 shrink-0 mt-0.5 text-dimmed animate-spin" />
              <UIcon v-else-if="role === opt.value" name="i-lucide-check" class="size-3.5 shrink-0 mt-0.5 text-primary" />
            </button>
          </div>
        </template>
      </UPopover>
    </div>
  </NodeViewWrapper>
</template>
