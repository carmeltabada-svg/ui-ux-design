<script setup lang="ts">
// The document canvas for a Retrieval Form - a plain `@tiptap/vue-3` editor,
// the same library/pattern the email body editor already uses (see
// `app/components/email/BodyField.vue`), with real Word-like automatic
// pagination via the MIT-licensed `tiptap-pagination-plus` community
// extension. Page geometry (size, 1" margins) and per-page repeating
// header/footer are meant to match a real Word document, not approximate
// one - see the MARGIN_* constants below.
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import { PaginationPlus } from 'tiptap-pagination-plus'
import { FontSize, Callout, MessageBanner, QuoteCommand, ButtonLink, TableHeaderStyled } from '~/utils/tiptapExtensions'
import { FormFieldNode } from '~/utils/formFieldNode'
import { provideFormStructureEditable } from '~/utils/formStructureEditable'
import { PAGE_SIZES, DEFAULT_PAGE_MARGINS, type PageSize, type PageMargins, type FormBackground } from '~/data/retrievalForms'
import { backgroundStyle } from '~/utils/formBackground'

interface Props {
  modelValue: string
  /** See ~/utils/formStructureEditable.ts - gates the document's own
   * structure (typing, inserting fields, each field's settings gear). Does
   * NOT affect whether a field's own value controls respond - that's
   * ~/utils/formFieldsInteractive.ts, provided separately by whichever page
   * hosts this component. The host page is responsible for only rendering
   * its own FormDocumentToolbar (see that component) under the same
   * condition, since the toolbar itself lives outside this component now. */
  editable?: boolean
  pageSize?: PageSize
  /** Page padding (px, 96dpi) - defaults to DEFAULT_PAGE_MARGINS when
   * omitted. The same value drives the builder canvas and /form-preview's
   * print output (both render through this component), so there's one
   * source of truth instead of print silently drifting from the canvas. */
  margins?: PageMargins
  /** Raw HTML for the repeating per-page letterhead/footer (see
   * ~/utils/formLetterhead.ts) - built by the host page, since it's the one
   * with the form/mode/theme data this needs. Passed straight into
   * tiptap-pagination-plus's own header/footer widgets, which is what makes
   * it repeat on every physically paginated page instead of rendering once
   * around the whole document. */
  headerLeft?: string
  headerRight?: string
  footerLeft?: string
  /** Appends "Page {n} of {total}" to the footer's right side, kept in sync
   * as the real page count changes (see `scheduleFooterRecount` below). */
  showPageNumbers?: boolean
  /**
   * false (default) - this component owns its own scroll region, sized to
   * whatever height its parent gives it (the builder's own canvas panel,
   * which already has surrounding chrome to scroll independently within).
   * true - renders inline with no scroll region of its own, so the *page*
   * scrolls the document naturally instead of a second, nested scrollbar
   * appearing inside a fixed-height box - what /form-preview wants, since
   * that page has no other chrome competing for scroll space.
   */
  naturalScroll?: boolean
  /** The builder canvas's own backdrop (solid/gradient/image), same value
   * and picker as /form-preview's fixed layer - see backgroundStyle() in
   * ~/utils/formBackground.ts. Only meaningful when naturalScroll is false;
   * /form-preview paints its own fixed layer behind this component instead
   * (see the comment on .form-document-editor-canvas-backdrop below for why
   * this can't just be a static class anymore). */
  background?: FormBackground
}

const props = withDefaults(defineProps<Props>(), {
  editable: true,
  pageSize: 'letter',
  headerLeft: '',
  headerRight: '',
  footerLeft: '',
  showPageNumbers: true,
  naturalScroll: false
})
const emit = defineEmits<{ 'update:modelValue': [string] }>()

// FormFieldNodeView.vue's settings gear (and the toolbar below) mirror this
// same flag, so a field's type/label/required editor - and the document's
// own formatting controls - are exactly as inert as each other, wherever
// this component is used.
provideFormStructureEditable(computed(() => props.editable))

const margins = computed(() => props.margins ?? DEFAULT_PAGE_MARGINS)

// Real Word "Normal" template behavior: header/footer *text* sits a fixed
// 0.5" from the page edge, and body text starts at a fixed 1" from the page
// edge (or whatever the user picked via the Margins control) - Word does
// NOT reduce that gap based on how tall the header/footer actually is; a
// header taller than the 0.5" band just overlaps into the body area rather
// than push it down. (An earlier version of this file tried to be "smarter"
// than that - measuring the real rendered header/footer height and shrinking
// the gap to compensate - but that made the common case, a letterhead that
// nearly fills the 0.5" band, read as cramped/too-close, which is exactly
// the wrong direction: Word's own spacing is a fixed distance, not something
// that shrinks to fit.) So this is a fixed formula, not a measured one:
// header/footer text starts at HEADER_FOOTER_INSET (0.5"), and body starts
// at the page's own configured margin - the gap between them is just
// whatever's left over.
const HEADER_FOOTER_INSET = 48
// Floor so a margin smaller than the 0.5" inset (an edge-case custom margin)
// still leaves a visible gap instead of a negative/zero one.
const MIN_CONTENT_GAP = 8

function pageSizeConfig(size: PageSize, margins: PageMargins) {
  const dims = PAGE_SIZES[size]
  return {
    pageHeight: dims.heightPx,
    pageWidth: dims.widthPx,
    marginTop: HEADER_FOOTER_INSET,
    marginBottom: HEADER_FOOTER_INSET,
    marginLeft: margins.left,
    marginRight: margins.right,
    // Still included in the initial PaginationPlus.configure() (it reads
    // every key off this object at construction time), but NOT something
    // its own updatePageSize() command re-applies later - see
    // contentMarginsFor()/updateContentMargins below for why this alone
    // isn't enough to make a top/bottom margin change actually take effect
    // after mount.
    contentMarginTop: Math.max(MIN_CONTENT_GAP, margins.top - HEADER_FOOTER_INSET),
    contentMarginBottom: Math.max(MIN_CONTENT_GAP, margins.bottom - HEADER_FOOTER_INSET)
  }
}

// tiptap-pagination-plus's own `updatePageSize` command only ever reads
// pageHeight/pageWidth/marginTop/marginBottom/marginLeft/marginRight off
// the object it's given (see node_modules/tiptap-pagination-plus/dist/
// PaginationPlus.js) - contentMarginTop/contentMarginBottom silently never
// applied through it post-mount, which is the real reason top/bottom
// margin edits (preset or custom) visibly did nothing while left/right
// worked fine: left/right live in updatePageSize's whitelist, top/bottom's
// actual effect (contentMarginTop/Bottom) doesn't. The package has a
// *separate* `updateContentMargins` command for exactly this - every call
// site that calls updatePageSize() for a margins change must also call
// this, or the fix regresses back to "only left/right respond."
function contentMarginsFor(margins: PageMargins) {
  return {
    top: Math.max(MIN_CONTENT_GAP, margins.top - HEADER_FOOTER_INSET),
    bottom: Math.max(MIN_CONTENT_GAP, margins.bottom - HEADER_FOOTER_INSET)
  }
}

// tiptap-pagination-plus's own `{page}` token is a literal-string
// `.replace()` (not a template engine) inside the package, so this bakes
// the *total* page count in as a plain number before handing the string
// off - `{page}` survives through to become the package's own per-page
// counter span.
function footerRightHtml(total: number) {
  return props.showPageNumbers
    ? `<span style="font-size:9.5px;color:#9CA3AF">Page {page} of ${total}</span>`
    : ''
}

let lastFooterTotal = 1

const editor = useEditor({
  content: props.modelValue || '<p></p>',
  editable: props.editable,
  extensions: [
    StarterKit,
    TextAlign.configure({ types: ['paragraph', 'heading'] }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    FontSize,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeaderStyled,
    TableCell,
    Callout,
    MessageBanner,
    QuoteCommand,
    ButtonLink,
    FormFieldNode,
    PaginationPlus.configure({
      ...pageSizeConfig(props.pageSize, margins.value),
      // No real per-page DOM split exists to give a genuine gap between two
      // separate sheets (see the round-8/9 investigation - the package's
      // "pages" are pure accumulated-height math over one continuous
      // ProseMirror flow, not real containers). Two fake-realism attempts
      // were tried and both rejected: a solid gray fill (looked like a
      // painted strip) and an inset shadow faking paper depth (still a CSS
      // illusion pretending to be a real page boundary). Landed on the
      // opposite approach instead: don't pretend at all - the page
      // background matches the surrounding page, so it reads as one
      // continuous document (like Notion/Confluence), with only a plain
      // dashed line (via the CSS override below) marking where a page
      // would break - the same "this is a break point, not a real gap"
      // signal Word's own Draft/Normal view uses for a manual page break.
      pageBreakBackground: '#ffffff',
      pageGapBorderColor: '#D4D4D8',
      // Shrunk from the package's 50px default - there's no real gap to
      // fill with space now, just room for the dashed break line itself.
      pageGap: 28,
      headerLeft: props.headerLeft,
      headerRight: props.headerRight,
      footerLeft: props.footerLeft,
      footerRight: footerRightHtml(1)
    })
  ],
  editorProps: {
    attributes: {
      class: 'prose-tiptap text-sm text-default focus:outline-none'
    }
  },
  onUpdate: ({ editor: e }) => {
    scheduleAutosave(e.getHTML())
    scheduleFooterRecount()
    scheduleBreakAvoidance()
  },
  onCreate: () => {
    scheduleFooterRecount()
    scheduleBreakAvoidance()
  }
})

let autosaveTimer: ReturnType<typeof setTimeout> | undefined
function scheduleAutosave(html: string) {
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => emit('update:modelValue', html), 400)
}

// tiptap-pagination-plus recalculates its own page count asynchronously (it
// dispatches a follow-up transaction via requestAnimationFrame once it
// measures the freshly-rendered content) - two nested rAFs give that
// internal recalculation time to settle before this reads the real, current
// page count back out of the DOM. Only re-issues the footer command when the
// total actually changed, so this can't loop against the package's own
// re-render (which itself only fires on a real config/content change). A
// no-op when page numbers aren't shown at all, so a form that doesn't want
// them skips this measuring work entirely.
function scheduleFooterRecount() {
  if (!props.showPageNumbers) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!editor.value) return
      const total = editor.value.view.dom.querySelector('[data-rm-pagination]')?.children.length || 1
      if (total === lastFooterTotal) return
      lastFooterTotal = total
      editor.value.commands.updateFooterContent(props.footerLeft, footerRightHtml(total))
    })
  })
}

// tiptap-pagination-plus decides where each page ends by pure accumulated
// pixel height (see its own getContentHeight/getHeight in utils.js) - it has
// no idea a `[data-form-field-node]` block, or a heading, is one logical unit, so
// one whose box happens to straddle that height cutoff gets visually split,
// its footer/next header landing in the middle of it - a real Word document
// never does this (a heading or an atomic field block always starts clean on
// one page or the other; only an ordinary paragraph's own lines are allowed
// to split across the boundary, same as here). It doesn't read
// `break-inside` either (confirmed by reading the package source - nothing
// in it references that property), so the CSS rule below is a real, useful
// backstop for print/PDF export only, not something this package will ever
// honor on its own simulated on-screen breaks.
//
// This measures every field against every inserted page-break gap
// (`.breaker`) after the package's own layout has settled, and - for any
// field whose box actually straddles one - pushes that field down with a
// margin-top just large enough to clear the gap entirely, landing it whole
// on the next page instead of split across the boundary. That extra margin
// changes the document's total flowed height, which can shift where later
// content lands relative to a *later* page boundary, so this re-measures
// and repeats (bounded - real content converges in 1-2 passes; the cap just
// guards against this package's own async settling never actually
// stabilizing for some edge case). Nudges are cleared and fully
// re-measured from scratch each pass (not accumulated blindly) so a field
// that no longer needs one - content above it got shorter, say - doesn't
// keep stale spacing forever.
//
// This sets a plain inline style directly on the NodeView's own root DOM
// element rather than going through Vue/the node's own attrs - deliberately:
// ProseMirror reuses that same DOM node across unrelated transactions, and
// this specific NodeView only re-renders when its *own* reactive state
// changes (its attrs, interactive/editable flags), none of which this
// touches, so the direct style survives exactly as long as it needs to
// without being wiped by Vue's own render cycle.
// `updatePageSize` is also what asks the package to redo its own
// break-position math after a nudge changes total content height - but the
// package does that via its *own* async re-measurement (a follow-up
// transaction dispatched via rAF, same mechanism `scheduleFooterRecount`
// above already has to wait out), which fires this editor's `onUpdate` all
// over again. Calling `scheduleBreakAvoidance()` unconditionally from
// `onUpdate` - as the call sites below do, correctly, for real content
// edits - would otherwise mean every nudge re-enters here at pass 0 via
// that follow-up transaction, re-measures, finds the exact same straddle it
// already fixed, and calls `updatePageSize` again... forever. This
// signature check is what actually breaks that cycle: `updatePageSize` (and
// the recursive next pass) only fire when the *computed* nudges differ from
// the last set actually applied, so a re-entry that would just reapply the
// same fix is a no-op instead of a fresh mutation.
let lastNudgeSignature = ''
const MAX_BREAK_AVOID_PASSES = 4
function scheduleBreakAvoidance(pass = 0) {
  if (pass >= MAX_BREAK_AVOID_PASSES) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!editor.value) return
      const dom = editor.value.view.dom as HTMLElement
      const breakers = Array.from(dom.querySelectorAll<HTMLElement>('.breaker'))
      // `data-form-field-node` - not `data-form-field` (that's the attribute
      // FormFieldNode's own renderHTML would emit, but a NodeView with a
      // custom Vue component - see FormFieldNodeView.vue's NodeViewWrapper -
      // never goes through renderHTML at all, so that attribute never
      // actually appears in the DOM. This selector silently matched zero
      // fields for as long as it said `data-form-field` - only headings ever
      // got nudged, which is exactly why a field's own box (not a heading)
      // was still seen straddling a page break.
      //
      // Deliberately does NOT include `table` - see the KNOWN_ISSUES note
      // above this function's call sites (and the follow-up task filed this
      // round) on why a table straddling a page break isn't safe to nudge at
      // all here: tiptap-pagination-plus's own page-count math (not this
      // nudge logic) diverges once a table's real content crosses where it
      // last measured a page boundary, and can inflate the document to
      // hundreds of thousands of pixels tall. Nudging the table's `tbody`
      // margin was tried and did not prevent it - the runaway lives inside
      // the package's own `calculatePageCount()`, not in whether this app
      // nudges anything beforehand.
      // `[data-callout], [data-message-banner]` - unlike `table` (see the
      // comment above), these are plain block boxes with normal flow, not
      // the pagination package's `display:contents`/`display:table` table
      // hack, so nudging them the same way a heading/field already is has
      // none of that risk. Without this, a callout/banner tall enough to
      // straddle a break split visually mid-block - its background/left
      // border bled across the dashed break gap, and its last line landed
      // orphaned on the next page with an odd gap above it, since nothing
      // told the on-screen simulated pagination this was one unit.
      const fields = Array.from(dom.querySelectorAll<HTMLElement>('[data-form-field-node], h1, h2, h3, h4, h5, h6, [data-callout], [data-message-banner]'))
      if (!breakers.length || !fields.length) return

      for (const field of fields) {
        if (field.style.marginTop) field.style.marginTop = ''
      }

      const nudges: string[] = []
      for (const [index, field] of fields.entries()) {
        const fRect = field.getBoundingClientRect()
        for (const breaker of breakers) {
          const bRect = breaker.getBoundingClientRect()
          // The gap's top edge falls strictly inside the field's own box -
          // it's being visually split by this break.
          if (bRect.top > fRect.top + 1 && bRect.top < fRect.bottom - 1) {
            // +2px clearance, not an exact `bRect.bottom - fRect.top` - that
            // would land the field's new top edge exactly flush against the
            // breaker's own bottom edge with zero margin, and `.breaker` is
            // a real `float:left` element (see PaginationPlus.configure's
            // comment on the pagination package's DOM). A block box sitting
            // with sub-pixel-exact (this measurement rounds, the float's
            // layout doesn't) contact against a float can still register as
            // "overlapping" it - and a field whose *label* is a `display:
            // flex` box (a new block formatting context) gets pulled into
            // the standards-mandated "a BFC box must not overlap a float"
            // algorithm, which can compute its available width as 0 (a real,
            // reproduced bug: the label's own text stayed in the DOM, its
            // box just collapsed to width:0 and visually vanished). A couple
            // of pixels of real clearance keeps the field unambiguously
            // below the float instead of debating the exact boundary pixel.
            const extra = Math.round(bRect.bottom - fRect.top) + 8
            field.style.marginTop = `${extra}px`
            nudges.push(`${index}:${extra}`)
            break
          }
        }
      }

      const signature = nudges.join(',')
      if (signature && signature !== lastNudgeSignature) {
        lastNudgeSignature = signature
        editor.value.chain().updatePageSize(pageSizeConfig(props.pageSize, margins.value)).updateContentMargins(contentMarginsFor(margins.value)).run()
        scheduleBreakAvoidance(pass + 1)
      } else if (!signature) {
        lastNudgeSignature = ''
      }
    })
  })
}

watch(() => props.modelValue, (value) => {
  if (editor.value && value !== editor.value.getHTML()) {
    editor.value.commands.setContent(value || '<p></p>', { emitUpdate: false })
    scheduleFooterRecount()
    scheduleBreakAvoidance()
  }
})

watch(() => props.editable, (value) => {
  editor.value?.setEditable(value)
})

watch(() => props.pageSize, (size) => {
  editor.value?.chain().updatePageSize(pageSizeConfig(size, margins.value)).updateContentMargins(contentMarginsFor(margins.value)).run()
  scheduleFooterRecount()
  scheduleBreakAvoidance()
})

watch(margins, (m) => {
  editor.value?.chain().updatePageSize(pageSizeConfig(props.pageSize, m)).updateContentMargins(contentMarginsFor(m)).run()
  scheduleFooterRecount()
  scheduleBreakAvoidance()
}, { deep: true })

watch([() => props.headerLeft, () => props.headerRight], ([left, right]) => {
  editor.value?.commands.updateHeaderContent(left, right)
  scheduleBreakAvoidance()
})

watch(() => props.footerLeft, (left) => {
  editor.value?.commands.updateFooterContent(left, footerRightHtml(lastFooterTotal))
})

// Exposes the live editor instance so a host page can attach its own,
// separate toolbar (see FormDocumentToolbar.vue) directly under its own
// page header - full-width, not nested inside (and padding/border-
// constrained by) this canvas panel the way the toolbar used to be when it
// lived in this component's own template.
defineExpose({ editor })

onBeforeUnmount(() => {
  clearTimeout(autosaveTimer)
  editor.value?.destroy()
})
</script>

<template>
  <div
    class="form-document-editor flex flex-col"
    :class="naturalScroll ? '' : 'h-full overflow-hidden'"
  >
    <div
      class="flex justify-center py-8 px-4"
      :class="naturalScroll ? '' : 'flex-1 min-h-0 overflow-auto'"
      :style="naturalScroll ? undefined : backgroundStyle(background, '#E4E4E7')"
    >
      <!-- Wraps EditorContent and the (optional) actions slot in one shared-
           width column so the actions row - the form's Submit button - lines
           up under the same page width and sits directly after the last
           page, with no gray backdrop gap in between - but deliberately NOT
           merged into the page's own white/shadowed box (an earlier version
           did that, which then read as if Submit were printed content
           sitting *on* the page itself). It's an action for interacting with
           the form, not part of the document, so it stays on the plain
           canvas backdrop, just directly below the page instead of far away
           or centered under it. -->
      <div
        class="form-document-editor-page-column"
        :style="{ width: `${PAGE_SIZES[pageSize].widthPx}px` }"
      >
        <EditorContent :editor="editor" />
        <div v-if="$slots.actions" class="flex justify-end pt-4" :style="{ paddingRight: `${margins.right}px` }">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* tiptap-pagination-plus renders its page-break/gap/header/footer widgets
   as plain DOM directly inside the ProseMirror root (`.rm-with-pagination`
   is the class it adds to that same root) - the package only draws the
   thin gap *between* pages, not an outer page shadow/background, so that's
   added here. No :deep() needed for the width/height/margin values
   themselves - those come from CSS custom properties the package sets
   inline on the same element - but the class itself lives on a child the
   package owns, not this component's own template, hence :deep() to reach
   it at all from a scoped style block. */
.form-document-editor :deep(.rm-with-pagination) {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, .1), 0 8px 10px -6px rgba(0, 0, 0, .1);
  background: #ffffff;
}

/* The builder's own canvas backdrop used to be a static gray class here,
   which unconditionally painted over whatever background color/gradient/
   image the user picked via the Background popover in edit.vue - the popover
   visibly did nothing because this class sat on top of it in the DOM, fully
   opaque, every time (the exact "background not working in the edit canvas,
   only in preview" bug this fixes). It's a computed inline style now (see
   the `background` prop + backgroundStyle() call in the template above),
   defaulting to the same gray so an unset background still reads as "white
   pages sitting on a gray desk" - the same visual language Word/Google Docs
   use - instead of the page-break gap (see pageBreakBackground above)
   looking like a stray gray stripe floating in the middle of an otherwise
   plain white column. Not applied when naturalScroll is set - that's
   /form-preview.vue, which paints its own user-picked background behind the
   document on a fixed layer and must show through, not get overpainted by
   this. */

/* The page-break gap itself has no real "page" element on either side to
   ground a "real gap" visually (tiptap-pagination-plus's `.page` divs are
   invisible, zero-height positioning anchors, not real per-page boxes - see
   the PaginationPlus.configure comment above for why a true separate sheet
   per page isn't something this package - or the live ProseMirror document
   underneath it - actually has). Two earlier attempts at faking one anyway
   (a solid gray fill, then a two-sided inset shadow imitating paper depth)
   were both rejected as still reading as a fabricated gap. This is the
   opposite choice: the break area matches the page's own background
   (pageBreakBackground: '#ffffff' above), so the document reads as
   genuinely continuous - the dashed line is the only signal a break falls
   here, the same non-committal indicator Word's Draft view or Google Docs'
   pageless mode uses, not a claim that real page geometry exists under it.
   `!important` overrides the package's own injected stylesheet, which sets
   `border-top/bottom: 1px solid` - a plain CSS rule, not an inline style,
   so normal specificity wouldn't otherwise win against it. */
.form-document-editor :deep(.rm-pagination-gap) {
  border-top-style: dashed !important;
  border-bottom-style: dashed !important;
  border-top-width: 2px !important;
  border-bottom-width: 2px !important;
}

/* tiptap-pagination-plus decides where a page ends by pure accumulated
   pixel height - it has no idea a `[data-form-field-node]` block is a single
   logical unit, so a field whose box happens to straddle that height cutoff
   gets visually split by the inserted page gap, its footer/next header
   landing in the middle of it. `break-inside: avoid` is a real, standards-
   based instruction browsers already honor - it takes full effect during
   print/PDF export (the browser's own Ctrl/Cmd+P, see /form-preview.vue's
   @page rules), just not against this
   package's own on-screen simulated gap, since that isn't a CSS page break
   at all and this package never reads break-inside itself. Still worth
   setting unconditionally: free, harmless, and it's what makes the actual
   exported document correct even where the live canvas preview can't be. */
.form-document-editor :deep([data-form-field-node]),
.form-document-editor :deep(h1),
.form-document-editor :deep(h2),
.form-document-editor :deep(h3),
.form-document-editor :deep(h4),
.form-document-editor :deep(h5),
.form-document-editor :deep(h6) {
  break-inside: avoid;
  page-break-inside: avoid;
}
</style>
