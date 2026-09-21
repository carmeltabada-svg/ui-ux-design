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
export function buildPrintCss(pageSize: PageSize, margins: PageMargins, themeColor: string): string {
  const dims = PAGE_SIZES[pageSize]
  const toIn = (px: number) => `${(px / 96).toFixed(3)}in`

  return `
    @page {
      size: ${toIn(dims.widthPx)} ${toIn(dims.heightPx)};
      margin: ${toIn(margins.top)} ${toIn(margins.right)} ${toIn(margins.bottom)} ${toIn(margins.left)};
      @top-left { content: element(pageHeaderLeft); }
      @top-right { content: element(pageHeaderRight); }
      @bottom-left { content: element(pageFooterLeft); }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9.5px; color: #9CA3AF; }
    }
    #print-header-left { position: running(pageHeaderLeft); }
    #print-header-right { position: running(pageHeaderRight); }
    #print-footer-left { position: running(pageFooterLeft); }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1F2937;
    }
    h1, h2, h3, h4, h5, h6 { color: #111827; font-weight: 600; margin: 0.6em 0 0.3em; }
    h1 { font-size: 20px; } h2 { font-size: 17px; } h3 { font-size: 15px; }
    p { margin: 0.5em 0; }
    a { color: ${themeColor}; }
    ul { list-style: disc; padding-left: 20px; }
    ol { list-style: decimal; padding-left: 20px; }
    li { margin: 4px 0; }
    blockquote { border-left: 3px solid #D1D5DB; margin: 0.5em 0; padding: 0.2em 0 0.2em 0.9em; color: #4B5563; }
    mark { background: #FEF08A; border-radius: 3px; padding: 0 2px; }

    table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 0.5em 0; }
    th, td { border: 1px solid #D1D5DB; padding: 6px 10px; text-align: left; }
    th { font-weight: 600; }

    [data-callout] {
      border-left: 3px solid rgb(137, 75, 0);
      background: rgba(202, 138, 4, 0.08);
      color: rgb(137, 75, 0);
      border-radius: 0 6px 6px 0;
      padding: 0.6em 0.8em;
      margin: 0.5em 0;
    }
    [data-message-banner] {
      border-left: 3px solid ${themeColor};
      background: color-mix(in srgb, ${themeColor} 8%, transparent);
      color: #1F2937;
      padding: 0.6em 0.8em;
      margin: 0.5em 0;
    }
    [data-btn-link] {
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
    .pf-field { padding: 4px 0; margin: 4px 0; break-inside: avoid; }
    .pf-label { font-weight: 600; font-size: 13px; margin: 0 0 4px; color: #111827; }
    .pf-required { color: #DC2626; margin-left: 2px; }
    /* Hint text is builder-facing guidance for filling the field out live -
       not something that belongs on the actual signed/printed document, so
       it's suppressed here rather than in ~/utils/formFieldStaticRender.ts
       (which still emits the markup - simplest single place to hide it, and
       keeps the static-render function's output identical between the two
       call sites that use it). */
    .pf-hint { display: none; }
    .pf-empty { font-size: 13px; color: #9CA3AF; font-style: italic; margin: 0; }
    .pf-answer-line { padding: 2px 0; font-size: 14px; min-height: 20px; }
    .pf-checkbox-row { display: flex; align-items: center; gap: 8px; }
    .pf-checkbox { width: 14px; height: 14px; border: 1px solid #9CA3AF; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; flex-shrink: 0; }
    .pf-checkbox-checked { background: ${themeColor}; border-color: ${themeColor}; }
    .pf-image { max-height: 160px; max-width: 100%; border-radius: 6px; border: 1px solid #E5E7EB; margin-top: 4px; }
    .pf-signature-image { max-height: 72px; max-width: 260px; display: block; }
    .pf-signature-line { height: 72px; border-bottom: 1px solid #9CA3AF; }
    .pf-signature-label { font-size: 11px; text-transform: uppercase; color: #6B7280; margin-top: 4px; }
    .pf-button { display: inline-block; padding: 0.5em 1.2em; border-radius: 8px; font-weight: 600; text-decoration: none; color: #fff; }
    .pf-button-primary { background: ${themeColor}; }
    .pf-button-neutral { background: #6B7280; }
    .pf-button-error { background: #DC2626; }
    .pf-button-success { background: #16A34A; }
  `
}
