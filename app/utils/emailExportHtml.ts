// Builds a self-contained, inline-styled copy of an email body for pasting
// into a real mail client (Outlook, Gmail, etc.) - see BlockToolbar.vue/
// main.css's `.prose-tiptap` for the on-screen version of these same rules.
//
// Outlook's compose window renders pasted HTML through Word's own HTML
// engine, which - unlike a browser - does not reliably apply CSS classes or
// `<style>` blocks (the app's own `.prose-tiptap`/`[data-callout]`/etc. rules
// in main.css never travel with a copy-paste at all, since they live in a
// linked stylesheet the clipboard has no way to carry). The one thing that
// *does* survive a paste is an inline `style="..."` attribute on each
// element, so every node this app's editor can produce gets one stamped on
// here before the HTML is ever written to the clipboard - that's what makes
// a pasted callout/table/banner still look like a callout/table/banner
// instead of bare unstyled text once it lands in someone else's mail client.
// Sized up from the app's own in-editor 14px "standard" body size -
// deliberately NOT the same number. Outlook's reading pane sits next to its
// own UI chrome (folder list, message list) set at a comfortably-sized
// default font, so content copied in at this app's own internal 14px reads
// small by comparison. Real email body copy conventionally runs
// 15-16px/22px-headings for exactly this reason.
// Outlook's Word-based paste engine is also the reason every fill below is
// `background-color`, never the shorthand `background` - Word reliably drops
// the shorthand property on paste (it isn't a recognized `mso-` style there)
// but keeps `background-color`.

/**
 * Parses a `style="..."` string into a property->value map, lower-casing
 * property names for lookup (values are left byte-for-byte as authored).
 */
function parseStyle(style: string): Map<string, string> {
  const map = new Map<string, string>()
  style.split(';').forEach((rule) => {
    const idx = rule.indexOf(':')
    if (idx === -1) return
    const prop = rule.slice(0, idx).trim().toLowerCase()
    const value = rule.slice(idx + 1).trim()
    if (prop && value) map.set(prop, value)
  })
  return map
}

/**
 * Merges a base (export-default) style string with an element's own
 * existing inline style, with the *existing* value winning per-property.
 *
 * This is the fix for the real bug the old version of this file had: it
 * called `el.setAttribute('style', SOME_STATIC_STRING)` unconditionally on
 * every `<p>`/`<h2>`/`<li>`/etc., which didn't add a style so much as
 * *replace* whatever inline style that element already had - and several of
 * this editor's own extensions render their per-instance choice as exactly
 * that kind of inline style: `text-align` from the alignment toolbar sits on
 * the `<p>` itself, a table header's chosen color sits on the `<th>` itself
 * (`TableHeaderStyled` in tiptapExtensions.ts), a highlight's chosen color
 * sits on the `<mark>` itself. Blindly overwriting the style attribute wiped
 * every one of those out and replaced it with this file's own hardcoded
 * defaults - which is why alignment, header color, and highlight color all
 * silently reverted to (or were replaced by) generic defaults once copied or
 * downloaded, even though the live editor showed them correctly right up
 * until export.
 */
function mergeStyle(existingStyle: string, base: string): string {
  const merged = parseStyle(base)
  parseStyle(existingStyle).forEach((value, prop) => merged.set(prop, value))
  return [...merged.entries()].map(([prop, value]) => `${prop}:${value}`).join(';') + ';'
}

/** `rgb(r, g, b)` (what `el.style.color` normalizes any color to) -> `#rrggbb`.
 * Passes through anything already in `#`-hex form unchanged. */
function toHex(color: string): string {
  const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return color
  return '#' + match.slice(1, 4).map(n => Number(n).toString(16).padStart(2, '0')).join('')
}

/** Escapes a plain-text string for safe HTML embedding, converting line
 * breaks to `<br>` - used for `footerNote`, which is authored as plain text
 * (not Tiptap HTML) so it never carries markup of its own. */
function escapePlainText(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML.replace(/\n/g, '<br>')
}

/** Maps a CSS px font size onto the legacy HTML `<font size="1-7">` scale
 * (1=~10px ... 7=~48px, per the old HTML4 spec's approximate mapping) - see
 * the comment on `wrapCharacterRunsInFont` below for why this scale exists
 * at all. */
function pxToFontSize(px: number): number {
  if (px <= 10) return 1
  if (px <= 13) return 2
  if (px <= 16) return 3
  if (px <= 18) return 4
  if (px <= 24) return 5
  if (px <= 36) return 6
  return 7
}

const NODE_STYLES: Record<string, string> = {
  h2: 'font-size:22px;font-weight:700;color:#111827;margin:22px 0 10px;font-family:Inter,sans-serif;',
  p: 'margin:0 0 16px;font-family:Inter,sans-serif;font-size:15px;line-height:1.65;color:#1f2937;',
  ul: 'margin:0 0 16px;padding-left:22px;font-family:Inter,sans-serif;font-size:15px;line-height:1.65;color:#1f2937;',
  ol: 'margin:0 0 16px;padding-left:22px;font-family:Inter,sans-serif;font-size:15px;line-height:1.65;color:#1f2937;',
  li: 'margin:0 0 6px;',
  // Matches `.prose-tiptap blockquote` in main.css (`var(--ui-border)` /
  // `var(--ui-text-muted)`, which resolve to these two hex values - see
  // main.css's `:root` block) rather than the old, slightly-off approximation.
  blockquote: 'margin:0 0 16px;padding:2px 0 2px 14px;border-left:3px solid #e2e8f0;color:#64748b;font-style:italic;',
  table: 'border-collapse:collapse;width:100%;margin:0 0 16px;font-family:Inter,sans-serif;font-size:14px;',
  td: 'border:1px solid #e2e8f0;padding:8px 12px;text-align:left;',
  th: 'border:1px solid #e2e8f0;padding:8px 12px;text-align:left;font-weight:700;font-family:Inter,sans-serif;color:#1f2937;',
  a: 'color:#386be6;',
  // `border:0` is the classic reset for the border some clients (Outlook
  // included) draw around a linked/atom image by default - CSS `border` is
  // one of the few properties Word does honor on a plain element. A *plain*
  // image (no header/footer role - see `isBannerImage`/`styleBannerImage`
  // below) scales to fit like any normal inline picture, same as the
  // in-editor NodeView's own "plain image" case in `emailImageStyle()`
  // (tiptapExtensions.ts) - it deliberately does NOT stretch to fill the
  // column the way a header/footer banner does.
  img: 'max-width:100%;height:auto;display:block;border:0;margin:0 0 16px;'
}

// A callout/banner/blockquote/table-cell all set their own text color on
// the *container*; a plain block child (`<p>`/`<ul>`/`<ol>`/`<li>`) inside
// one of those would normally just inherit that color via CSS cascade like
// any browser renders it - except `NODE_STYLES.p` (etc.) above stamps its
// own explicit `color` on that child too, and an element's own inline style
// always wins over an inherited value regardless of what the *parent's*
// color is. That's what made a callout/banner/blockquote's own accent color
// (brown, blue, muted gray) get silently overridden back to plain body text
// color the moment the block held so much as one child `<p>`, and added an
// unwanted 16px bottom margin inside every table cell along the way. Inside
// one of these containers, a child block gets a minimal reset instead - no
// explicit color/font, so the parent's own already-correct color/italic
// cascades down exactly like the live editor renders it.
const NESTED_RESET_STYLE = 'margin:0;'
const COLOR_CASCADE_PARENTS = 'blockquote, th, td, [data-callout], [data-message-banner]'

const CALLOUT_BG = '#fdf6e3'
const CALLOUT_BORDER = '#894b00'
const CALLOUT_COLOR = '#894b00'
const BANNER_BG = '#eef4fd'
const BANNER_BORDER = '#386be6'
// Matches `.prose-tiptap [data-message-banner]`'s `color: var(--ui-text)`
// (main.css `:root`), not a generic near-black.
const BANNER_COLOR = '#334155'
const BUTTON_BG = '#386be6'

function styleEl(el: HTMLElement) {
  const tag = el.tagName.toLowerCase()
  const existing = el.getAttribute('style') || ''

  // `data-btn-link`/`mark` are handled in their own later passes (a real
  // button needs a table wrapper, not just a style attribute - see
  // `tableizeButtons` below) - skip them here so this pass doesn't stamp a
  // style that a later pass then has to read back out again.
  if (el.hasAttribute('data-btn-link') || tag === 'mark') return

  const nestedInColorBlock = (tag === 'p' || tag === 'ul' || tag === 'ol' || tag === 'li')
    && el.parentElement?.closest(COLOR_CASCADE_PARENTS)
  if (nestedInColorBlock) {
    el.setAttribute('style', mergeStyle(existing, NESTED_RESET_STYLE))
    return
  }

  const style = NODE_STYLES[tag]
  if (style) el.setAttribute('style', mergeStyle(existing, style))
}

// Outlook's Word-based rendering engine reliably respects `background-color`
// (and `padding`) on a **table cell** but not on a plain `<div>` - a block
// div with a fill and padding routinely pastes in with the padding
// collapsed to nothing and the fill invisible as a result (this is the
// actual, real cause of "only the border shows, no fill" - not a missing
// CSS property, a whole class of element Outlook won't box-model correctly).
// This is exactly why the app's own tables paste in correctly already: they
// were always `<table>`/`<th>`/`<td>`, never a styled `<div>`. Converting a
// callout/banner into the same one-cell-table shape - *after* every element
// has already been styled by `styleEl` above, so its (already-fixed) inner
// content survives - gets it the same reliable treatment.
function tableizeFillBlocks(doc: Document) {
  doc.body.querySelectorAll<HTMLElement>('[data-callout], [data-message-banner]').forEach((el) => {
    const isCallout = el.hasAttribute('data-callout')
    const bg = isCallout ? CALLOUT_BG : BANNER_BG
    const border = isCallout ? CALLOUT_BORDER : BANNER_BORDER
    const color = isCallout ? CALLOUT_COLOR : BANNER_COLOR

    const table = doc.createElement('table')
    table.setAttribute('role', 'presentation')
    table.setAttribute('width', '100%')
    table.setAttribute('cellpadding', '0')
    table.setAttribute('cellspacing', '0')
    table.setAttribute('border', '0')
    table.setAttribute('style', 'width:100%;border-collapse:collapse;margin:0 0 16px;')

    const tr = doc.createElement('tr')
    const td = doc.createElement('td')
    // The legacy `bgcolor` attribute alongside the CSS property - belt and
    // suspenders for the oldest Outlook/Word HTML engines, which have a
    // history of trusting the attribute over the style property.
    td.setAttribute('bgcolor', bg)
    td.setAttribute(
      'style',
      `background-color:${bg};border-left:3px solid ${border};color:${color};padding:12px 16px;font-family:Inter,sans-serif;font-size:15px;line-height:1.65;`
    )
    td.innerHTML = el.innerHTML
    tr.appendChild(td)
    table.appendChild(tr)
    el.replaceWith(table)
  })
}

// `<mark>` is an HTML5 semantic tag with no equivalent in the older
// Word-derived markup vocabulary Outlook's paste engine actually understands
// (Word maps pasted HTML to its own internal WordML, and an unrecognized tag
// routinely gets its styling dropped entirely on that conversion, same as an
// unrecognized CSS property would). Converting to a `<span>` first (after
// `styleEl` above has already run, so the mark's own *actual* picked color
// survives the swap) is step one - see `stampMsoHighlight` below for why a
// span alone still isn't enough for Word specifically.
function tableizeMarks(doc: Document) {
  doc.body.querySelectorAll<HTMLElement>('mark').forEach((el) => {
    const span = doc.createElement('span')
    const existing = parseStyle(el.getAttribute('style') || '')
    existing.delete('color') // was `color:inherit` - meaningless once detached from `mark`'s own default styling, and a span has no special default to inherit away from
    const style = mergeStyle([...existing.entries()].map(([k, v]) => `${k}:${v}`).join(';'), 'background-color:#fef08a;border-radius:3px;padding:0 2px;')
    span.setAttribute('style', style)
    span.innerHTML = el.innerHTML
    el.replaceWith(span)
  })
}

// Word's own HTML export of its native "Text Highlight Color" character
// formatting is specifically `background:<color>;mso-highlight:<color>`, not
// `background-color` (the property this file otherwise standardizes on for
// every *block* fill, per the comment at the top of this file) - a run-level
// highlight is a different code path inside Word's HTML importer than a
// block/cell fill is, and it's keyed off exactly these two properties. Adds
// them alongside the existing `background-color` (kept for every non-Word
// client) rather than replacing it.
function stampMsoHighlight(doc: Document) {
  doc.body.querySelectorAll<HTMLElement>('span').forEach((el) => {
    const bg = el.style.backgroundColor
    if (!bg) return
    el.setAttribute('style', mergeStyle(el.getAttribute('style') || '', `background:${bg};mso-highlight:${bg};`))
  })
}

// Word's paste engine only reliably keeps character-run formatting (color,
// size) that maps onto the legacy HTML4 `<font color="" size="">` tag - the
// same tag Word's *own* HTML export still emits today for exactly this
// content, decades after HTML4. A modern `<span style="color:...">` is only
// honored when Outlook's paste-behavior setting is "Keep Source Formatting";
// under "Merge Formatting" (a common, sometimes *default* setting - see
// File > Options > Mail > Editor Options > Advanced > Cut, copy, and paste)
// Word discards inline CSS on a run but still keeps `<font>`'s legacy
// attributes, since those aren't "formatting to merge away," they're markup
// Word's importer maps directly onto its own native run properties. Every
// span this editor's TextStyle mark can produce (color and/or font-size -
// see FontSize in tiptapExtensions.ts) gets rewritten to a `<font>` carrying
// both the legacy attributes (for Word) and the original `style` (for every
// other client, which handles `<font style="...">` fine).
function wrapCharacterRunsInFont(doc: Document) {
  doc.body.querySelectorAll<HTMLElement>('span').forEach((el) => {
    const color = el.style.color
    const fontSize = el.style.fontSize
    if (!color && !fontSize) return // e.g. the highlight span above - no legacy attribute exists for a background fill on a text run

    const font = doc.createElement('font')
    if (color) font.setAttribute('color', toHex(color))
    if (fontSize) {
      const px = Number.parseFloat(fontSize)
      if (!Number.isNaN(px)) font.setAttribute('size', String(pxToFontSize(px)))
    }
    font.setAttribute('style', el.getAttribute('style') || '')
    font.innerHTML = el.innerHTML
    el.replaceWith(font)
  })
}

// Same legacy-attribute reasoning as `wrapCharacterRunsInFont` above, applied
// to a blockquote's own muted/italic text color - `color` as a CSS property
// on the blockquote is exactly the kind of run-level-ish text formatting
// that gets discarded the same way (its `border-left`, a structural/box
// property rather than character formatting, isn't affected and keeps
// showing even where the color doesn't - which matches "only the border
// shows" being the very first symptom ever reported for this export path).
function wrapBlockquoteFontColor(doc: Document) {
  doc.body.querySelectorAll<HTMLElement>('blockquote').forEach((el) => {
    const color = el.style.color
    if (!color) return
    const font = doc.createElement('font')
    font.setAttribute('color', toHex(color))
    font.innerHTML = el.innerHTML
    el.innerHTML = ''
    el.appendChild(font)
  })
}

// Same class of bug as the callout/banner divs above, with a worse-looking
// failure mode: a "button" here is really just an `<a>` styled with
// `background-color` + padding to look like one. When Word's paste engine
// collapses that padding/background the same way it does for a plain div,
// what's left is the anchor's own text color - white, chosen to sit on the
// (now-missing) blue fill - showing up as literally invisible white text on
// a white page, not just an unstyled link. Wrapping the anchor in a one-cell
// table puts the fill on a `<td>` (which Word does respect, same fix as
// callout/banner), so the button stays visible - and functional, since the
// anchor and its `href` are untouched - even if Word ignores every style on
// the `<a>` itself.
//
// A `<table>` with no explicit `width` doesn't default to "shrink to fit its
// content" in Word the way it does in a browser - Word's own Normal.dotm
// stylesheet applies its own default table width (effectively 100% of the
// compose body) to any table that doesn't say otherwise, which is why the
// button rendered as a giant full-width blue bar instead of a small pill:
// the *fill* (this function's actual job) was working exactly as intended,
// it was just filling a cell Word had stretched far past the button's real
// size. `mso-table-lspace`/`mso-table-rspace: 0` plus an explicit,
// non-stretching `width:1px` + `white-space:nowrap` on the cell is the
// standard "bulletproof button" fix for this - `width:1px` looks wrong but
// is the trick: it forces the cell down to its *minimum* content width
// instead of Word's stretched default, and `white-space:nowrap` stops the
// label from wrapping once the cell is that narrow, so it re-expands to fit
// the label exactly rather than actually rendering at 1px.
function tableizeButtons(doc: Document) {
  doc.body.querySelectorAll<HTMLElement>('[data-btn-link]').forEach((el) => {
    // Reads `data-href`, not `href` - the editor's own live anchor
    // (tiptapExtensions.ts's ButtonLink) deliberately carries no real `href`
    // so clicking it in the editor can't trigger actual browser navigation;
    // this export step is what turns the stored destination into a real,
    // functional link for the final pasted/exported email.
    const href = safeUrl(el.getAttribute('data-href')) || '#'
    const label = el.textContent || 'Click here'
    // The button node's own `renderHTML` (tiptapExtensions.ts) wraps the
    // anchor in a `<div style="text-align:...">` purely so alignment has
    // somewhere to live (an inline-block `<a>` doesn't respond to its own
    // margin the way a block element does - the *parent's* `text-align` is
    // what actually moves it) - replace that whole wrapper, not just the
    // anchor inside it, or the empty wrapper div would be left behind once
    // the anchor becomes a table.
    const wrapper = el.parentElement?.style.textAlign ? el.parentElement : null
    const align = wrapper?.style.textAlign || 'left'

    const table = doc.createElement('table')
    table.setAttribute('role', 'presentation')
    table.setAttribute('cellpadding', '0')
    table.setAttribute('cellspacing', '0')
    table.setAttribute('border', '0')
    table.setAttribute('align', align)
    table.setAttribute(
      'style',
      'border-collapse:collapse;margin:0 0 16px;mso-table-lspace:0pt;mso-table-rspace:0pt;'
    )

    const tr = doc.createElement('tr')
    const td = doc.createElement('td')
    td.setAttribute('bgcolor', BUTTON_BG)
    td.setAttribute('align', 'center')
    td.setAttribute('width', '1')
    td.setAttribute(
      'style',
      `background-color:${BUTTON_BG};border-radius:8px;width:1px;white-space:nowrap;mso-padding-alt:11px 24px;padding:11px 24px;`
    )

    const font = doc.createElement('font')
    font.setAttribute('color', '#ffffff')
    const a = doc.createElement('a')
    a.setAttribute('href', href)
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
    a.setAttribute(
      'style',
      `display:inline-block;font-family:Inter,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;white-space:nowrap;`
    )
    a.textContent = label
    font.appendChild(a)

    td.appendChild(font)
    tr.appendChild(td)
    table.appendChild(tr)
    ;(wrapper ?? el).replaceWith(table)
  })
}

// Only an image explicitly marked Header or Footer (via its NodeView's own
// gear-icon popover - see EmailImageNodeView.vue) gets the full-bleed
// treatment: its own zero-padding, full-width row instead of sitting inside
// the shared padded content row every other block (including a *plain*
// image - see `NODE_STYLES.img` above) uses. A plain top-level image is not
// good enough on its own to imply "this is a banner" - that's exactly what
// the role picker exists to make an explicit, reversible choice instead of
// an assumption based on position in the document.
function isBannerImage(el: Element): el is HTMLImageElement {
  return el.tagName.toLowerCase() === 'img' && !!(el as HTMLImageElement).dataset.role
}

// True when a chunk of HTML has no real content worth its own padded row -
// no visible text, and no element (an image, a table, a button) that would
// still be "content" despite having no text of its own. Used to drop the
// empty trailing paragraph ProseMirror keeps after a block image (see
// `flushBuffer` above) instead of rendering it as a blank white box.
function isBlankContent(html: string): boolean {
  const probe = new DOMParser().parseFromString(html, 'text/html')
  if (probe.body.textContent?.trim()) return false
  return !probe.body.querySelector('img, table, [data-callout], [data-message-banner], [data-btn-link]')
}

// Same aspect ratios as HEADER_ASPECT/FOOTER_ASPECT in tiptapExtensions.ts
// (the in-editor NodeView's own cropping target) - not imported directly
// since that file pulls in Vue/Tiptap runtime pieces this plain export util
// has no reason to depend on, but the numbers must stay in sync by hand if
// either ever changes.
const HEADER_ASPECT_HEIGHT = 140
const FOOTER_ASPECT_HEIGHT = 100

// Safe to force `width="640"` (a legacy HTML attribute, not just CSS - the
// one thing old Outlook reliably honors for image sizing) here, unlike an
// earlier version of this file that also tried a fixed `height` alongside
// `object-fit: cover`: the image's own pixels have already been cropped to
// exactly this aspect ratio by EmailImageNodeView.vue's `cropImageToAspect`
// before it ever reached this document, so stretching it to 640 wide is
// just scaling a rectangle that's already the right shape - never a real
// crop or distortion, in Outlook or anywhere else.
function styleBannerImage(img: HTMLImageElement) {
  const height = img.dataset.role === 'header' ? HEADER_ASPECT_HEIGHT : FOOTER_ASPECT_HEIGHT
  img.setAttribute('width', '640')
  img.setAttribute('height', String(height))
  img.setAttribute('style', 'width:100%;height:auto;display:block;margin:0;border:0;')
}

/**
 * Resolves `{{TOKEN}}` placeholders (same substitution as the print/preview
 * path - see `resolveTokensForPrint` in ~/data/templates.ts) and stamps an
 * inline style on every element the editor's own extensions can produce, so
 * the result still looks like the app's own design once pasted somewhere
 * with no access to this app's stylesheet.
 *
 * `background` (a solid hex color, or omitted for plain white/none) fills
 * the full-width area behind the centered 640px content column; `footerNote`
 * (plain text, not HTML) renders as small, muted, centered print below the
 * white content card, sitting directly on that same background - see
 * TemplateRuntime's `background`/`footerNote` fields for where a user picks
 * these per template.
 */
export function buildEmailExportHtml(bodyHtml: string, samples: Record<string, string>, background?: string, footerNote?: string): string {
  const resolved = bodyHtml.replace(/\{\{(\w+)\}\}/g, (_match, code) => samples[code] ?? '')
  const doc = new DOMParser().parseFromString(resolved, 'text/html')
  doc.body.querySelectorAll<HTMLElement>('*').forEach(styleEl)
  tableizeFillBlocks(doc)
  tableizeMarks(doc)
  stampMsoHighlight(doc)
  wrapBlockquoteFontColor(doc)
  wrapCharacterRunsInFont(doc)
  tableizeButtons(doc)

  // Split top-level content into alternating rows - a full-bleed, unpadded
  // row for each top-level header/footer image, and a properly-margined row
  // for everything else - instead of the one shared padded row every block
  // used to sit in together (which is what constrained a header image to
  // the same inset as body text in the first place). `32px 24px` (not the
  // old `8px`, an almost-nonexistent margin that read as unfinished) matches
  // the conventional comfortable reading margin real HTML email templates
  // use - 24px+ horizontal, a bit more vertical top/bottom.
  //
  // Every row's `<td>` gets an *explicit* white fill (`bgcolor` + CSS) here,
  // even though a browser would render an unset background as transparent-
  // over-the-page (i.e. already white) with no code needed. Word's paste
  // engine doesn't reliably make that same assumption once an *outer* table
  // around this one has its own color fill (see `background` below) - an
  // unfilled inner cell can end up showing the outer table's color bleeding
  // through instead of staying white, which is exactly backwards from "a
  // colored margin around a white email" (the actual, only intended effect
  // of the `background` option - the content itself was never meant to
  // pick up any tint).
  const CONTENT_PADDING = 'background-color:#ffffff;font-family:Inter,sans-serif;font-size:15px;line-height:1.65;color:#1f2937;padding:32px 24px;'
  const rows: string[] = []
  let buffer: string[] = []
  const flushBuffer = () => {
    if (!buffer.length) return
    const html = buffer.join('')
    buffer = []
    // ProseMirror always keeps one empty, editable paragraph directly after
    // a block atom (an image included) so there's somewhere to place the
    // cursor to keep typing below it - necessary for editing, but it's not
    // real content, and rendering it here would mean a fully empty
    // `padding:32px 24px` row with nothing in it: a blank white box, most
    // visible of all right after a Footer image, where it's the very last
    // thing in the document and reads as unexplained dead space in the
    // pasted/downloaded email. `isBlankContent` drops any buffered content
    // that has neither real text nor a real element (table/image/etc.)
    // in it, instead of rendering it as an empty padded row.
    if (isBlankContent(html)) return
    rows.push(`<tr><td bgcolor="#ffffff" style="${CONTENT_PADDING}">${html}</td></tr>`)
  }
  for (const child of [...doc.body.children]) {
    if (isBannerImage(child)) {
      flushBuffer()
      styleBannerImage(child)
      rows.push(`<tr><td align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:0;line-height:0;font-size:0;">${child.outerHTML}</td></tr>`)
    } else {
      buffer.push((child as HTMLElement).outerHTML)
    }
  }
  flushBuffer()
  const innerTable = `<table role="presentation" align="center" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:100%;margin:0 auto;">${rows.join('')}</table>`

  // A bare `<div style="max-width:640px">` never actually centers itself -
  // that's what CSS `margin: 0 auto` is for, and this had neither, which is
  // exactly why it sat flush against the reading pane's left edge with a
  // huge dead gap on the right once Outlook (a much wider pane than 640px)
  // rendered it. A `<div>` with `margin:auto` is also unreliable in
  // Outlook's own Word-based rendering engine specifically - the actually
  // bulletproof way to center a fixed-width block in Outlook is the classic
  // HTML-email trick: a `<table align="center">`, since Outlook honors the
  // legacy `align` *attribute* on tables far more consistently than it
  // honors auto-margins on anything.
  // The small-print note (if any) sits in its own row of the *outer* table,
  // below the white content card and on the same background - never inside
  // the white card itself, which is why it's built and placed here rather
  // than folded into `innerTable`/`rows` above. Its `<td>` gets the
  // background color explicitly stamped on (`bgcolor` + CSS), same as every
  // other fill in this file - the row above it (the one wrapping
  // `innerTable`) has its own explicit fill too, but each `<tr>`'s `<td>` is
  // its own independent cell as far as Word's renderer is concerned, so
  // without its own fill this row rendered as plain white/none, visually
  // detaching the note from the colored background it's meant to sit on
  // (reported as "the note is outside the background").
  const footerRow = footerNote?.trim()
    ? `<tr><td align="center"${background ? ` bgcolor="${background}"` : ''} style="${background ? `background-color:${background};` : ''}padding:16px 24px 24px;font-family:Inter,sans-serif;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">${escapePlainText(footerNote.trim())}</td></tr>`
    : ''

  if (!background && !footerRow) return innerTable

  // The background sits on an *outer*, full-width table wrapping the inner
  // centered one - same "Word only reliably fills a table cell" reasoning as
  // every other fill in this file, and `bgcolor` alongside `background-color`
  // for the same old-Outlook belt-and-suspenders reason. Still needed (with
  // no visible tint) even when only `footerNote` is set and `background`
  // isn't, purely to give the footer row somewhere to sit below the inner
  // table.
  const outerFillAttrs = background ? ` bgcolor="${background}" style="width:100%;background-color:${background};"` : ' style="width:100%;"'
  const outerCellFill = background ? `background-color:${background};` : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${outerFillAttrs}><tr><td align="center" style="${outerCellFill}padding:24px 8px 8px;">${innerTable}</td></tr>${footerRow}</table>`
}

/** Same token resolution, but a plain-text fallback (for the `text/plain`
 * clipboard flavor a client without HTML paste support falls back to). */
export function buildEmailExportPlainText(bodyHtml: string, samples: Record<string, string>): string {
  const resolved = bodyHtml.replace(/\{\{(\w+)\}\}/g, (_match, code) => samples[code] ?? '')
  return resolved
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h2|tr|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
