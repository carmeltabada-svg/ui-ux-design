# AMS Design Conventions

Reference for building any **new sidebar section** in this Nuxt app so it
matches Templates / Master Data instead of drifting. Give a fresh chat this
file (instead of full conversation history) to start a new feature cheaply.

## App shell

- Sidebar: `app/components/email/AmsSidebar.vue` — a faithful port of the
  real DS `Sidebar` component. `NAV_ITEMS` lists every menu entry; most have
  no `to` yet (placeholders). Wiring a new section = add a route folder
  under `app/pages/` and set that item's `to`.
- Layouts: `app/layouts/default.vue` (sidebar + top nav) vs `blank.vue`
  (full-bleed, e.g. print/preview pages).
- Active nav highlighting falls back to `route.path` prefix matching — see
  `AmsSidebar.vue`'s `active` computed. Extend that fallback when a new
  top-level route is added, don't hardcode a new special case elsewhere.

## Visual tokens

No separate theme/tokens file — colors are Nuxt UI v4 semantic classes
(`text-default`, `text-muted`, `text-highlighted`, `bg-elevated`,
`border-default`) plus a small set of literal colors used consistently:

| Purpose | Value |
|---|---|
| Active nav / primary tint | `rgb(239,246,255)` bg + `text-primary` |
| Active status | `rgb(0,127,69)` |
| Retired status | `rgb(137,75,0)` |
| Draft/neutral status | `#fff` bg, `#64748b` text, `#cbd5e1` border |

Row heights in the sidebar and toolbars are fixed px (`height: 32px`), not
Tailwind spacing scale — match that when adding new nav rows or toolbar
buttons so nothing looks taller/shorter than its neighbors.

## Component conventions

- **Badges/status pills**: build a small dedicated component
  (`shared/StatusBadge.vue`, `email/ModeBadge.vue`) sized to
  `text-xs px-1.5 py-0.5 rounded-full` — Nuxt UI's own `UBadge size="xs"`
  renders smaller text than that and looks mismatched next to these. Match
  the existing pill size rather than reaching for `UBadge` directly.
- **Settings/options popovers on a canvas node** (e.g. `EmailImageNodeView.vue`,
  `FormFieldNodeView.vue`): same shape everywhere — a bordered, ghost
  icon-button trigger that's `opacity-0 group-hover:opacity-100`, forced
  visible while its own popover is open. Reuse this shape for any new
  hover-revealed settings affordance instead of inventing a new one.
- **Autosave/status row**: `shared/AutosaveIndicator.vue` +
  `shared/StatusBadge.vue` is the established pattern for "saved state" UI —
  reuse it rather than building a bespoke save indicator per feature.
- **Tabs**: `shared/AlignedTabs.vue` is the shared tab-row component (used by
  both Email's History tab and Master Data's Form History tab).

## Editor/builder conventions (only relevant if the new feature has a
rich-text or drag-and-drop canvas, like Templates/Master Data do)

- Tiptap v3 + Vue NodeViews for any canvas-editable atom (image, form field,
  button). Reference implementations: `EmailImageNodeView.vue`,
  `FormFieldNodeView.vue`.
- `stopEvent` on a NodeView's `VueNodeViewRenderer` options should be scoped
  to the node's own chrome (e.g. `event.target.closest('[data-…-chrome]')`),
  never unconditional — an unconditional `stopEvent: () => true` blocks the
  node from ever being click-selected.
- If a canvas node needs a real destination URL (a link, a button) but must
  also be click-selectable inside the editor, don't fight the browser for
  the click: store the destination as `data-href` (not a real `href`) on
  the editor's own on-screen element, and only synthesize the real `href`
  in the export/serialize step. A live `<a href>` inside an editable canvas
  will always win control of the click over the framework.
- Auto-positioning a node to a document edge (top/bottom) via a ProseMirror
  transaction: insert the node at its new position **before** stripping any
  now-empty siblings, never after — stripping first can walk the doc to
  zero block children mid-transaction and trigger the schema's own
  auto-refill, which then loops forever against a cleanup pass expecting a
  stable empty target.

## Export/output-fidelity conventions (only relevant if the new feature
renders to a foreign consumer — email clients, PDF, print)

If the new feature's output has to survive a renderer other than the
browser (Outlook/Word, a PDF engine, print CSS), don't assume the editor's
own CSS survives the trip. See the published reference:
**Outlook-Proof Patterns** — merge-not-overwrite inline styles, legacy
`<font>`/`mso-highlight` fallbacks, the bulletproof-button table pattern,
and pixel-crop-not-CSS-fit for banner images. Ask for that artifact's link
if it's not already at hand, or ask me to write an equivalent one for the
new renderer.

## Workflow

- Verify every visual change live in the Browser pane before calling it
  done — don't rely on reading code alone.
- Run `npx vue-tsc --noEmit -p .` after edits.
- One feature/section per chat session is fine and keeps token usage low —
  this file (not the full prior conversation) is what a new session needs
  to build consistently.
