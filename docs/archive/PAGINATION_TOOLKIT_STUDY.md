# Technical Study — Replacing/Augmenting Pagination for Retrieval Forms

**Goal:** find a free toolkit that gives the Retrieval Forms document builder genuinely accurate, print/PDF-correct pagination, **without** touching the custom Tiptap content this app already depends on: placeholders (`{{TOKEN}}`), the field-type system (`FormFieldNode`), `Callout`, `MessageBanner`, `QuoteCommand`, `ButtonLink`, table controls, letterhead.

**Why this study exists:** the current package (`tiptap-pagination-plus`) turned out to be a pure on-screen CSS illusion with no real per-page document structure (see `HANDOFF.md`, round 7). Two prior in-place fixes to it (rounds 6 and 7) each looked reasonable from the source code alone and turned out to be wrong once the *live DOM* was actually inspected. This study is written to avoid repeating that pattern — every claim below is checked against the real registry/repo data, not assumed from a library's README alone.

---

## 1. What this app actually needs, precisely

- **Editing** stays exactly as it is: Tiptap/ProseMirror, Vue 3 NodeViews (`FormFieldNodeView.vue`), all custom extensions in `app/utils/tiptapExtensions.ts` and `app/utils/formFieldNode.ts`.
- **Two separate output concerns** currently conflated by the existing package:
  1. An on-screen approximation of "what page am I on" *while editing* (nice-to-have, not print-critical).
  2. The actual thing a real person receives: `/form-preview.vue`'s browser print → PDF, handed to a company member to sign/fill.
- The business reason this matters: forms are meant to be buildable/editable by the **Asset team themselves**, without a developer — so whatever we do here has to keep being reliable without a dev re-checking every template.

---

## 2. Options evaluated

### 2.1 `@adalat-ai/page-extension` (npm: `tiptap-pages` on GitHub) — ❌ disqualified

Sounded promising (binary-search overflow detection, built-in header/footer support, per-project test suite of 69 unit + 112 Playwright tests, MIT license). **Fetched its own README directly** — it explicitly requires **React 18+**. This app is Vue 3 (`@tiptap/vue-3`) end to end, including every custom NodeView. There is no way to use a React-only Tiptap extension in a Vue Tiptap instance without a full parallel React runtime embedded in the page, which is not a serious option. **Ruled out on a hard compatibility fact, not a judgment call.**

### 2.2 `tiptap-pagination-breaks` (npm) — ❌ not viable as-is

Checked the npm registry directly:
- **Last published February 19, 2025** — over a year and a half stale versus this app's current stack.
- **Peer/core dependency: `@tiptap/core ^2.8.0`.** This project runs **Tiptap 3.31.2** everywhere (`@tiptap/vue-3`, `@tiptap/core`, `@tiptap/extension-table`, etc. all pinned to `3.31.2`). Tiptap 2→3 was a breaking major version change (ESM-only, extension API changes, `@tiptap/pm` restructuring). Installing a v2-targeted extension into a v3 project risks anything from install-time peer-dep conflicts to silent runtime breakage in the extension's own ProseMirror plugin registration.
- Would require someone to fork and upgrade it to Tiptap 3 before it's usable here at all — at that point it's no longer "installing a maintained toolkit," it's adopting an abandoned one and maintaining it ourselves.

### 2.3 Tiptap Pages (official, tiptap.dev) — ❌ ruled out by the "free" requirement

Tiptap's own team ships an official pagination package now (`tiptap.dev/docs/pages`) — genuinely the "right" long-term answer architecturally, since it's built by the same team that owns the editor and would follow Tiptap's own NodeView/Vue integration correctly. **It's part of a paid Tiptap subscription tier**, not the free/open-source package set. Noted here for completeness/future reference, not pursued further per this round's explicit "free toolkit" requirement.

### 2.4 OnlyOffice / Collabora Online (self-hosted, free/open-source) — ❌ wrong shape of "free"

These are genuinely free (AGPLv3) and produce real, Word-accurate documents — because they *are* a real office suite (LibreOffice/OnlyOffice's own document engine) exposed via an iframe + JS API. Adopting one means:
- Editing real `.docx` files through their engine, not HTML through Tiptap.
- Every custom concept this app has — field types, `{{TOKEN}}` placeholders, callouts, the letterhead system — would need to be rebuilt as macros/plugins/custom XML inside that engine, or abandoned.
- A whole separate server process to deploy and operate (this project currently has **no backend at all** — this would be the single biggest infrastructure addition in the project's history for one feature).

This is a full editor replacement, not something that sits "side by side" with the current Tiptap investment. Ruled out for this ask specifically (still worth naming for the user in case "no dev intervention, ever" becomes a much bigger future requirement than a print-accuracy fix).

### 2.5 Paged.js (`pagedjs` on npm, MIT) — ✅ closest fit, with real caveats

Fetched the npm registry directly rather than trusting the marketing framing:
- **License:** MIT. **No framework peer dependency at all** (not React-only, not Vue-only — it operates on plain DOM/HTML+CSS, which is exactly why it can sit next to Tiptap without caring what rendered that HTML).
- **Maintenance reality, stated plainly:** the last *stable* release (`0.4.3`) shipped **June 2023** — three years old as of this study. The actively-developed next version (`0.5.0-beta.2`) has been in beta for a long time and has an open, unresolved issue reporting a **significant performance regression** versus 0.4.3. Read plainly: this is a real, useful, spec-accurate library, but it is not a fast-moving, heavily-funded project right now. That's a legitimate risk factor for "will this still be a healthy dependency in two years," not just a formality.
- **Real architectural fit, confirmed by design (not assumed):** Paged.js implements the actual CSS Paged Media spec — it produces genuine, separate per-page DOM boxes and polyfills `@page` margin boxes (`@top-center`, running headers/footers, `counter(page)`) that plain Chrome print doesn't support at all. This is a structural difference from `tiptap-pagination-plus`'s float trick, not a cosmetic one — it's the direct fix for the specific architectural gap this session's investigation found (see `HANDOFF.md`).
- **Real, documented risk found in Paged.js's own issue tracker:** content fragmentation bugs exist — tables can lose rows when a table is forced to split across a page, long paragraphs can lose lines or have whitespace stripped at a forced break, and Paged.js "breaks rendering if any element in itself overflows the page size." These are genuine, currently-open issues, not resolved history.

---

## 3. Why Paged.js's known risk is manageable *for this specific app* (and where it isn't)

The fragmentation bugs above are about **content forced to split mid-element** — a table row cut in half, a paragraph broken mid-line. This app's actual content shape lowers that risk substantially, but does not eliminate it:

- Every field (`FormFieldNode`) already renders as one bordered card, already has `break-inside: avoid` applied (added in round 3/4 of this project) — a real fragmentation engine like Paged.js *honors* `break-inside: avoid` correctly (unlike the current package, which explicitly cannot, per its own source). Fields are short by nature (a label + one input line), so they will essentially never need to split at all.
- Tables in these forms are small and deliberate (the seed content and the table-size picker both point at short reference tables, not 40-row data grids) — but if the Asset team ever inserts a genuinely long table that must span pages, Paged.js's row-loss bug is a real, currently-open risk, not a hypothetical. This needs an explicit product decision: either accept "avoid very long tables in a form" as a real constraint of the tool, or plan to test that specific case hard before shipping.
- **The safest integration boundary, and the one this study recommends:** Paged.js should only ever run over **finalized, read-only, already-resolved HTML** — never over the live, interactive Tiptap editing surface. Concretely:
  - The **builder's edit canvas** keeps behaving as it does today (continuous editing; the existing on-screen fake pagination can stay, be simplified, or be dropped in favor of a plain continuous-scroll editor — a separate, smaller decision).
  - `/form-preview.vue`'s **preview/print/PDF path** is where Paged.js takes over: feed it the form's resolved HTML (fields already flattened to their filled, static representation — a checkbox glyph, a signature image, filled text — the same resolution step already added this session for `{{TOKEN}}` placeholders) plus `@page` CSS built from this form's real margins/page size/letterhead.
  - Because Paged.js never touches the *live* Vue-rendered NodeView tree, the class of bug in Paged.js's own issue tracker about "Vue components skipping/duplicating rows" (found in this study's research) simply doesn't apply — that bug class is specifically about live framework-rendered content being reflowed by Paged.js's chunker, which this integration boundary avoids entirely by design.

## 4. What changes, concretely, if we proceed

| Area | Today | With this plan |
|---|---|---|
| `FormDocumentEditor.vue` (builder canvas) | `tiptap-pagination-plus`, on-screen fake pages | Unchanged, OR simplified to continuous-scroll (separate decision) |
| `/form-preview.vue` (fill-out + print) | Same fake-paginated editor, read-only | New: resolved HTML → Paged.js-rendered real pages, with real running header/footer via `@page` |
| Custom extensions (`Callout`, `MessageBanner`, `QuoteCommand`, `ButtonLink`, `FormFieldNode`, table controls, placeholders) | Untouched | **Untouched** — this is the whole point of the "side by side" approach |
| Margins/page size (`DEFAULT_PAGE_MARGINS`, `PAGE_SIZES`) | Fed into the pagination-plus config | Same values, fed into real CSS `@page` rules instead |
| Header/footer (`formLetterhead.ts`) | Rendered per fake page by the plugin | Rendered once via `@page` margin-box CSS + Paged.js's `string-set`/`running()` polyfill — this is what finally gets a **true** repeating header/footer, which the current package structurally cannot do |
| SSR/Nuxt | N/A | Paged.js is DOM/browser-only — must be loaded client-only (`import.meta.client`, dynamic import), same pattern this app already uses for `formStorage.client.ts` |

## 5. Recommendation

Proceed with **Paged.js**, scoped strictly to the read-only preview/print/PDF path (`/form-preview.vue`), leaving the editor and every custom Tiptap extension untouched. Treat the maintenance-staleness finding (3-year-old stable release, stalled beta) as a real but acceptable risk for a spec-implementation library whose underlying spec (CSS Paged Media) isn't changing — not as a reason to avoid it, given the alternatives are either framework-incompatible, version-incompatible, commercial, or a full editor replacement.

---

## 6. Spike results (run this session)

Installed `pagedjs@0.4.3` as a devDependency and ran a real, throwaway test: the actual `aof-commitment` form's resolved HTML (fields resolved, `{{TOKEN}}`s substituted via the existing `resolveTokensForPrint`), its real margins/page size/letterhead from `retrievalForms.ts`/`formLetterhead.ts`, run through `Previewer.preview()` with `@page` rules built from those same values. (The stored field markup turned out to be empty `<div data-form-field ...></div>` elements with no visible content at all — `FormFieldNode`'s `renderHTML` only ever emits data attributes, the real label/input markup only exists in the live Vue NodeView, which nothing in this codebase serializes to plain HTML today. Wrote a small throwaway static-HTML renderer for the spike to stand in for that missing piece — a real integration needs this as a first-class, tested utility, not a spike hack.)

**What worked, confirmed directly (not assumed):**
- **Real page count, computed correctly**: 3 pages for the seed form's real content — matches what the app's own (fake) on-screen pagination already shows for this content.
- **Real, separate per-page DOM boxes**: confirmed via `getBoundingClientRect()` — three `816×1056px` boxes (exactly Letter size at 96dpi, matching this app's own `PAGE_SIZES.letter`), stacked with zero gap, not a float illusion.
- **Genuine repeating header/footer via `position: running()` / `content: element()`**: the letterhead (logo, address, ref stamp, footer line) was written once in the source HTML and appeared correctly, repeated, on the second page — confirmed by an independent `html2canvas` snapshot of that specific page (see below for why that check was necessary). Plain Chrome print cannot do this at all; this is the direct, structural fix for the print/header-footer accuracy problem this whole study exists to solve.
- **Field cards with `break-inside: avoid` respected correctly**: a field near a page boundary landed whole on the next page, not split — real fragmentation, honored properly, unlike the current package.
- **One real, minor, easily-fixed gap found**: Paged.js resets `list-style` to `none` by default (its own cross-page list-numbering handling) — the app's existing `.prose-tiptap ol/ul` list-style CSS (already in `main.css`) needs to be carried into whatever stylesheet feeds the real integration; it just wasn't part of this minimal spike's CSS.

**A tooling gotcha worth recording, not a Paged.js bug:** this session's screenshot tool reliably rendered blank white for the exact same content the moment the page was scrolled roughly past the first page's height, even though `get_page_text`, `getComputedStyle` (visible, opaque, correctly colored), and `elementFromPoint` (correct element, correct text) all agreed real, correctly-styled content was there. An independent `html2canvas` capture of that same region confirmed it was rendering perfectly. Recorded here so this doesn't get mistaken for a Paged.js defect in a future session — verify anything paginated in this environment with an `html2canvas` cross-check if a screenshot looks wrong, before concluding the library is at fault.

**Bottom line:** the spike confirms the recommendation. The core, highest-risk claims (real per-page structure, real repeating headers/footers, correct fragmentation behavior) all held up under direct inspection, not just source-reading. The one real gap found (a missing plain-HTML field renderer) is a known, scoped, buildable piece of work, not a surprise that changes the recommendation.

**Left in place after this spike:** `pagedjs` stays in `package.json` (devDependency) since it's now a validated real dependency, not a throwaway. The scratch test page itself (`app/pages/spike-pagedjs.vue`) was deleted — it was hacky spike code, not something to ship.
