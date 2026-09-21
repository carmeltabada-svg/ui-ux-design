# PRODUCT.md — GoTeam AMS: Templates Builder

> Written retrospectively, as a reference doc for an already-built feature —
> not a forward-looking pitch. Sections follow standard PRD structure so
> future implementations can be compared against this one consistently;
> "Success Metrics," "Open Questions," and "Timeline" describe actual
> known-unknowns and real constraints, not hypothetical targets.

## Problem Statement

GoTeam's Asset Team and HR-adjacent staff manage two recurring, high-stakes
document flows by hand: sending offboarding/asset-retrieval emails, and
collecting signed retrieval/gate-pass forms. Before this feature, both were
static, hand-edited HTML or paper-adjacent documents with no live preview,
no guarantee an email would render correctly once pasted into Outlook
(Word's HTML rendering engine silently drops or distorts modern CSS), and
no structured way to build a fillable, paginated, versioned form. Every
edit carried real risk of a broken email going out to a departing employee,
or a form that looked fine on-screen but printed wrong. This affects every
template author on the team, on every send, not an edge case.

## Goals

- Give non-technical authors a real in-browser rich-text editor for both
  content types, so template changes don't require hand-editing HTML.
- Guarantee Outlook/Word rendering fidelity for every exported email —
  banner/button fills, text color/size/highlight, and image banners must
  survive Word's renderer, not just look correct in a browser preview.
- Support a structured, paginated form-document canvas with typed fields
  (text/number/checkbox/file/signature), draft autosave, and version
  history — so a form's evolution is auditable, not just overwritten.
- Keep both builders inside one shared app shell (sidebar, layout, Nuxt UI
  v4 conventions) so future AMS sections feel like the same product
  instead of bespoke UI per feature.

## Non-Goals (this version)

- **Backend, auth, or real persistence** — this is a front-end-only
  prototype; state is in-memory (`reactive({})`) or localStorage-mirrored.
  Explicitly deferred to the real integration — see `docs/DEV_HANDOFF.md`.
- **Real email sending** — "Export to Outlook" produces client-safe HTML to
  copy/paste; there is no send pipeline in this prototype.
- **Merging the two builders into one editor** — Email Templates and
  Retrieval Forms intentionally use separate Tiptap extension sets and
  separate pagination libraries. They share a UI shell, not an editor
  instance; combining them wasn't attempted because their content models
  (flowing email body vs. paginated field-driven document) are different
  enough to make a shared editor core more complex than two focused ones.
- **User/role/permissions system** — anything referencing "submitted by"
  or recipients reads from a static fixture, not real auth.
- **Defeating a recipient's own Outlook paste-mode setting** — "Merge
  Formatting" vs. "Keep Source Formatting" is a client-side Outlook
  preference; the export pipeline hedges for both but can't force one.

## User Stories

- As a template author, I want to visually edit an email's body (text,
  images, buttons, tables, callouts) so I don't have to hand-write HTML.
- As a template author, I want an image I mark as "Header" or "Footer" to
  auto-position at the true top/bottom of the email with no stray empty
  space, so I don't have to manually manage layout.
- As a template author, I want to click an inserted image or button and
  align it left/center/right using the same toolbar buttons I use for
  text, so alignment doesn't require a separate, node-specific control.
- As a template author, I want what I see in the editor to survive being
  pasted into real Outlook — colors, fills, button sizing — so I'm not
  guessing whether a send will look broken.
- As a form author, I want to insert typed fields (text, checkbox,
  signature, etc.) into a paginated document and see draft changes
  autosave, so I don't lose work switching away mid-edit.
- As a form author, I want to see prior versions of a form and diff them,
  so I can tell what changed between revisions.
- As a recipient, I want to open a form link, fill required fields
  (including an e-signature), and submit once — and see a read-only view
  if I've already submitted — so I can't accidentally resubmit or lose
  what I entered.
- As a recipient, I want the submitted form to be viewable/printable as a
  clean, paginated PDF, so the record looks like a real document, not a
  raw web page.

## Features

Detailed, per-feature breakdown — this is the section to mine when a new
implementation wants to reuse a concept or pattern, not just know it
exists. Each entry: what it does, how it actually works, the key files,
and any decision worth knowing before touching it.

### Feature: Email Body Editor
**What it does:** In-browser rich-text editor for an email's HTML body —
text formatting, headings, lists, tables, and several email-specific
content types (image, button-link, callout, message banner, blockquote/
quote-command).
**How it works:** Tiptap v3 over ProseMirror. `BodyField.vue` instantiates
the editor with StarterKit plus a custom extension set
(`~/utils/tiptapExtensions.ts`): `Callout`, `MessageBanner`, `QuoteCommand`,
`ButtonLink`, `EmailImage`, `TableHeaderStyled`, `EmailTrailingNode`. Each
custom node either renders via plain `renderHTML` or, where interactive
on-canvas behavior is needed (image, form field elsewhere), a Vue NodeView.
**Key files:** `app/components/email/BodyField.vue`,
`app/utils/tiptapExtensions.ts`, `app/components/email/BlockToolbar.vue`.
**Notes:** the editor and the exporter are two independent render passes
over the same document — see "Outlook Export Pipeline" below. Don't assume
a CSS property that works in the editor will survive export; check there
first.

### Feature: Context-Aware Alignment Toolbar
**What it does:** The same three toolbar buttons (align left/center/right)
apply to plain text, a selected image, or a selected button-link — not
three separate controls per content type.
**How it works:** `BlockToolbar.vue` checks `editor.isActive('image')` /
`editor.isActive('buttonLink')` before falling back to `setTextAlign()`;
`updateAttributes(nodeType, { align })` is called on whichever node type is
actually selected. This only works because both node types are properly
click-selectable in the first place (see next feature) — alignment being
context-aware was a direct consequence of fixing selection, not a separate
UI addition.
**Key files:** `app/components/email/BlockToolbar.vue` (`currentAlign()`,
`setAlign()`, `isAlignActive()`).
**Reusable pattern:** when a toolbar needs to act on "whichever thing is
selected" instead of one fixed target, check `editor.isActive(nodeType)`
per candidate node type before falling back to the default (usually text)
behavior — don't build a parallel per-node-type control.

### Feature: Selectable, Draggable Email Image with Header/Footer Roles
**What it does:** An inserted image can be plain (inline, scales to fit),
or marked Header/Footer (full-width banner, no padding, auto-positioned to
the document's true top/bottom). It's click-selectable (for the alignment
toolbar) and drag-reorderable within the document.
**How it works:** `EmailImage` node (`tiptapExtensions.ts`) with a Vue
NodeView (`EmailImageNodeView.vue`). Key implementation details:
- **Click-to-select**: `stopEvent` on the NodeView is scoped to only the
  settings-gear popover chrome (`[data-email-image-chrome]`), not the whole
  node — an earlier unconditional `stopEvent: () => true` blocked
  ProseMirror's own click-to-`NodeSelection` entirely.
- **Drag-to-reorder**: `draggable="true"` lives on the `NodeViewWrapper`
  (what Tiptap actually wires to reordering), not the inner `<img>`
  (`draggable="false"`, so it doesn't trigger the browser's own generic
  image-drag instead).
- **Header/footer auto-positioning**: picking a role moves the image to
  the document's true edge via a ProseMirror transaction that **inserts
  the image at its new position before stripping adjacent empty
  paragraphs**, never after — stripping first can walk the doc to zero
  block children mid-transaction, triggering the schema's own auto-refill
  of a new empty paragraph, which a naive cleanup loop then sees as "still
  empty" and deletes forever (a real infinite loop, not just a bug).
- **Header/footer image cropping**: switching to Header/Footer crops the
  image's actual pixels to a fixed aspect (640×140 / 640×100) via
  `cropImageToAspect()` (canvas-based), not CSS `object-fit` — CSS sizing
  looks right in a browser but distorts in Outlook, which doesn't support
  `object-fit`. The original, uncropped image is kept (`originalSrc`) so
  switching roles back and forth never re-crops an already-cropped image.
- **Trailing-node safety**: a custom `EmailTrailingNode` extension replaces
  StarterKit's default one, with a single exception — no safety paragraph
  is added after a Footer-role image, since that's meant to be the
  document's true final element.
**Key files:** `app/components/email/EmailImageNodeView.vue`,
`app/utils/tiptapExtensions.ts` (`EmailImage`, `EmailTrailingNode`,
`cropImageToAspect`, `emailImageStyle`).

### Feature: Selectable Button-Link (no accidental navigation)
**What it does:** Insert a styled button with a URL and label; it's
click-selectable in the editor (for the alignment toolbar) without
triggering real browser navigation, but still produces a real, working
link once exported.
**How it works:** `ButtonLink` node stores its destination as a `data-href`
attribute, not a real `href`/`target` on the editor's own on-screen anchor
— a live `<a href>` inside an editable canvas always wins control of a
click over the framework, no matter how the click event is intercepted.
Two earlier approaches (`handleDOMEvents.click` + `preventDefault`, then
`handleDOMEvents.mousedown` + manual `NodeSelection` via `posAtDOM`) were
unreliable — one test showed the tab still navigated despite the
interception. Removing the real `href` at the source eliminated the
conflict instead of refereeing it. The real, functional `href` is only
synthesized during export (see next feature).
**Key files:** `app/utils/tiptapExtensions.ts` (`ButtonLink`),
`app/components/email/BodyField.vue` (`handleDOMEvents.mousedown`, now
likely redundant but left in place, harmless).
**Gotcha worth knowing:** a node's `renderHTML({ node, HTMLAttributes })`
receives `HTMLAttributes` as the *already-merged output* of every
attribute's own `renderHTML` — not raw node attrs. An attribute whose own
`renderHTML` intentionally returns `{}` (like `align` here, which only
affects a wrapping element) reads back as `undefined` from
`HTMLAttributes`. Read `node.attrs.<name>` directly instead.

### Feature: Outlook Export Pipeline ("Export to Outlook" / copy)
**What it does:** Converts the live Tiptap document into HTML that
survives being pasted into real Outlook — where the base Word rendering
engine supports a much smaller CSS subset than any browser.
**How it works:** `buildEmailExportHtml()` walks the document a second
time (never reuses the editor's own render) and rebuilds it as nested
tables with inline styles and legacy fallback markup:
- `mergeStyle()` merges computed defaults into any existing inline style
  (existing wins) instead of overwriting — the root cause of several early
  fidelity bugs (banner/callout fills, table header colors vanishing) was
  the old code replacing styles wholesale.
- Character-run formatting (color, size, highlight) is wrapped in legacy
  `<font>` tags and stamped with `mso-highlight`, since Word's "Merge
  Formatting" paste mode drops modern CSS on runs but honors these.
- Buttons are rebuilt as a bulletproof-button table
  (`width="1"` td + `white-space:nowrap` + `mso-padding-alt`) — a styled
  `<a>` with padding stretches to fill its container in Word without this.
- `isBlankContent()` drops empty trailing rows instead of rendering blank
  padded boxes.
**Key files:** `app/utils/emailExportHtml.ts`.
**Reusable pattern:** whenever a feature's output must survive a renderer
other than the browser (a different email client, print, PDF), don't
assume the editing surface's CSS survives the trip — build a dedicated,
independent serialization pass, and merge styles rather than overwrite
them.

### Feature: Retrieval Forms Document Builder
**What it does:** A paginated document canvas for building fillable forms
(e.g. gate-pass, retrieval acknowledgment) with typed fields, live
pagination, draft autosave, and version history with diff.
**How it works:** `FormDocumentEditor.vue` — a separate Tiptap instance
from the email body editor, with its own extension set and its own
pagination library (not shared with Email Templates — see Non-Goals).
Field types (text/number/checkbox/file/signature/etc.) are custom nodes
backed by FormKit, rendered via `FormFieldNodeView.vue`, inserted through
`FormFieldInsertMenu.vue` and configured via
`FormFieldPropertiesPanel.vue`. Drafts autosave to an in-memory store
mirrored to localStorage; `FormHistoryTab.vue` +
`FormVersionPreviewModal.vue` provide version browsing/diff.
**Key files:** `app/components/masterData/FormDocumentEditor.vue`,
`FormFieldNodeView.vue`, `FormFieldInsertMenu.vue`,
`FormFieldPropertiesPanel.vue`, `FormHistoryTab.vue`.

### Feature: Recipient Fill/Submit + Print/PDF Preview
**What it does:** A recipient opens a form link, fills required fields
(including e-signature), submits once, and can view/print the result as a
paginated PDF-equivalent.
**How it works:** `/form-preview` reads the form's current draft; if
already submitted, renders a read-only view instead of the fill form.
`SignaturePad.vue` captures the e-signature. On submit, state flips to
submitted (plus a simulated "emailed copy" — no real send). The
paginated print view uses the pagedjs `Previewer`, triggered via
`window.print`.
**Key files:** `app/pages/form-preview.vue`,
`app/components/masterData/SignaturePad.vue`.

## Requirements Summary

Full detail lives in Features above; this is the priority rollup.

### Must-Have (P0) — implemented
Email Body Editor, Context-Aware Alignment Toolbar, Selectable/Draggable
Email Image with Header/Footer roles, Selectable Button-Link, Outlook
Export Pipeline, Retrieval Forms Document Builder, Recipient Fill/Submit +
Print/PDF Preview, shared AMS sidebar shell and Nuxt UI v4 conventions
(see `DESIGN_SYSTEM.md`).

### Nice-to-Have (P1) — implemented, lower criticality
- Recommended-size hints in the insert-image popover (640×140 header,
  640×100 footer).
- Brief/scannable popover copy (shortened per explicit feedback rounds).
- WCAG-compliant table header/text color palette with real variety, not
  just one or two safe options.
- Fade-scroll effect on scrollable panels, correctly suppressed when
  content doesn't actually overflow.

### Future Considerations (P2) — explicitly deferred
- Real backend integration: persistence, auth, real send/submit wiring
  (fully scoped in `docs/DEV_HANDOFF.md`, not designed here).
- A merged or shared editor core for both builders, if a future feature
  needs the same content model as both — not attempted here since their
  models genuinely differ (flowing body vs. paginated fields).
- Data export tooling for test data trapped in localStorage before a
  handoff zip travels — partially covered by `docs/DATA_EXPORT_GUIDE.md`.

## Success Metrics

This is an internal ops tool prototype, not a metrics-instrumented product
release — there is no analytics pipeline in this prototype. The practical
signal used instead, round over round: whether each piece of user-reported
feedback (Outlook fidelity issues, missing alignment options, drag/drop
bugs) was verified fixed live in a real browser + real paste-test into
Outlook, not just "looks right in code." See `docs/archive/SESSION_SUMMARY.md`
for the specific bug reports and fixes this was checked against.

## Open Questions

- **Engineering**: what's the actual persistence/backend contract once
  integrated — does the dev team want the export HTML sent directly to a
  mail API, or does an existing service already own send? (Not answerable
  from the prototype alone — see `docs/DEV_HANDOFF.md` §4 Out of Scope.)
- **Design**: should Email Templates and Retrieval Forms ever converge on
  one shared editor core, or should they stay deliberately separate as new
  builder-type features are added to AMS? Non-goal for this version, but
  worth a real decision before a third builder-type feature is planned.
- **Product**: is there a real requirement for role/permission-gated
  template editing, or does every Asset Team member have equal edit
  access? Currently unanswered — no auth exists in this prototype.

## Timeline Considerations

No hard external deadline drove this build — it was iterated round-by-round
against direct designer feedback rather than a fixed release date. The
real timeline constraint now is the backend/auth integration effort
scoped in `docs/DEV_HANDOFF.md`, which this document does not estimate.
