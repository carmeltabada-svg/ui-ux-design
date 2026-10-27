import type { PageSize, PageMargins } from '~/data/retrievalForms'
import { PAGE_SIZES } from '~/data/retrievalForms'

// The CSS Paged.js renders the print/PDF document with. Paged.js parses a
// plain HTML string plus explicit stylesheets - it does NOT inherit this
// app's own linked main.css/Tailwind build - so anything the document needs
// to look right (list markers, table borders, the callout/banner/quote/
// button-link node styles, and the static field-card look from
// ~/utils/formFieldStaticRender.ts) has to be spelled out here explicitly.
// This is a deliberate, scoped subset of `.prose-tiptap` in
// app/assets/css/main.css - not a full copy of the app's Tailwind build -
// covering exactly the node types this document's content can contain.
/**
 * `scope` (a class already present on the container Paged.js renders into -
 * `.artifacts-print-root` for the ticket workspace, `.print-root` for
 * /form-preview) is prefixed onto every plain rule below. Real bug,
 * reproduced live and root-caused after several earlier passes had chased
 * it as a data/reactivity issue: Paged.js's `Previewer.preview()` injects
 * whatever CSS is handed to it as a real, ordinary `<style>` element in the
 * live document - it does not scope or shadow-isolate it in any way. Every
 * selector here used to be a bare tag/attribute selector (`body`, `h1..h6`,
 * `a`, `table`, `th`, `td`, ...), which is exactly the same specificity a
 * browser applies GLOBALLY the moment that stylesheet exists - so clicking
 * "Export as PDF" anywhere in the app was quietly overwriting the real
 * app's own body font, every heading's weight, every link's color, and
 * every table's layout (`table-layout: fixed` on every `<table>` in the
 * app, colliding with Tailwind-controlled column widths) - exactly
 * matching the long-running "fonts/weights changed, table columns
 * overlapping, only fixed by a hard refresh" reports, which turned out to
 * have nothing to do with ticket data or SSR at all. Scoping every
 * selector under the print root's own class means this stylesheet can
 * only ever affect the (offscreen except while actively printing)
 * paginated content it was written for, no matter how long it lingers in
 * `document.head` afterward.
 */
export function buildPrintCss(pageSize: PageSize, margins: PageMargins, themeColor: string, scope: string): string {
  const dims = PAGE_SIZES[pageSize]
  const toIn = (px: number) => `${(px / 96).toFixed(3)}in`

  return `
    @page {
      size: ${toIn(dims.widthPx)} ${toIn(dims.heightPx)};
      margin: ${toIn(margins.top)} ${toIn(margins.right)} ${toIn(margins.bottom)} ${toIn(margins.left)};
      @top-left { content: element(pageHeaderLeft); }
      @top-right { content: element(pageHeaderRight); }
      @bottom-left { content: element(pageFooterLeft); }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9.5px; color: #6B7280; }
    }
    #print-header-left { position: running(pageHeaderLeft); }
    #print-header-right { position: running(pageHeaderRight); }
    #print-footer-left { position: running(pageFooterLeft); }

    ${scope} {
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1F2937;
    }
    ${scope} h1, ${scope} h2, ${scope} h3, ${scope} h4, ${scope} h5, ${scope} h6 { color: #111827; font-weight: 600; margin: 0.6em 0 0.3em; }
    ${scope} h1 { font-size: 20px; } ${scope} h2 { font-size: 17px; } ${scope} h3 { font-size: 15px; }
    ${scope} p { margin: 0.5em 0; }
    ${scope} a { color: ${themeColor}; }
    ${scope} ul { list-style: disc; padding-left: 20px; }
    ${scope} ol { list-style: decimal; padding-left: 20px; }
    ${scope} li { margin: 4px 0; }
    ${scope} blockquote { border-left: 3px solid #D1D5DB; margin: 0.5em 0; padding: 0.2em 0 0.2em 0.9em; color: #4B5563; }
    ${scope} mark { background: #FEF08A; border-radius: 3px; padding: 0 2px; }

    ${scope} table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 0.5em 0; }
    ${scope} th, ${scope} td { border: 1px solid #D1D5DB; padding: 6px 10px; text-align: left; }
    ${scope} th { font-weight: 600; }

    ${scope} [data-callout] {
      border-left: 3px solid rgb(137, 75, 0);
      background: rgba(202, 138, 4, 0.08);
      color: rgb(137, 75, 0);
      border-radius: 0 6px 6px 0;
      padding: 0.6em 0.8em;
      margin: 0.5em 0;
    }
    ${scope} [data-message-banner] {
      border-left: 3px solid ${themeColor};
      background: color-mix(in srgb, ${themeColor} 8%, transparent);
      color: #1F2937;
      padding: 0.6em 0.8em;
      margin: 0.5em 0;
    }
    ${scope} [data-btn-link] {
      display: inline-block;
      background: ${themeColor};
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      padding: 0.6em 1.4em;
      border-radius: 8px;
      margin: 0.5em 0;
    }

    /* Static fields - see ~/utils/formFieldStaticRender.ts. No card border -
       every field prints flush in the document flow (matching the live
       editor, which dropped the boxed-card look entirely), whether it's a
       standalone field or sitting inside a table cell (that cell's own
       border already frames it there). */
    ${scope} .pf-field { padding: 4px 0; margin: 4px 0; break-inside: avoid; }
    ${scope} .pf-label { font-weight: 600; font-size: 13px; margin: 0 0 4px; color: #111827; }
    ${scope} .pf-required { color: #DC2626; margin-left: 2px; }
    /* Hint text is builder-facing guidance for filling the field out live -
       not something that belongs on the actual signed/printed document, so
       it's suppressed here rather than in ~/utils/formFieldStaticRender.ts
       (which still emits the markup - simplest single place to hide it, and
       keeps the static-render function's output identical between the two
       call sites that use it). */
    ${scope} .pf-hint { display: none; }
    ${scope} .pf-empty { font-size: 13px; color: #6B7280; font-style: italic; margin: 0; }
    ${scope} .pf-answer-line { padding: 2px 0; font-size: 14px; min-height: 20px; }
    ${scope} .pf-checkbox-row { display: flex; align-items: center; gap: 8px; }
    ${scope} .pf-checkbox { width: 14px; height: 14px; border: 1px solid #9CA3AF; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; flex-shrink: 0; }
    ${scope} .pf-checkbox-checked { background: ${themeColor}; border-color: ${themeColor}; }
    ${scope} .pf-image { max-height: 160px; max-width: 100%; border-radius: 6px; border: 1px solid #E5E7EB; margin-top: 4px; }
    ${scope} .pf-signature-image { max-height: 72px; max-width: 260px; display: block; }
    ${scope} .pf-signature-line { height: 72px; border-bottom: 1px solid #9CA3AF; }
    ${scope} .pf-signature-label { font-size: 11px; text-transform: uppercase; color: #6B7280; margin-top: 4px; }
    ${scope} .pf-button { display: inline-block; padding: 0.5em 1.2em; border-radius: 8px; font-weight: 600; text-decoration: none; color: #fff; }
    ${scope} .pf-button-primary { background: ${themeColor}; }
    ${scope} .pf-button-neutral { background: #6B7280; }
    ${scope} .pf-button-error { background: #DC2626; }
    ${scope} .pf-button-success { background: #16A34A; }
  `
}
