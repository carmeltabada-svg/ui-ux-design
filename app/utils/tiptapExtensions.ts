import { Extension, Node, mergeAttributes } from '@tiptap/core'
import TableHeader from '@tiptap/extension-table-header'
import TiptapImage from '@tiptap/extension-image'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import EmailImageNodeView from '~/components/email/EmailImageNodeView.vue'

// A plain `<th>` has no background of its own here (see main.css - tables
// insert with no fill at all, like a real Word table) - this is what a
// header row's own optional color comes from once someone explicitly picks
// one via the table toolbar's header-color control, not a default every
// table gets. The text color is never picked separately - it's computed
// from the background's own luminance (the standard WCAG relative-luminance
// threshold) each time the color changes, the same "does this need light or
// dark text to stay readable" rule any real design tool applies, so the
// header never silently becomes unreadable against a color someone picked
// for looks.
function contrastingTextColor(hex: string): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const r = Number.parseInt(full.slice(0, 2), 16) / 255
  const g = Number.parseInt(full.slice(2, 4), 16) / 255
  const b = Number.parseInt(full.slice(4, 6), 16) / 255
  const [rl, gl, bl] = [r, g, b].map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const luminance = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
  return luminance > 0.5 ? '#111827' : '#ffffff'
}

export const TableHeaderStyled = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: el => el.style.backgroundColor || null,
        renderHTML: attrs => {
          if (!attrs.backgroundColor) return {}
          return {
            style: `background-color:${attrs.backgroundColor};color:${contrastingTextColor(attrs.backgroundColor)}`
          }
        }
      }
    }
  }
})

export type EmailImageRole = 'header' | 'footer' | null

// A "plain" dropped-in image (role: null) behaves like any normal inline
// image - scales to fit, sits inline with the rest of the content, no
// special treatment. Header/Footer are meant to be genuine full-width,
// zero-padding banners - which rules out CSS `object-fit`/`max-height`
// tricks entirely, not just as a style preference: Outlook's Word-based
// rendering engine does not implement `object-fit` at all, so a fixed
// `width`/`height` box with `object-fit: cover` just stretches the raw
// image to fill that exact box in Outlook - real distortion, not a crop.
// The only way to get a genuinely full-width, undistorted, uncropped-looking
// banner in *every* client is to not rely on any client's CSS support at
// all: actually crop the image's own pixels to the target aspect ratio via
// `<canvas>` (see `cropImageToAspect` below, called from
// EmailImageNodeView.vue when a role is picked) before it's ever put in the
// document. Once the stored image *is* exactly a 640:140 (or 640:100)
// rectangle, plain `width:100%;height:auto` displays it correctly with zero
// special-casing needed from any renderer, Outlook included.
export const HEADER_ASPECT = { w: 640, h: 140 }
export const FOOTER_ASPECT = { w: 640, h: 100 }

export type EmailImageAlign = 'left' | 'center' | 'right'

// A block-level image doesn't respond to `text-align` on itself - its own
// `margin` is what actually moves it within the width it doesn't fill
// (`margin:0 auto` centers it, `margin-left:auto` alone pushes it to the
// right, and no `auto` at all - the default - leaves it flush left). Only
// meaningful for a *plain* image: a Header/Footer always spans the full
// column width already (see the `role` branch below), so there's no spare
// space for alignment to move it into - picking an alignment for one is a
// no-op by design, not a bug, which is why the gear popover only offers it
// for "Plain image".
function imageAlignMargin(align: EmailImageAlign): string {
  // `16px` bottom spacing on every branch, not just a bare `0`/`auto` pair -
  // this is the same breathing room before the next block that every other
  // element gets (see `p`/`ul`/etc. in emailExportHtml.ts's `NODE_STYLES`);
  // an earlier version of this only set the horizontal sides needed for
  // alignment and left top/bottom at a bare `0`, which silently zeroed out
  // that spacing for every plain image the moment alignment was touched at
  // all, "left" (the default) included.
  if (align === 'center') return '0 auto 16px'
  if (align === 'right') return '0 0 16px auto'
  return '0 auto 16px 0'
}

export function emailImageStyle(role: EmailImageRole, align: EmailImageAlign = 'left'): string {
  if (!role) return `max-width:100%;height:auto;display:block;margin:${imageAlignMargin(align)};`
  // `border-radius:0` overrides main.css's default rounded-corner treatment
  // for a plain image - a header/footer is meant to bleed edge-to-edge, and
  // rounded corners on a banner that's supposed to look flush with the rest
  // of the page read as a mistake, not a design choice.
  return 'width:100%;height:auto;display:block;margin:0;border:0;border-radius:0;'
}

/**
 * Crops (never stretches or distorts) the image at `src` to exactly the
 * `aspect` ratio, "cover" style - scales up until the target rectangle is
 * fully covered, then keeps only its centered portion - and returns the
 * result as a `data:` URL. This is real pixel cropping, not a CSS effect,
 * which is what makes it look correct even in Outlook (see the module-level
 * comment above for why CSS alone can't do this reliably there).
 *
 * Throws if the source image is cross-origin and the server hosting it
 * doesn't send permissive CORS headers - the canvas is "tainted" and
 * refuses to read pixel data back out of it in that case. Callers should
 * catch this and fall back gracefully (see EmailImageNodeView.vue's
 * `setRole`).
 */
export async function cropImageToAspect(src: string, aspect: { w: number; h: number }, outputWidth = 1280): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Image failed to load'))
    el.src = src
  })

  const outputHeight = Math.round(outputWidth * (aspect.h / aspect.w))
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const scale = Math.max(outputWidth / img.naturalWidth, outputHeight / img.naturalHeight)
  const drawWidth = img.naturalWidth * scale
  const drawHeight = img.naturalHeight * scale
  ctx.drawImage(img, (outputWidth - drawWidth) / 2, (outputHeight - drawHeight) / 2, drawWidth, drawHeight)

  return canvas.toDataURL('image/png')
}

export const EmailImage = TiptapImage.extend({
  // Lets ProseMirror treat this node as a draggable unit - without it, only
  // the browser's own generic "drag this <img> out of the page" behavior is
  // available (whatever `draggable` attribute the NodeView's own `<img>`
  // happens to carry), not "drag this block to reorder it within the
  // document" the way any other draggable node works. See
  // EmailImageNodeView.vue's NodeViewWrapper/`<img>` for the matching
  // attribute split this requires (wrapper draggable, inner `<img>` not).
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      role: {
        default: null,
        parseHTML: el => el.getAttribute('data-role') || null,
        // Reads `attrs.align` too, not just `attrs.role` - Tiptap hands every
        // attribute's `renderHTML` the node's *full* attribute set (see
        // `TableHeaderStyled` above for the same pattern), so this is the one
        // place that actually computes the final `style` string; `align`'s
        // own `renderHTML` below only ever adds the `data-align` marker.
        renderHTML: (attrs) => {
          const role = (attrs.role ?? null) as EmailImageRole
          const align = (attrs.align ?? 'left') as EmailImageAlign
          const base: Record<string, string> = { style: emailImageStyle(role, align) }
          if (role) base['data-role'] = role
          return base
        }
      },
      // Only meaningful for a Plain image (see `imageAlignMargin`'s own
      // comment) - a Header/Footer always spans the full column width
      // already, so picking an alignment for one is a no-op regardless of
      // what it's set to. Set via the toolbar's existing Align left/center/
      // right buttons (BlockToolbar.vue) - the same ones that align text -
      // while this node is the current selection, not a control of its own.
      align: {
        default: 'left',
        parseHTML: el => (el.getAttribute('data-align') as EmailImageAlign | null) || 'left',
        renderHTML: attrs => ({ 'data-align': (attrs.align as EmailImageAlign | null) || 'left' })
      },
      // The uncropped image, preserved so switching back to "Plain image" (or
      // re-cropping Header -> Footer) always starts from the real original
      // instead of re-cropping an already-cropped image, which would keep
      // narrowing the visible portion every time a role is changed.
      originalSrc: {
        default: null,
        parseHTML: el => el.getAttribute('data-original-src') || null,
        renderHTML: attrs => (attrs.originalSrc ? { 'data-original-src': attrs.originalSrc } : {})
      }
    }
  },
  addNodeView(): ReturnType<typeof VueNodeViewRenderer> {
    // `stopEvent: () => true` (unconditional) would tell ProseMirror this
    // NodeView handles every one of its own events itself and never let
    // ProseMirror's default click handling run at all - which also meant a
    // plain click on the image never turned into a NodeSelection, so the
    // toolbar's Align left/center/right buttons (and anything else that
    // needs `editor.isActive('image')` to be true) had no way to ever see
    // this image as "selected". Only swallowing events that start inside the
    // gear's own popover UI (marked `data-email-image-chrome` in
    // EmailImageNodeView.vue) keeps that popover's own clicks from also
    // moving the document selection, while a click on the image itself now
    // falls through to ProseMirror's normal node-selection handling.
    return VueNodeViewRenderer(EmailImageNodeView, {
      stopEvent: ({ event }) => !!(event.target as HTMLElement | null)?.closest('[data-email-image-chrome]')
    })
  }
})

// A drop-in replacement for StarterKit's own `TrailingNode` extension (used
// with `trailingNode: false` on StarterKit to disable that default one) -
// same "keep one empty, typable paragraph after a trailing block atom"
// safety behavior everywhere else (tables, plain images, callouts, ...), but
// with exactly one exception: an `EmailImage` explicitly marked as a
// Footer. A Footer is deliberately meant to be the literal last thing in the
// email (see emailImageStyle()'s own comment) - forcing a phantom empty
// paragraph after it every time defeated that on-screen, even though the
// real copy/EML export already drops that same paragraph on its own (see
// `isBlankContent` in emailExportHtml.ts). Every other node keeps the normal
// safety paragraph so nothing else about editing changes.
export const EmailTrailingNode = Extension.create({
  name: 'emailTrailingNode',
  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('emailTrailingNode')
    return [
      new Plugin({
        key: pluginKey,
        appendTransaction: (transactions, _oldState, state) => {
          if (!transactions.some(tr => tr.docChanged)) return null
          const last = state.doc.lastChild
          if (!last) return null
          if (last.type.name === 'paragraph') return null
          if (last.type.name === 'image' && last.attrs.role === 'footer') return null
          const paragraphType = state.schema.nodes.paragraph
          if (!paragraphType) return null
          return state.tr.insert(state.doc.content.size, paragraphType.create())
        }
      })
    ]
  }
})

// Extends TextStyle with a `fontSize` mark attribute + setFontSize/unsetFontSize
// commands - Tiptap ships FontSize only as a next/prerelease package, this is the
// documented pattern (https://tiptap.dev/docs/examples/advanced/custom-styles) for
// stable v3.
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: element => element.style.fontSize || null,
          renderHTML: attributes => {
            if (!attributes.fontSize) return {}
            return { style: `font-size: ${attributes.fontSize}` }
          }
        }
      }
    }]
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
    }
  }
})

// Simple block-level callout/banner nodes - the original console had toolbar
// buttons for these but no real insertion behavior; these give them one.
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0]
  },
  addCommands() {
    return {
      insertCallout: () => ({ chain }: any) => chain()
        .insertContent({ type: this.name, content: [{ type: 'paragraph' }] })
        .run()
    } as any
  }
})

export const MessageBanner = Node.create({
  name: 'messageBanner',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-message-banner]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-message-banner': '' }), 0]
  },
  addCommands() {
    return {
      insertMessageBanner: () => ({ chain }: any) => chain()
        .insertContent({ type: this.name, content: [{ type: 'paragraph' }] })
        .run()
    } as any
  }
})

// A single quote insert command that adapts to the current selection: with a
// highlighted range it lifts just that text out into its own quoted
// paragraph (splitting the surrounding paragraph as needed); with the cursor
// collapsed it inserts an empty, typeable blockquote at that point instead of
// wrapping - and quoting - the entire surrounding content.
export const QuoteCommand = Extension.create({
  name: 'quoteCommand',
  addCommands() {
    return {
      insertQuote: () => ({ state, chain }: any) => {
        const { from, to, empty } = state.selection
        // +2 skips past the blockquote's and paragraph's own opening tokens,
        // landing the cursor inside the (now typeable) quote paragraph rather
        // than wherever `insertContent` leaves it by default (after the node).
        if (empty) {
          return chain()
            .insertContent({ type: 'blockquote', content: [{ type: 'paragraph' }] })
            .setTextSelection(from + 2)
            .run()
        }
        const text = state.doc.textBetween(from, to, ' ')
        return chain()
          .insertContentAt({ from, to }, {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }]
          })
          .setTextSelection(from + 2 + text.length)
          .run()
      }
    } as any
  }
})

// Renders as a styled, button-looking link rather than an inline text link -
// matches the CTA buttons in the source email templates ("Open registration
// form" etc.) instead of Tiptap's default underlined inline `<a>`.
export type ButtonLinkAlign = 'left' | 'center' | 'right'

export const ButtonLink = Node.create({
  name: 'buttonLink',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      // Stored as `data-href` (below), deliberately never rendered as a
      // real `href` on the on-screen anchor - a real `href` (with a real
      // `target="_blank"`) turned every click into an actual browser
      // navigation instead of a ProseMirror node selection, which is what
      // broke "click the button to align it" entirely (this is what the
      // export path's own `tableizeButtons` - see emailExportHtml.ts - puts
      // back as a genuine `href` for the delivered/pasted email, which is
      // the only place a real, followable link is ever actually needed).
      href: {
        default: '',
        parseHTML: el => el.getAttribute('data-href') || '',
        renderHTML: attrs => ({ 'data-href': attrs.href || '' })
      },
      label: { default: 'Click here' },
      // The button itself is `display: inline-block` (main.css), which
      // doesn't respond to its own margin the way a block element does -
      // `text-align` on a *wrapping* element is what actually moves an
      // inline-block child, so that's what `renderHTML` below wraps it in
      // (same reasoning as `imageAlignMargin` in emailImageStyle() above,
      // just via a different CSS property since this node is inline-block
      // rather than block).
      align: {
        default: 'left',
        parseHTML: el => (el.parentElement?.style.textAlign as ButtonLinkAlign | undefined) || 'left',
        renderHTML: () => ({})
      }
    }
  },
  parseHTML() {
    return [{ tag: 'a[data-btn-link]' }]
  },
  // Reads `align` (and `label`) off `node.attrs` - the node's *raw*
  // attribute values - not the `HTMLAttributes` parameter: that one is
  // already the merged *output* of every attribute's own `renderHTML` (see
  // `align`'s own `renderHTML: () => ({})` above, which deliberately
  // contributes nothing to it), so `HTMLAttributes.align` would always be
  // `undefined` regardless of what the node's actual align is set to.
  renderHTML({ node, HTMLAttributes }) {
    const align = (node.attrs.align as ButtonLinkAlign | undefined) || 'left'
    // No `href`/`target` here on purpose - see the `href` attribute's own
    // comment above. `mergeAttributes` already contributes `data-href` (via
    // that attribute's `renderHTML`) without needing to repeat it.
    return ['div', { style: `text-align:${align};` }, ['a', mergeAttributes(HTMLAttributes, {
      'data-btn-link': ''
    }), node.attrs.label]]
  },
  addCommands() {
    return {
      insertButtonLink: (attrs: { href: string; label: string }) => ({ chain }: any) => chain()
        .insertContent({ type: this.name, attrs })
        .run()
    } as any
  }
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: { insertCallout: () => ReturnType }
    messageBanner: { insertMessageBanner: () => ReturnType }
    quoteCommand: { insertQuote: () => ReturnType }
    buttonLink: { insertButtonLink: (attrs: { href: string; label: string }) => ReturnType }
  }
}
