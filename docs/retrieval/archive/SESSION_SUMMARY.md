# Session Summary — GoTeam AMS Templates Builder

Project: Nuxt 4 + Nuxt UI v4 + Tiptap v3 email/forms builder, no backend. Email
templates live in an in-memory `reactive({})` (no persistence); forms are
mirrored to localStorage. Working directory:
`C:\Users\CarmelTabada\Documents\Assets\Artifacts\email-templates`.

Communication convention with the user: they send feedback in numbered
rounds; each round requires implementing every point, verifying live in the
Browser pane (Playwright-style tools), running `npx vue-tsc --noEmit -p .`
to confirm a clean typecheck, and reporting status back concisely.

## Status as of this file

The most recent task is **DONE and verified**: making the existing
Align-left/center/right toolbar buttons context-aware so they apply to a
selected image or button-link node (not just text), and making both nodes
properly clickable/selectable without triggering unwanted side effects.
Typecheck is clean; live browser verification passed for both nodes.

There is no known outstanding bug right now. The next message in this chat
should be new user feedback — treat this file as onboarding context, not a
to-do list with open items.

## Key files

- **app/utils/tiptapExtensions.ts** — all custom Tiptap node/mark
  extensions: `EmailImage` (role: header/footer/plain, align, originalSrc
  attrs; custom NodeView-backed), `ButtonLink` (align attr, `data-href`
  attr — see "Button-link click fix" below), `EmailTrailingNode` (custom
  replacement for StarterKit's `TrailingNode` with a footer-only exception),
  `Callout`, `MessageBanner`, `QuoteCommand`, `TableHeaderStyled`, `FontSize`,
  `emailImageStyle()`, `cropImageToAspect()` (canvas-based pixel crop),
  `HEADER_ASPECT`/`FOOTER_ASPECT` (640×140 / 640×100), `imageAlignMargin()`.
- **app/utils/emailExportHtml.ts** — HTML export/"copy to Outlook" pipeline:
  `mergeStyle()`/`parseStyle()` (merge-existing-wins), `NODE_STYLES`,
  `tableizeFillBlocks()`, `tableizeMarks()`, `stampMsoHighlight()`,
  `wrapBlockquoteFontColor()`, `wrapCharacterRunsInFont()`,
  `isBannerImage()`/`styleBannerImage()`, `isBlankContent()`,
  `tableizeButtons()` (reads `data-href`, builds a real bulletproof-button
  table for Outlook), `buildEmailExportHtml()`.
- **app/components/email/EmailImageNodeView.vue** — Vue NodeView for
  `EmailImage`: gear popover to set role (plain/header/footer, which crops
  + auto-moves the image to the edge via `moveToEdge()`), no alignment UI
  (alignment is driven by the main toolbar now).
- **app/components/email/BlockToolbar.vue** — main editor toolbar; holds the
  unified `currentAlign()`/`setAlign()`/`isAlignActive()` functions that
  route to image/buttonLink/text alignment depending on what's selected; the
  Insert Image popover has a recommended-size hint (Header 640×140, Footer
  640×100).
- **app/components/email/BodyField.vue** — editor instantiation via
  `useEditor`; wires `StarterKit.configure({ trailingNode: false })` +
  `EmailTrailingNode`; has a `handleDOMEvents.mousedown` handler for
  `[data-btn-link]` clicks (manual `NodeSelection` via `posAtDOM` — see
  below, may now be partially redundant but is harmless to leave).
- **app/data/templateRuntime.ts** — `TemplateRuntime` interface, has
  `background?: string` and `footerNote?: string` fields.
- **app/components/email/FieldLabel.vue** — has an `optional` prop that
  renders an inline "(optional)" badge.
- **app/pages/templates/email/[id]/edit.vue** — background color picker and
  footer note field UI.

## Recently completed work (this session, chronological)

1. **Outlook copy/paste fidelity round** — fixed banner/callout fill loss,
   wrong table header fill color, WCAG-compliant table header/text color
   palette with more variety, fade effect appearing when content isn't
   scrollable, forms toolbar placeholder button staying visible-but-disabled
   instead of disappearing.
2. **Visible "stroke" artifact** in the fade effect on the templates list —
   fixed.
3. **Deep Outlook export fidelity fixes** — root-caused to (a) old code
   replacing rather than merging inline styles (fixed via `mergeStyle()`),
   (b) Outlook's Word rendering engine not supporting modern CSS on
   character runs (needed legacy `<font>` tags + `mso-highlight`), (c)
   Outlook's "Merge Formatting" paste mode being a client-side user setting
   outside the app's control (documented, not "fixable").
4. **Button size in Outlook** — was rendering much bigger than intended;
   fixed via the bulletproof-button table pattern (`width="1"` td trick +
   `white-space:nowrap` + `mso-padding-alt`).
5. **Padding/UX polish round** — briefer popover copy, recommended image
   size hints in the insert-image popover, and (the big one) **auto-position
   header/footer images** so a header always snaps to the very top and a
   footer to the very bottom regardless of where it was inserted, with the
   adjacent empty paragraph cleaned up so no blank gap remains.
   - This hit and fixed a **genuine infinite-loop/tab-hang bug**: stripping
     empty paragraphs before inserting the image could walk the doc to zero
     children, triggering ProseMirror's schema-minimum auto-refill of a new
     empty paragraph, which the cleanup loop then saw as "still empty"
     forever. Fixed by reordering to **insert the image first, then strip**
     (the image itself always satisfies the minimum, so childCount never
     hits zero mid-transaction). See `moveToEdge()` in
     `EmailImageNodeView.vue` for the full reasoning in comments.
   - Also fixed a **persistent trailing-paragraph gap**: StarterKit's built-in
     `TrailingNode` was re-adding a paragraph after every transaction when
     the doc ended in a non-text atom. First fixed via blanket
     `trailingNode: false`, then — per explicit user correction ("it should
     be disabled only when it is set as footer") — rebuilt as the custom
     `EmailTrailingNode` extension with a footer-only exception.
6. **Critical correction on image sizing**: initial approach used CSS
   `object-fit: cover` + fixed width/height attributes, which visibly
   distorted images in real Outlook (no `object-fit` support there). User
   corrected: full-width with no padding was right, but the image must be
   **actually cropped**, not CSS-stretched. Fixed by adding
   `cropImageToAspect()` — a real canvas-based pixel crop producing a
   `data:image/png` — so the stored image data is already the correct aspect
   ratio, working identically in every email client.
7. **Image drag-and-drop was broken** — root cause: `draggable="true"` was
   only on the inner `<img>` (triggers generic browser image-drag) while the
   `NodeViewWrapper` (which Tiptap actually wires to ProseMirror's own
   reorder-via-drag behavior) had no `draggable` attribute. Fixed by moving
   `draggable="true"` to the wrapper and setting `draggable="false"` on the
   `<img>`.
8. **Image not clickable/selectable** — root cause: `stopEvent: () => true`
   (unconditional) on the image's `VueNodeViewRenderer` options blocked
   ProseMirror's own click-to-select handling entirely. Fixed by scoping
   `stopEvent` to only swallow events that originate from the gear-popover
   chrome (`[data-email-image-chrome]`), letting a plain click on the image
   fall through to ProseMirror's default `NodeSelection` behavior.
9. **Toolbar alignment made context-aware (the final task)** — user's
   request: "add an option to align left, right or center an image, same
   with the link button", immediately corrected mid-turn to: "I don't want
   you to add another button, I want the image to be clickable and with
   that, the current alignment buttons should be applicable to the image
   selected, also applies to the link button." Implemented in
   `BlockToolbar.vue` as `currentAlign()` / `setAlign()` / `isAlignActive()`,
   which check `editor.isActive('image')` / `editor.isActive('buttonLink')`
   first and route to `updateAttributes(..., { align })`, falling back to
   `setTextAlign()` for plain text.
10. **Button-link click-to-select fix (just completed)** — the button
    renders as a real `<a>`, so clicking it in the editor triggered actual
    browser navigation instead of ProseMirror selection. Multiple
    intermediate approaches (`handleDOMEvents.click` + `preventDefault`,
    then `handleDOMEvents.mousedown` + manual `NodeSelection` via
    `posAtDOM`) were unreliable — one test showed the tab still navigated to
    `example.com` after supposedly being intercepted. **Final, robust fix**:
    stopped rendering a real `href`/`target`/`rel` on the editor's live
    anchor at all. The `href` attribute in `ButtonLink` now stores/reads via
    `data-href` only (`parseHTML: el => el.getAttribute('data-href')`,
    `renderHTML: attrs => ({ 'data-href': attrs.href || '' })`), and
    `ButtonLink.renderHTML()` no longer emits `href`/`target` on the `<a>` —
    a plain anchor with no `href` is not navigable by any browser, so the
    conflict is eliminated at the source rather than fought after the fact.
    - **A real bug was caught and fixed in the same change**: the node-level
      `renderHTML({ HTMLAttributes })` parameter only contains the *merged
      output* of each attribute's own `renderHTML`, not raw attribute
      values — since `align`'s own `renderHTML` intentionally returns `{}`,
      `HTMLAttributes.align` was always `undefined`. Fixed by reading
      `node.attrs.align` / `node.attrs.label` directly instead of
      `HTMLAttributes.align` / `HTMLAttributes.label`.
    - `emailExportHtml.ts`'s `tableizeButtons()` was updated in lockstep to
      read `el.getAttribute('data-href')` instead of `href`, so the
      exported/pasted Outlook email still gets a real, working `<a href>` —
      the loss of a "real" href only ever applied to the editor's own live
      on-screen DOM, never to the final delivered email.
    - The pre-existing `handleDOMEvents.mousedown` handler in
      `BodyField.vue` (manual `NodeSelection` via `posAtDOM` for
      `[data-btn-link]`) was left in place — it's likely now redundant since
      the anchor has no competing native navigation, but it's harmless
      (only special-cases button-link clicks, doesn't conflict with default
      behavior).
    - **Verified live in the Browser pane**: inserted a button link, clicked
      directly on it — confirmed no new tab/navigation occurred, and the
      toolbar's Align-left button was highlighted as active. Clicked
      Align-center — confirmed the button visually re-centered and the
      toolbar updated to reflect it. Re-verified the same for an inserted
      image (click selects it, Align-center re-centers it, toolbar reflects
      state). `npx vue-tsc --noEmit -p .` ran clean.

## Technical concepts worth knowing for this codebase

- **Tiptap v3 / ProseMirror**: custom node schemas, Vue NodeViews,
  `addAttributes`/`parseHTML`/`renderHTML`, atom nodes, `NodeSelection`,
  `stopEvent`, the `draggable` schema option vs. the DOM `draggable`
  attribute (two different things that must agree).
- **`renderHTML({ node, HTMLAttributes })` gotcha**: `HTMLAttributes` is the
  *already-merged output* of every attribute's own `renderHTML`, not the raw
  node attrs. If an attribute's own `renderHTML` returns `{}` (e.g. because
  it's only meant to affect a wrapping element's style, not its own DOM
  attrs), that value will never show up in the node-level `HTMLAttributes`
  parameter — read `node.attrs.<name>` directly instead.
- **ProseMirror transactions**: `tr.delete`/`tr.insert`/`tr.setSelection`,
  `appendTransaction` plugins, and the schema-minimum auto-refill gotcha
  (a doc that would hit zero block children mid-transaction gets an empty
  paragraph silently reinserted by ProseMirror itself) — order operations so
  the minimum is never actually crossed, rather than fighting the refill
  after the fact.
- **`TrailingNode`** (from `@tiptap/extensions`, bundled by StarterKit)
  auto-appends an empty paragraph after a trailing block atom; replaced
  here with `EmailTrailingNode`, a custom `Extension` with a footer-image
  exception.
- **Canvas-based image cropping** (`cropImageToAspect`) is used instead of
  CSS sizing specifically because Outlook's Word-based rendering engine
  doesn't support `object-fit` — the only client-agnostic way to guarantee a
  true full-width, non-distorted banner is to pre-crop the actual pixel data
  client-side via `<canvas>` and store the result as a `data:image/png`.
- **Outlook/Word HTML email quirks** (all handled in `emailExportHtml.ts`):
  no `object-fit`; shorthand `background` is stripped (must use
  `background-color`); only table cells reliably support fills; character-run
  formatting (color/highlight/size) needs legacy `<font>` tags and
  `mso-highlight` to survive Word's "Merge Formatting" paste mode; buttons
  need the bulletproof-button table pattern (`width="1"` td +
  `white-space:nowrap` + `mso-padding-alt`) to avoid stretching.
- **`mergeStyle()` pattern**: merge existing inline styles with computed
  defaults, existing wins — used throughout the export pipeline instead of
  blind overwrites, which is what caused several of the early Outlook
  fidelity bugs.
- **WCAG 2.2 contrast** is the standard applied to the table header/text
  color palette.

## Working conventions to keep following

- Implement every point in a user's feedback round, not a subset.
- Always verify live via the Browser pane tools (screenshot, click, read
  console/network) — don't just claim something works from reading code.
- Always run `npx vue-tsc --noEmit -p .` after edits and before reporting
  done.
- When the user gives a correction mid-task, treat it as an override of the
  prior approach, not an addition to it (e.g. the "don't add another
  button, make the existing ones context-aware" correction, and the
  "preserve the original image via actual cropping, not CSS stretching"
  correction).
- Watch for stray/leftover browser tabs from earlier test attempts when
  verifying navigation-related fixes (a stale tab can look like a
  regression that isn't actually happening anymore) — close them and retest
  cleanly before concluding a fix didn't work.
