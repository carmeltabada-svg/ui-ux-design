import{T as e}from"./D4840reK.js";function t(t,n,r,i){let a=e[t],o=e=>`${(e/96).toFixed(3)}in`;return`
    @page {
      size: ${o(a.widthPx)} ${o(a.heightPx)};
      margin: ${o(n.top)} ${o(n.right)} ${o(n.bottom)} ${o(n.left)};
      @top-left { content: element(pageHeaderLeft); }
      @top-right { content: element(pageHeaderRight); }
      @bottom-left { content: element(pageFooterLeft); }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9.5px; color: #6B7280; }
    }
    #print-header-left { position: running(pageHeaderLeft); }
    #print-header-right { position: running(pageHeaderRight); }
    #print-footer-left { position: running(pageFooterLeft); }

    ${i} {
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1F2937;
    }
    ${i} h1, ${i} h2, ${i} h3, ${i} h4, ${i} h5, ${i} h6 { color: #111827; font-weight: 600; margin: 0.6em 0 0.3em; }
    ${i} h1 { font-size: 20px; } ${i} h2 { font-size: 17px; } ${i} h3 { font-size: 15px; }
    ${i} p { margin: 0.5em 0; }
    ${i} a { color: ${r}; }
    ${i} ul { list-style: disc; padding-left: 20px; }
    ${i} ol { list-style: decimal; padding-left: 20px; }
    ${i} li { margin: 4px 0; }
    ${i} blockquote { border-left: 3px solid #D1D5DB; margin: 0.5em 0; padding: 0.2em 0 0.2em 0.9em; color: #4B5563; }
    ${i} mark { background: #FEF08A; border-radius: 3px; padding: 0 2px; }

    ${i} table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 0.5em 0; }
    ${i} th, ${i} td { border: 1px solid #D1D5DB; padding: 6px 10px; text-align: left; }
    ${i} th { font-weight: 600; }

    ${i} [data-callout] {
      border-left: 3px solid rgb(137, 75, 0);
      background: rgba(202, 138, 4, 0.08);
      color: rgb(137, 75, 0);
      border-radius: 0 6px 6px 0;
      padding: 0.6em 0.8em;
      margin: 0.5em 0;
    }
    ${i} [data-message-banner] {
      border-left: 3px solid ${r};
      background: color-mix(in srgb, ${r} 8%, transparent);
      color: #1F2937;
      padding: 0.6em 0.8em;
      margin: 0.5em 0;
    }
    ${i} [data-btn-link] {
      display: inline-block;
      background: ${r};
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
    ${i} .pf-field { padding: 4px 0; margin: 4px 0; break-inside: avoid; }
    ${i} .pf-label { font-weight: 600; font-size: 13px; margin: 0 0 4px; color: #111827; }
    ${i} .pf-required { color: #DC2626; margin-left: 2px; }
    /* Hint text is builder-facing guidance for filling the field out live -
       not something that belongs on the actual signed/printed document, so
       it's suppressed here rather than in ~/utils/formFieldStaticRender.ts
       (which still emits the markup - simplest single place to hide it, and
       keeps the static-render function's output identical between the two
       call sites that use it). */
    ${i} .pf-hint { display: none; }
    ${i} .pf-empty { font-size: 13px; color: #6B7280; font-style: italic; margin: 0; }
    ${i} .pf-answer-line { padding: 2px 0; font-size: 14px; min-height: 20px; }
    ${i} .pf-checkbox-row { display: flex; align-items: center; gap: 8px; }
    ${i} .pf-checkbox { width: 14px; height: 14px; border: 1px solid #9CA3AF; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; flex-shrink: 0; }
    ${i} .pf-checkbox-checked { background: ${r}; border-color: ${r}; }
    ${i} .pf-image { max-height: 160px; max-width: 100%; border-radius: 6px; border: 1px solid #E5E7EB; margin-top: 4px; }
    ${i} .pf-signature-image { max-height: 72px; max-width: 260px; display: block; }
    ${i} .pf-signature-line { height: 72px; border-bottom: 1px solid #9CA3AF; }
    ${i} .pf-signature-label { font-size: 11px; text-transform: uppercase; color: #6B7280; margin-top: 4px; }
    ${i} .pf-button { display: inline-block; padding: 0.5em 1.2em; border-radius: 8px; font-weight: 600; text-decoration: none; color: #fff; }
    ${i} .pf-button-primary { background: ${r}; }
    ${i} .pf-button-neutral { background: #6B7280; }
    ${i} .pf-button-error { background: #DC2626; }
    ${i} .pf-button-success { background: #16A34A; }
  `}export{t};