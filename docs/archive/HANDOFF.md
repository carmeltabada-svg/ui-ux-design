# Session Handoff — Retrieval Forms Document Builder (AMS)

## Project context
- App: Nuxt 4 + Nuxt UI v4 (Reka UI/Tailwind v4) + Tiptap v3 prototype "AMS" (Asset Management System).
- Working directory: `C:\Users\CarmelTabada\Documents\Assets\Artifacts\email-templates` — **not a git repo**.
- No real backend: `reactive({})` module-level stores in `app/data/retrievalForms.ts` and `app/data/templateRuntime.ts` act as the in-memory "database", hydrated from `localStorage` via `app/utils/formStorage.ts` / `app/plugins/formStorage.client.ts` on Nuxt's `page:finish` hook. **localStorage is per-origin** — different dev-server ports have separate, unrelated saved state.
- Dev server: started via the Browser tool's `preview_start` with `name: "dev"` (reads `.claude/launch.json`, runs `npm run dev`). Do **not** use Bash to run it.
- Focus area: the "Retrieval Forms" document builder — a Tiptap-based document canvas (`FormDocumentEditor.vue`) with real pagination via the 3rd-party `tiptap-pagination-plus` package, replacing an older sections/fields system.

## Standing instructions from the user (apply throughout, still in force)
1. **Prefer real toolkits/libraries over custom/manual implementations** wherever a feature is "heavy or complicated" — "a stable implementation is always preferred."
2. **Iterate with Playwright** (or live browser testing) **until genuinely satisfied**, not just claiming success — verify visually in the browser, don't just assume code is correct.
3. **Base all document specs** (margins, page size, header/footer spacing) **on real Microsoft Word docx standards**, not app-specific/custom values. Word "Normal" template: 1" (96px @ 96dpi) margins on all sides; header/footer distance ~0.5" from page edge.
4. Do not add features/UI beyond what's asked. Keep changes scoped.

## How the user communicates requests
The user sends large, numbered, screenshot-driven lists (5+ rounds so far, each 6–11 points), building on prior rounds. They expect **every point addressed**, with live browser verification, and will explicitly say "reject item N" to drop something mid-turn. Always give a **final consolidated status per point** when wrapping a round (done / partially done / not started, with why).

## Where things stand right now (read this first)
- **Latest work**: Round 8 (below) — Paged.js-based print/PDF pagination, decoupled from the live Tiptap editor. Shipped and verified in-browser (up to the point `window.print()` fires — see gotchas). **The user has not yet done a real OS print-to-PDF spot-check themselves** — that's the natural next check-in if picking this up.
- **Reference docs in the repo root**: `PAGINATION_TOOLKIT_STUDY.md` (the toolkit evaluation/spike that recommended Paged.js — read this before touching pagination again) and this file (`HANDOFF.md`).
- **Plan file for round 8**: `C:\Users\CarmelTabada\.claude\plans\polymorphic-honking-rivest.md` (approved plan, useful if you need the original scoping reasoning verbatim).
- **Open/unresolved from round 8**: the canvas editor's own header/footer overlap (unrelated to print now, since print no longer depends on the canvas's pagination) — not addressed this round, deliberately out of scope per the approved plan. Ask the user if it still matters to them.
- **Dev server**: multiple dev servers for this same project folder have been running across sessions/ports during this work (see the two distinct "gotchas" below — cold-compile stall vs. HMR corruption — before assuming a timeout or broken interaction is a real bug).

---

## Round 8 (this session) — real print/PDF pagination via Paged.js, shipped

After round 7 concluded `tiptap-pagination-plus` has no real per-page structure at all, the user reported it recurring yet again with new screenshots: canvas content overlapping header/footer, a nested "page inside a page" render in print/PDF, a stray line at the top of page 1, missing footers, header/footer overlap in print specifically (worse than the canvas), and asked directly whether a real toolkit switch — one that behaves like Word/Google Docs for edit, preview, *and* print/PDF — was warranted.

**Decision trail (what was discussed before writing any code):**
1. Recommended decoupling print/PDF generation from the live Tiptap editor (keep all custom fields/tables/placeholders untouched; render print/PDF separately) as the lower-risk option, vs. a full editor migration (CKEditor 5 Pagination — paid — or a full commercial doc editor) as the higher-cost option. **The user picked the decoupled option.**
2. The user then asked about *free* alternatives for the full-migration path (for future reference, not to execute). Answer given: no good free *lightweight* option exists — the only free options for genuine per-page WYSIWYG editing are **OnlyOffice Community Edition** and **Collabora Online** (both open-source, LibreOffice-based), but both are full self-hosted server applications editing real `.docx`/`.odt` files, not an npm package — a bigger architectural shift than the paid JS options, not a smaller one. Not pursued.
3. The user asked to scope out a real plan and do a spike before committing. **A separate session had already done exactly this** — a full technical study (`PAGINATION_TOOLKIT_STUDY.md`, repo root) and a working spike (since deleted, `app/pages/spike-pagedjs.vue`) recommending **Paged.js** (MIT, real CSS Paged Media implementation, already in `package.json` `dependencies`) scoped strictly to `/form-preview.vue`'s print/PDF path. This was surfaced to the user rather than redone.
4. Entered plan mode, explored the codebase (registry/field-node/letterhead/print-CSS surfaces), asked one more scope-clarifying question (see below), wrote a plan to `~/.claude/plans/polymorphic-honking-rivest.md`, got it approved, and **shipped it**.

**One scope question resolved via `AskUserQuestion` before implementing:** the study's spike rendered a *blank* template through Paged.js. Confirmed with the user that the real PDF needed to capture what was actually typed/checked/signed (matching "a signed copy has been emailed to you"), not just an accurate blank form — so this round also added real field-value capture, not just pagination. **This is the one thing to know if picking this up cold: the plan and the code both assume "print/PDF shows real answers," not a blank form.**

### What shipped
- **`app/utils/formFieldRegistry.ts`**: `FieldRegistryEntry` gained a `value: string` field (text/number as typed, checkbox as `'true'/'false'`, signature/file as a data URL, `''` if empty) — previously only tracked `filled` (a boolean), never the actual answer.
- **`app/components/masterData/SignaturePad.vue`**: added a second `v-model:data-url`, refreshed explicitly after every content-changing action (draw-end, clear, upload, remove, mode switch) — *not* via a reactive watch on `hasDrawn` alone, since `hasDrawn` flips true once on the first stroke and stays true, so a watch keyed off it would only ever capture the first stroke's pixels, not the final drawing.
- **`app/components/masterData/FormFieldNodeView.vue`**: file uploads now also produce a real (non-revoked) data URL alongside the existing object-URL preview; a new `value` computed feeds the registry per field type.
- **`app/utils/formFieldStaticRender.ts`** (new): `renderFormFieldsAsStaticHtml(html, values)` — turns the document's real `div[data-form-field ...]` markers (the only thing `FormFieldNode.renderHTML` ever emits — the actual visible markup only ever existed in the live Vue NodeView) into real static HTML showing each field's actual captured answer. This is the first-class version of the piece the study's spike stubbed out.
- **`app/utils/formPrintStyles.ts`** (new): `buildPrintCss(pageSize, margins, themeColor)` — one CSS string covering real `@page` size/margin plus `@top-left/@top-right/@bottom-left/@bottom-right` running-element rules for a genuinely repeating letterhead (via Paged.js's GCPM polyfill — plain Chrome print can't do this at all), plus a scoped subset of `.prose-tiptap`'s visual language (lists, tables, callout/banner/quote/button-link, the new static field-card look) since Paged.js doesn't inherit the app's own stylesheet.
- **`app/pages/form-preview.vue`**: added a `no-print` "Print / Save as PDF" button. On click: builds resolved+value-filled HTML, reveals a `v-show="printing"` print-root **before** running Paged.js into it (see gotcha below), awaits `Previewer().preview(...)`, then calls `window.print()`; `window.onafterprint` reverts back to the interactive view. The live interactive fill-out experience (typing/checking/signing) is completely unchanged — this only changes what happens at the moment of printing.
- Deleted the now-superseded `app/pages/spike-pagedjs.vue`.
- Added `app/types/pagedjs.d.ts` — a minimal ambient module declaration, since `pagedjs` ships no TypeScript types at all (confirmed: no `types`/`typings` field in its own `package.json`).

### A real bug hit and fixed during verification
First implementation ran `Previewer().preview(...)` into the print-root **while it was still `display: none`** (revealing it only after render completed, reasoning "don't flash an empty container"). This threw deep inside `pagedjs.js`: `TypeError: Cannot read properties of null (reading 'getBoundingClientRect')` — Paged.js's own layout/chunking logic needs the target actually laid out by the browser while it measures content; a `display:none` subtree gives it nothing to measure against. Fixed by revealing the (still-empty) print-root **before** calling `preview()`, not after — briefly showing a blank page while Paged.js renders, which is the correct integration order.

### Verified live in the browser (this session's own dev server, port 49910 — a different session's server was already running on this project and is not reachable from this session's Browser tool, a gotcha worth remembering)
- Typed a real answer into a text field, clicked "Print / Save as PDF": confirmed via direct DOM inspection (not just screenshot — see the tooling gotcha below) that the rendered print-root contains **3 real `[data-page-number]` pages**, the **actual typed answer** ("123 Test Street, Cebu City") in the printed field card, **zero raw `{{TOKEN}}`** placeholders, and a **repeating letterhead** (header + "Internal Use Only" footer) between page 1 and page 2 with a clean break and no overlap.
- Confirmed an empty file-upload field prints "No file attached." and an empty signature prints a blank line — sensible fallbacks, not broken markup.
- Confirmed the interactive fill-out view is completely unaffected after a print run (reloaded, still fully interactive).
- **`window.print()` is genuinely blocking in this sandboxed Browser tool** — it hangs waiting for a native dialog that never appears and can't be dismissed, freezing all further `computer`/`javascript_exec` calls on that tab until the tab is force-navigated away. Verified this is an environment limitation, not an app bug, by monkey-patching `window.print = () => {}` before clicking the button (a clean way to test the rest of the flow without tripping this) — confirmed both that `window.print()` really was called at the right point, and everything Paged.js rendered before that point was correct.
- **A real OS print-to-PDF spot-check by the user themselves is still needed** — this sandboxed tool fundamentally cannot drive that dialog. Everything up to the moment `window.print()` fires has now been directly verified; what the OS dialog/PDF itself produces from Paged.js's real per-page DOM has not (though this is exactly the scenario Paged.js's own `@page` polyfill is built for, per the study).

### Explicitly out of scope this round (per the approved plan)
- The canvas editor's own header/footer overlap (the user's first screenshot, showing overlap while *editing*) — `FormDocumentEditor.vue`/`tiptap-pagination-plus` were deliberately left untouched. **Still open** — the user has not yet said whether this still needs fixing given the print path no longer depends on it; ask, or re-investigate `scheduleBreakAvoidance()`/`scheduleHeaderFooterSpacing()` in `FormDocumentEditor.vue` if they say yes.
- No backend/persistence for captured field values — they only live for the current browser session, same constraint as everywhere else in this prototype.

### One more environment gotcha, hit right at the end of this round
After the implementation was verified, the user reported "the server timed out again." Investigated: this was **this session's own dev server's normal first-request cold-compile stall** for the Tiptap-heavy `/form-preview` route (already documented in `nuxt.config.ts`'s own comment about `vite.optimizeDeps` — a real, pre-existing characteristic of this stack, not something round 8 introduced). Confirmed via `preview_logs` that the server had actually finished compiling (`Vite server warmed up`, `Vite client warmed up`) and a fresh navigate loaded the page normally afterward. **If the user reports a timeout again, check `preview_logs` for the server in question first** before assuming a code regression — this has now happened at least twice in this project (also see round 6's Vite/HMR-corruption gotcha above, which is a *different* failure mode: that one needed a server *restart*, this one just needed to *wait for the first compile to finish*). Distinguish them: HMR corruption persists no matter how long you wait and only clears on restart; a cold-compile stall clears on its own once the log shows the build finished.

---

## Round-by-round history (condensed)

- **Round 1**: Wired an orphaned placeholder-insertion feature onto the Tiptap NodeView field editor (`FormFieldNodeView.vue`), gated by email-attachment state (`app/utils/formEmailAttachment.ts`, new provide/inject). Added an equivalent for inserting placeholders into the document's free-form body text (toolbar button, per user's choice).
- **Round 2**: Diagnosed slow view-switching — concluded it's Vite/Tiptap+ProseMirror cold-compile cost (real, not a bug), documented via `vite.optimizeDeps.include` in `nuxt.config.ts`.
- **Round 3** (8+ points): Fixed signature-lock tooltip clipping, field/page-break overlap, restored duplicate/delete/drag field controls, un-separated toolbar buttons, added margin settings, fixed header logo (`public/img/logo-goteam-only.svg`, extracted/flattened SVG), removed a stray blue divider line, improved preview accuracy, removed page-gap fill, added a table-size picker (`TableSizePicker.vue`), briefly restored then (per round 4) fully removed the "Text Block" field type. Extensive Playwright test setup (`playwright.config.ts`, `tests/e2e/*.spec.ts`, pointed at the session's own dev server port).
- **Round 4** (9 points, "add section" later rejected by user mid-turn): Real docx-like on-screen pagination research (concluded `tiptap-pagination-plus`, already in use, has no better alternative — kept it, patched around its limitations). Removed Text Block field type entirely. General principle reaffirmed: use toolkits, not manual code. Table auto-fills document width (fixed a `display:contents` CSS interaction bug from the pagination package). Form preview: removed navbar/logo/PDF button, relies on native browser print-to-PDF (no toolkit needed — already vector/selectable). Header/footer moved to 96px margins + 24px content gap (Word "Normal" template baseline). Fixed "create from blank"/"create from existing" content-copy bugs (`ensureFormContent`, `duplicateForm` fixes in `app/data/retrievalForms.ts`, `app/utils/formContentMigration.ts`).
- **Round 5** (9 points, this is the round in progress) — see below.

---

## Round 5 — the 9-point list (verbatim, condensed)

1. Background image in `/form-preview` renders **zoomed** (canvas is correct); remove document title from preview since it can be unreadable against some backgrounds.
2. Pages still aren't **visually separated as distinct docx-style pages** — still continuous scroll with divider lines.
3. "Create form from blank" / "from existing" → screen flash, then nothing happens.
4. Content still **overlaps header/footer** boundaries; should flow seamlessly to the next page like real MS Word.
5. Rename "History" (overflow menu) → **"Version History"**; slideover header should show the exact form title+description; body should contain **only** version entries; fix "Version 1" duplicating with the version badge; recommend a naming convention based on other products (Google Docs/Notion/GitHub).
6. Placeholder Library drawer: content-area top padding should be **10px** (was 24px); "Not used in this template" section should **not** be grayed out (`opacity-60` + muted text).
7. Header/footer should use the **real Microsoft Word standard** header/footer size and spacing from body content (not an app-specific approximation).
8. Tables insert with a **filled header background** by default — should insert with **no fill**; instead provide a real feature to: toggle a header row on/off, change the header's background color (text color auto-computed for contrast), and resize columns/rows.
9. PDF/print output should **not** include interactive behaviors or unresolved `{{PLACEHOLDER}}` tokens; PDF has layout/format issues (some headers/footers don't appear at all) — ensure page specs aren't custom/nonstandard so PDF rendering doesn't break, and headers/footers reliably appear.

### Round 5 status

| # | Status | Notes |
|---|--------|-------|
| 1 | ✅ Done | See "Point 1" below |
| 2 | ❌ Not started | Real docx-style discrete pages — likely needs deeper pagination work or accepting current limitations |
| 3 | 🔍 Investigated, not fixed | Root-caused as likely double-click-toggle behavior on dropdown triggers (see "Point 3" below); decided not to risk a custom click-interception fix |
| 4 | ✅ Done & verified (this session, round 6) | Real root cause found and fixed — see "Point 4" below |
| 5 | ✅ Done & verified | See "Point 5" below |
| 6 | ✅ Done | See "Point 6" below |
| 7 | ✅ Done & verified (this session, round 6) | Real Word-accurate spacing, dynamically measured — see "Point 7" below |
| 8 | ✅ Done & verified | See "Point 8" below |
| 9 | 🟡 Partial (this session, round 6) | Print break-point structural bug fixed + unresolved `{{TOKEN}}`s now resolved for print/preview + interactive-only controls hidden from print. Native print/PDF output itself (via OS print dialog) could **not** be verified in this sandboxed browser tool — needs a real spot-check. See "Point 9" below |

---

## What was completed THIS session (detail, for continuing)

### Point 1 — Background zoom + title removal (done)
**File:** `app/pages/form-preview.vue`
- Replaced the background-on-scrollable-container approach with a `fixed inset-0 -z-10` layer (`no-print`) sized to the viewport, matching how the builder canvas's background renders (short, viewport-sized panel) instead of `background-size: cover` scaling against the whole (very tall, multi-page) scrollable document — which is what caused the zoom/crop.
- Removed the `<h1>` document-name heading from the preview (it sat directly on the background and wasn't always readable) — the document's own letterhead already carries the name.

### Point 5 — Version History (done & verified in-browser)
**Files:** `app/pages/templates/forms/[id]/edit.vue`, `app/components/masterData/FormHistoryTab.vue`
- Menu item label: `'History'` → `'Version history'` (`overflowMenuItems` computed).
- `USlideover` for history: removed the generic `title="History"` prop; added a custom `#header` slot rendering `{{ name || 'Untitled form' }}` (truncated) + `{{ description }}` (line-clamped) — the form's real, live title/description refs, plus its own close button.
- `FormHistoryTab.vue`: removed its internal `<h3>Version history</h3>` + description `<p>` block (now redundant — the slideover header carries this). Body is now purely the version-entry list.
- `historyEntries` computed in `edit.vue`: first entry's `label` changed from `'Version 1'` → `'Initial version'` — the `v1` badge already shows the number, so `"Version 1"` next to badge `"v1"` was a literal duplicate. Comment in code documents the Google Docs/Notion-style reasoning (first entry gets a distinct name rather than restating a count shown elsewhere).
- **Verified live**: slideover opens, header shows exact title + description, body shows only the "Initial version" / "Current" / "v1" card with actor + timestamp, no duplicate text.

### Point 6 — Placeholder Library drawer (done, from earlier in this session per prior summary — confirmed still in place)
**File:** `app/components/email/PlaceholderDrawer.vue` (Nuxt auto-import name `EmailPlaceholderDrawer`)
- Content area class: `px-4 py-4 sm:px-6 sm:py-6` → `px-4 pt-[10px] pb-4 sm:px-6 sm:pb-6` (10px top padding).
- "Not used in this template" section: removed `opacity-60`, changed `text-muted` → `text-default` on the token buttons.

### Point 8 — Table styling (done & verified in-browser, most involved work this session)
**New file:** `app/components/email/TableControls.vue` — contextual toolbar controls (rendered only when `editor.isActive('table')`):
- "Add/Remove header row" toggle button (`editor.chain().focus().toggleHeaderRow().run()`), icon `i-lucide-rows-2`.
- "Header color" popover: a "No fill" (x) swatch plus 6 preset colors. Critically, **applies the color to the entire header row**, not just the currently-selected cell — implemented via a custom Tiptap command that walks the table's first row and calls `tr.setNodeAttribute(cellStart, 'backgroundColor', color)` on every `tableHeader` cell (an earlier version used `editor.chain().updateAttributes('tableHeader', {...})`, which only touched the single cell the cursor was in — fixed).

**Extension:** `app/utils/tiptapExtensions.ts` already had `TableHeaderStyled` (extends `@tiptap/extension-table-header`'s `TableHeader` with a `backgroundColor` attribute, rendering an inline `style="background-color:...;color:..."` where text color is computed via `contrastingTextColor()` — WCAG relative-luminance formula) — this was pre-existing from before this session's summarized portion, just not yet wired in.

**Wired into 3 editors** (previously each independently imported plain `TableHeader` and used `Table.configure({ resizable: false })`):
- `app/components/masterData/FormDocumentEditor.vue` — the primary forms canvas (priority, matches user's screenshot).
- `app/components/email/BodyField.vue` — email body editor.
- `app/components/masterData/StaticTextEditor.vue` — static text editor.

All three: `TableHeader` → `TableHeaderStyled` import/extension swap, `Table.configure({ resizable: false })` → `Table.configure({ resizable: true })` (enables Tiptap's built-in column/row drag-resize).

**CSS:** `app/assets/css/main.css` — removed the default `.prose-tiptap th { background: var(--ui-bg-elevated); ... }` fill (kept `font-weight: 600`), so a freshly-inserted table has no fill until a color is explicitly chosen via the new control.

**Toolbar wiring:** `app/components/email/BlockToolbar.vue` — added `<EmailTableControls :editor="editor" />` right after `<EmailTableSizePicker :editor="editor" />`. This toolbar is shared by the forms document toolbar (`FormDocumentToolbar.vue` → `EmailBlockToolbar ... flush`), the email composer, and static text fields, so table controls now appear consistently everywhere tables can be edited.

**A real bug hit and fixed along the way** (important pattern lesson for future work in this codebase): the first draft of `TableControls.vue` used `computed(() => { tick.value; return props.editor?.isActive('table') ?? false })` for the show/hide logic, following the same `tick`-ref-plus-event-listener pattern as `BlockToolbar.vue`. It silently never worked — the toolbar never showed the table controls even when `editor.isActive('table')` was independently confirmed `true`. Root cause: `computed()` only **recomputes** when a tracked reactive dependency (`tick.value`) actually **changes**; a pure cursor move into/out of a table (no document mutation) doesn't reliably fire the `transaction`/`selectionUpdate` listeners that increment `tick`, so the computed stays cached at its stale mount-time value forever. `BlockToolbar.vue`'s own `isActive()` — which *does* work reliably — is a **plain function**, re-evaluated fresh on every render (which happens via other reactive cascades, e.g. content changes bubbling from `v-model` bindings), not a memoized computed. **Fix:** changed `inTable`/`hasHeaderRow` from `computed()` to plain functions, called as `inTable()`/`hasHeaderRow()` in the template. This is now documented in a code comment in `TableControls.vue` — **remember this pattern** if adding more reactive toolbar state tied to editor selection: use plain functions, not `computed()`, unless there's a real guaranteed dependency to track.

**Verified live in browser** (after fixing a leftover stray `})` syntax error that briefly 500'd the dev server, and after discovering the dev server's Vite/HMR state can get stuck — see "Known gotcha" below):
- Fresh 2×2 table insert → no fill, confirmed via DOM inspection and screenshot.
- Clicked into header cell → table controls appear in toolbar (rows-2 icon + paint-bucket icon).
- Clicked out of table → controls correctly disappear, Bold/list state correctly reflects the paragraph clicked into (confirms general toolbar reactivity works).
- Applied a color via the swatch popover → **entire header row** filled with that color, text auto-white (was previously only coloring the single cell before the row-wide fix).
- Toggled "Remove header row" → header row's `<th>` cells and their colors correctly cleared/reverted; toggled back → "Add header row" button correctly relabels.

### Known gotcha discovered this session — dev server / Vite HMR corruption
After a genuine syntax error (leftover stray `})` in `TableControls.vue`) caused a Vite 500 error, the dev server on port `49153` was left in a corrupted-enough state that a specific dropdown (`UDropdownMenu` for "More actions" in `edit.vue`) stopped opening entirely — not a real code regression, confirmed by:
1. Extensive introspection (walking Vue component instances via `__vueParentComponent`, checking `data-state`/`aria-expanded` attributes, even a raw JS `.click()`) — all showed the dropdown genuinely never opening, no thrown errors in console.
2. **Restarting the dev server process** (`preview_stop` + `preview_start`, which happened to reassign a new port `49587` since the old port was still held) fixed it immediately — same code, same button, opened correctly on the very first click.

**Lesson:** if a previously-working interactive element (especially a Reka UI/Radix-style dropdown or popover) mysteriously stops responding mid-session with no console errors, after a Vite compile error occurred at some point earlier in the session, **try a full dev-server restart before debugging the component further** — it's very likely stale HMR module state, not a real regression. Also note: **switching dev-server port means a fresh localStorage origin** — all previously-entered test data (typed text, table edits, etc.) won't carry over; re-seed/re-test from scratch on the new port going forward, or restart the server on the *same* port if that matters (not verified whether that's possible with this `preview_start` tool — it auto-picked a new port when the old one was still bound).

**Current live dev server**: `serverId: 10361424-f81a-43f5-9889-f50d5755b621`, port `49587` (started via `mcp__Claude_Browser__preview_start` with `name: "dev"`). The originally-used port `49153` server was explicitly stopped this session.

---

## Files touched this session (cumulative across all rounds — for a full-repo orientation)

**New files created:**
- `app/utils/formEmailAttachment.ts` (round 1)
- `app/components/masterData/FormDocumentToolbar.vue` (round 3)
- `app/components/email/TableSizePicker.vue` (round 3)
- `public/img/logo-goteam-only.svg` (round 3)
- `playwright.config.ts`, `tests/e2e/form-document-nested.spec.ts`, `tests/e2e/form-duplicate.spec.ts` (round 3)
- `app/components/email/TableControls.vue` (round 5, this session)

**Heavily modified files** (see round-by-round detail above for specifics):
- `app/components/masterData/FormFieldNodeView.vue`
- `app/components/masterData/FormDocumentEditor.vue`
- `app/components/email/BlockToolbar.vue`
- `app/data/retrievalForms.ts`
- `app/utils/formContentMigration.ts`
- `app/pages/templates/forms/[id]/edit.vue`
- `app/pages/templates/index.vue`
- `app/pages/form-preview.vue`
- `app/components/email/PlaceholderDrawer.vue`
- `app/utils/tiptapExtensions.ts`
- `app/assets/css/main.css`
- `app/utils/formLetterhead.ts`
- `nuxt.config.ts`
- `app/components/email/BodyField.vue`
- `app/components/masterData/StaticTextEditor.vue`
- `app/components/masterData/FormHistoryTab.vue`

---

## Recurring technical concepts worth knowing before continuing

- **`tiptap-pagination-plus`**: 3rd-party npm package for simulated on-screen pagination. Uses pure accumulated-pixel-height math (no per-node/atomic-block awareness) — this is *why* fields/headings can straddle a page break (mitigated by `scheduleBreakAvoidance()` in `FormDocumentEditor.vue`, which measures and nudges `margin-top` on whole blocks so they land cleanly on one page). It injects its own CSS including `table { display: contents }` (root cause of a past table-width bug — width rules must target `tbody`, not `table`). Config: `pageHeight`, `pageWidth`, `marginTop/Bottom/Left/Right`, `contentMarginTop/Bottom` (currently `CONTENT_MARGIN = 24`), `headerLeft/Right`, `footerLeft/Right`, `pageBreakBackground: 'transparent'`. Internally: `pageContentAreaHeight = pageHeight - (contentMarginTop + marginTop + headerHeight) - (contentMarginBottom + marginBottom + footerHeight)` (see `node_modules/tiptap-pagination-plus/dist/utils.js` / `PaginationPlus.js` if investigating points 2/4/7 further).
- **`scheduleBreakAvoidance()`** in `FormDocumentEditor.vue`: measures `[data-form-field], h1–h6` against `.breaker` page-gap elements after layout settles (double `requestAnimationFrame`), nudges `margin-top` on any block whose box straddles a break so it moves whole to the next page. Uses a `lastNudgeSignature` string comparison to avoid infinite recursion against the package's own async re-measurement. Bounded to `MAX_BREAK_AVOID_PASSES = 4`.
- **Reka UI (Radix-Vue-style) dropdown/popover timing**: a recurring class of bug in this codebase. `nextTick()` (microtask) is *not* enough to avoid "flash open then immediately close" — needs `v-model:open` tracking + a genuine `setTimeout(..., 160)` macrotask delay + a `wantsXPicker` intent-flag pattern (see `overflowMenuOpen` watcher in `edit.vue` for the canonical example, with an extensive code comment explaining why). **Also**: a genuine *double-click* on a dropdown trigger toggles it open-then-closed — this is standard behavior, not a bug, and was identified as the likely explanation for the user's round-5 point 3 "flash, nothing happens" report on the "Create Form" button. Decided not to patch (risk/reward), but worth revisiting if the user pushes back again.
- **Vue reactivity pattern for editor-toolbar active-state**: use **plain functions**, not `computed()`, when the state depends on `editor.isActive(...)`/selection and needs to update on pure selection changes (not just content mutations) — see the Point 8 bug writeup above.
- **SSR vs CSR / localStorage**: `/form-preview.vue` uses `definePageMeta({ layout: 'blank', ssr: false })` deliberately (localStorage-only data source, avoids a flash-of-wrong-content hydration mismatch). An attempt to apply the same to the forms `edit.vue` page was tried and **reverted** earlier (correlated with new `VUE_ROUTER_R0020` warnings, deemed too risky to pursue further).
- **Word-standard specs referenced**: 1" margins (96px @ 96dpi) all sides = `DEFAULT_PAGE_MARGINS` in `app/data/retrievalForms.ts`; header/footer distance from page edge ≈ 0.5" in real Word. Current `CONTENT_MARGIN = 24` (quarter inch) is a round-4 approximation the user wants refined further (point 7) to actually match Word's real header/footer-to-body spacing rules, not just "a generous gap."

---

## What was completed in round 6 (this session, continuing from round 5)

### Point 4 — content overlapping header/footer (real root cause found & fixed)
**File:** `app/components/masterData/FormDocumentEditor.vue`
The previous session's `scheduleBreakAvoidance()` was querying `[data-form-field]` to find field blocks to protect from straddling a page break. That attribute is emitted by `FormFieldNode`'s `renderHTML` in `app/utils/formFieldNode.ts` — but the field actually renders through a **custom Vue NodeView** (`FormFieldNodeView.vue`, via `NodeViewWrapper`), which never goes through `renderHTML` at all. The NodeView's real root attribute is `data-form-field-node`. So the selector matched **zero** fields, silently, for the entire time this logic has existed — only headings (`h1`-`h6`) were ever actually protected. Fixed both the JS selector and the CSS `break-inside: avoid` backstop to use `data-form-field-node`. Verified live: a field ("Authorized Alternate Receiver") that was previously split across a page boundary (its box straddling the gap, its input line rendering below the *next* page's header) now lands whole on its own page.

### Point 7 — real Word-accurate header/footer spacing (dynamic, not a fixed guess)
**File:** `app/components/masterData/FormDocumentEditor.vue`
Real Word behavior: header/footer *text* sits 0.5" from the page edge; body text starts at the page's own margin (1" default) regardless of header height, unless the header is taller than that reserved band (then Word pushes body down further). `tiptap-pagination-plus` doesn't model a "reserved band" — it unconditionally stacks `marginTop + contentMarginTop + headerHeight` before body starts. Fixed by:
- Feeding the package `HEADER_FOOTER_INSET = 48` (0.5") as its `marginTop`/`marginBottom` — this is genuinely what controls where header/footer text starts (via the package's own `padding-top: var(--rm-margin-top)` CSS).
- Added `scheduleHeaderFooterSpacing()`, called from the same sites as `scheduleFooterRecount()`/`scheduleBreakAvoidance()` — measures the header/footer's real rendered height (`.rm-first-page-header .rm-page-header-content` / `.rm-page-footer-content`, **not** a generic `.rm-page-header-content` query — that would match the hidden trailing header instead, a bug caught and fixed mid-session) and computes `contentMarginTop`/`contentMarginBottom` so body still lands at the page's own configured margin in the common case where the header/footer fit within the reserved band, clamped to a `MIN_CONTENT_GAP = 8px` floor.
- Verified live: header text now sits close to the page edge, body starts right after with a natural (not overly generous) gap, on both `/form-preview` and the builder's edit canvas.

### Point 9 — partial (print/PDF correctness)
**Files:** `app/pages/form-preview.vue`, `app/data/templates.ts`, `app/components/masterData/FormFieldNodeView.vue`, `app/components/masterData/SignaturePad.vue`
- **Unresolved `{{PLACEHOLDER}}` tokens**: added `resolveTokensForPrint(html, samples)` next to the existing `wrapTokens()` in `app/data/templates.ts` — same regex, but returns the plain resolved value (or `''` if no sample exists) instead of a highlighted span that still shows the raw `{{CODE}}` text. Wired into `form-preview.vue`'s `content` computed via `SAMPLE_VALUES` (same simulated-data pattern the page already used for its ticket ref) — this resolves on-screen too, not just for print, since this page is genuinely "what a recipient sees," not just an editing surface.
- **Print break-point structural bug**: `tiptap-pagination-plus`'s own DOM doesn't nest "page N+1's header" inside "page N+1's own `.rm-page-break`" — it appends it to the *end* of page N's `.rm-page-break` instead (confirmed by reading the package source and the live DOM: each break element = `[page content, footer, gap, next page's header]`). The old print CSS forced `break-before: page` on `.rm-page-break + .rm-page-break`, which breaks *after* the next header instead of before it — stranding that header at the bottom of the previous page (a likely cause of "headers/footers don't appear at all" in print, since Chrome's print engine often drops a floated element left in the wrong spot like that). Fixed by moving the forced break to `.rm-page-header:not(.rm-first-page-header)` instead — the header is the genuinely correct break point.
- **Interactive-only affordances hidden from print**: added `no-print` (Tailwind-agnostic, plain class already defined by `form-preview.vue`'s own print styles) to the file-upload field's "Choose file"/"No file chosen"/remove-file controls (`FormFieldNodeView.vue`) and the signature pad's Draw/Upload/Clear/Remove toolbar row (`SignaturePad.vue`).
- **Not verified**: actual native print/PDF output (via the OS print dialog / Ctrl+P → Save as PDF) — this sandboxed browser tool has no way to drive or screenshot a real print preview. The structural fix is based on solid source-level + live-DOM reasoning, but **needs a real spot-check** (open `/form-preview` in an actual browser, print to PDF, confirm every page's header/footer shows up in the right place and no raw `{{CODE}}` survives).

### A testing-environment gotcha worth remembering
This session initially saw `scheduleHeaderFooterSpacing()` appear to silently fail — `requestAnimationFrame` genuinely does **not** tick on its own in this Claude Browser Tool's preview pane; it only advances when something explicitly requests a paint (e.g. a `computer{screenshot}` call). Confirmed directly: a `requestAnimationFrame` loop counter stayed at `0` after a real 500ms wait, then advanced only once a screenshot was taken. This is **not** a real app bug — a normal Chrome tab always pumps rAF continuously. When testing anything gated behind `requestAnimationFrame` in this tool, take 1-2 `computer{screenshot}` calls after the change before concluding something didn't apply.

---

## Round 7 — this session's 8-point list (verbatim, condensed)

1. "Create form from existing" now works; "Start from blank" still just flashes and opens nothing.
2. Pages still only look separated by thin lines, not physically/visually separated - investigate why.
3. No hover behavior on tables.
4. Version History drawer header should be a fixed "Version History" / "Every saved change to this template's content." — not the form's own name/description (this reverses round 5 point 5's choice; the user changed their mind).
5. Field text overlaps with no truncation (all field types) — implement truncation, and the hover action buttons (duplicate/remove/settings) should float **outside** the field, not sit inside where they can overlap content.
6. Header/footer-to-body spacing is now **too close** — base it on the real Microsoft Word standard.
7. Print/PDF output formatting is inaccurate — actually test it and find the bugs.
8. Research a more stable toolkit alternative, similar to Google Docs.

### Round 7 status

| # | Status | Notes |
|---|--------|-------|
| 1 | ✅ Done & verified | Real root cause: a client-side navigation race (see below) |
| 2 | ✅ Done & verified | Gray "desk" backdrop + visible page-gap fill — see below |
| 3 | ✅ Done & verified | Missing Tiptap table CSS (selected-cell tint, resize handle, cell hover) — see below |
| 4 | ✅ Done & verified | Reverted to fixed title/description in `edit.vue`'s `USlideover` `#header` |
| 5 | ✅ Done & verified | Truncation + floating action buttons — see below |
| 6 | ✅ Done (visual improvement, not independently re-verified pixel-by-pixel) | Reverted the round-6 "smart" dynamic-measurement version back to a **fixed** Word-accurate gap — see below for why the "smart" version was actually the bug |
| 7 | 🟡 Partial — real architectural finding, **not fully fixable via CSS** | See below; also reverses part of round 6's print fix, which turned out to be based on a wrong DOM assumption |
| 8 | 🟡 Research only, no code change | See recommendation below — this is a decision for the user, not something to execute unasked |

---

## What was done in round 7 (detail)

### Point 1 — "Start from blank" flash (real root cause, fixed)
**File:** `app/pages/templates/index.vue`
Reproduced live: clicking "Start from blank" closed the dropdown but never navigated. Root cause: `createForm()` navigated straight to the literal route `/templates/forms/new/edit`, and *that* page's own `setup()` detected `id === 'new'`, created the draft, and did a **second** `navigateTo(..., { replace: true })` right back to back with the first — two SPA navigations landing in the same in-flight Vue Router transition, and the second got silently dropped. Loading the same URL directly (a full page load, not an SPA transition) worked fine, which is what made it look inconsistent. Fixed by creating the draft **eagerly** in `index.vue` itself (mirroring how `createTemplate()` already does it for email templates) and navigating directly to the real id — only one navigation, nothing to race.

### Point 2 — pages not visually separated (fixed)
**File:** `app/components/masterData/FormDocumentEditor.vue`
Round 4/6 had `pageBreakBackground: 'transparent'` (reasoning: "the page's own drop-shadow already separates them"), but that drop-shadow is on `.rm-with-pagination` — the entire multi-page column, not each page — so it only ever shows once, at the very top/bottom of the whole document. Between any two pages there was nothing but two 1px border lines and blank space, reading as one continuous scroll. Fixed: `pageBreakBackground: '#E4E4E7'` (a real gray fill in the gap) plus a matching gray backdrop on the builder's own canvas panel (`.form-document-editor-canvas-backdrop`, applied only when `!naturalScroll` so `/form-preview`'s own user-picked background still shows through undisturbed). Now reads as genuine physical gaps between white sheets, same visual language as Word/Google Docs.

### Point 3 — no table hover behavior (fixed)
**File:** `app/assets/css/main.css`
`Table.configure({ resizable: true })` was already wired in, but Tiptap's table extension draws **nothing** for cell selection or column resize without its own documented CSS (`.selectedCell:after`, `.column-resize-handle`, `.resize-cursor`) — none of it existed in this app. Added Tiptap's standard CSS for those, plus a `td:hover`/`th:hover` background tint so a table reads as an interactive grid. Verified live: hovering a cell tints it, hovering a column boundary shows a visible blue resize handle.

### Point 4 — Version History header text (reverted per new instruction)
**File:** `app/pages/templates/forms/[id]/edit.vue`
Round 5 point 5 had changed the slideover's `#header` to show the form's own live name/description. This round the user asked for that reversed — a fixed "Version history" title and "Every saved change to this template's content." description, regardless of which form it is. Done.

### Point 5 — field text truncation + floating hover actions (fixed)
**File:** `app/components/masterData/FormFieldNodeView.vue`
Reproduced via the user's own screenshot pattern: an unbroken long string (no spaces) in a field's label overflowed straight through the field's own border into the page margin — no field type had any width constraint or truncation on its label. Added `truncate`/`min-w-0` (with the necessary `min-w-0` on flex-row ancestors, since a flex child won't shrink below its content size without it) to every field type's label rendering: short_text/paragraph/number, checkbox, file_upload, signature, and button_link (the last one needed the `UButton`'s own `ui.base` given `min-w-0` too, since `truncate` on a slot's inner span does nothing if the button's own flex box never shrinks past its content). Verified live by setting an 87-character unbroken label on a button-link field — it now truncates with an ellipsis and stays fully inside the field's card.

The duplicate/remove/settings buttons (shown on hover) used to sit `absolute top-1.5 right-1.5` — *inside* the field's own padding, where they could visually collide with long/wrapped content. Moved them to `-top-3 right-2` with their own background/border/shadow, so they float just above the field's top border as a small independent toolbar instead of overlapping whatever the field displays.

### Point 6 — header/footer spacing "too close" (fixed by *removing* the round-6 "smart" logic)
**File:** `app/components/masterData/FormDocumentEditor.vue`
Round 6 added `scheduleHeaderFooterSpacing()`, which measured the *actual* rendered header/footer height and shrank the gap to compensate, reasoning "body should land at the configured margin." That was actually the wrong model: real Word does **not** shrink the header-to-body gap based on how tall the header content is - header text sits at a **fixed** 0.5" from the edge, body starts at a **fixed** 1" (or whatever margin is configured), full stop; a header taller than that just visually overlaps rather than pushing body down. Since this app's letterhead (logo + address line, ~43px) nearly fills the 0.5" reserved band, the "smart" shrinking left almost no gap at all - reads as cramped, which is exactly what the user reported. Removed `scheduleHeaderFooterSpacing()` entirely and went back to one fixed formula: `contentMarginTop/Bottom = max(MIN_CONTENT_GAP, margin - HEADER_FOOTER_INSET)`, not reduced by measured content height.

### Point 7 — print/PDF accuracy (partial; real architectural finding)
**Files:** `app/pages/form-preview.vue`, `app/data/templates.ts`
Two independent things were done here:
- **Unresolved `{{TOKEN}}` placeholders**: `resolveTokensForPrint()` (added in `app/data/templates.ts` next to the existing `wrapTokens()`) now substitutes real `SAMPLE_VALUES` into the document content before it's rendered on `/form-preview` at all - a raw `{{CODE}}` never reaches the screen or a printed copy.
- **The break-point CSS "fix" from a prior round was reverted** after actually inspecting the live DOM tree (not just the package's source) more carefully: every one of `tiptap-pagination-plus`'s per-page decorative elements (`.rm-page-header`, `.rm-page-footer`, `.page`, `.breaker`, for *every* page) lives inside **one single widget** (`#pages.rm-pages-wrapper`) inserted **before all of the document's real content** - none of it is interleaved with the real paragraphs/fields at their actual page-boundary position. The on-screen "separate pages" look is achieved *purely* through 100%-width floats narrowing the following real content's line boxes, not through any real per-page DOM structure. Forcing `break-before: page` on a `.rm-page-header` (what the prior round did) breaks between two decorative widgets sitting right next to each other at the very start of the document - it cannot land the break where page 2 of the *real* content is supposed to start, and very plausibly explains "headers/footers don't appear, formatting is wrong" as a regression from that earlier fix, not an improvement.
  The print CSS now forces **no** explicit breaks at all - the fake on-screen page height already equals the real `@page size` (both come from the same `PAGE_SIZES` table), so the browser's own default height-based print pagination lands close to the same boundaries already shown on screen, without needing to say so. This is a **best-effort**, not a guaranteed-correct fix: floats fragmenting across a real printed page boundary are a known weak spot in browser print engines, and the header/footer chrome will not necessarily repeat exactly once per physical page.
- **Still not verified against a real OS print dialog** - this sandboxed browser tool cannot drive one (confirmed directly: pressing Ctrl+P produces no visible/screenshot-able native dialog, and a `requestAnimationFrame` counter test earlier this session already showed this tool doesn't drive normal browser timing without an explicit paint request either). **The user needs to actually open `/form-preview` in their own browser and print-to-PDF to confirm this.**

### Point 8 — toolkit research (no code change - a decision for the user)
The round-7 investigation above is itself the strongest evidence gathered so far: `tiptap-pagination-plus` is fundamentally a **screen-only visual simulation** with no real per-page document structure, which is *why* points 2/6/7 keep recurring in slightly different forms each round - there is no true "page 2 starts here" marker in the actual document for anything (CSS breaks, height math, or otherwise) to hook into.
Options, roughly in order of effort:
1. **Cheapest, most robust**: stop trying to make print match the on-screen simulation pixel-for-pixel. Let the browser's native auto-pagination handle printed output (already done this round), and accept the on-screen "pages" as an editing convenience, not a print contract - this is what many production editors (Notion, Confluence, Linear) actually do: continuous-flow editing, with export/print handled as its own separate, simpler concern.
2. **If genuine on-screen WYSIWYG pagination (edit-time, matching print exactly) is a hard requirement**: that needs a toolkit built for it from the ground up, not a small community package retrofitted onto Tiptap. The realistic, actively-maintained options are commercial: **CKEditor 5's Pagination premium feature** (built specifically for this, real per-page DOM), or a full document-editor component like **Syncfusion Document Editor** / **DevExpress Rich Text Editor** / **OnlyOffice**. All of these mean migrating off Tiptap - a genuinely large effort given how much of this app (FormFieldNode, the letterhead system, table controls, etc.) is already built directly on Tiptap/ProseMirror APIs. **Not something to start without the user explicitly signing off on the migration cost** - flagging it here as the honest answer to "is there a more stable toolkit," not executing it.

---

Always **verify visually in the browser** before reporting any point done, per the user's standing instruction - several "looks right in code" assumptions in this session turned out to need visual confirmation (the `data-form-field` vs `data-form-field-node` mismatch from round 6, and now the print break-point reasoning in round 7, are the same lesson twice: reading the package's source is not a substitute for reading the actual live DOM it produces).
