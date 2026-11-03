# Design Specification: Supplier Return and Client Pull-Out

**Scope:** the two new statuses, the Move Asset flow and the shell it needs. The list, status strip, filters, detail layout and tabs are specified in `DESIGN_SPEC_assets-ux-enhancements.md`. Measured values live in [AMS_DESIGN_SYSTEM.md](AMS_DESIGN_SYSTEM.md).

Guiding decision: the Move Asset screen is cohesive with the ticket tracker (`app/pages/ticket-tracker/index.vue`). Where the ticket tracker and the generic design system disagree, this surface follows the ticket tracker, so the two sibling pages read as one app.

---

## 1. Locked, must not change

- The feature logic and flow: the two Terminal-lane statuses, the Monthly Rental block on Client Pull-Out, the four required fields (date, done by, reason, document), PDF or image only up to 10 MB, movement and location derived from the status, the terminal-action confirm step, counts leaving the active total.
- Copy rules: no dashes, status names are proper nouns, plain validation text. Keep the current error and refusal copy.
- Out of scope: ticket flow, bulk exit, reversal, "Assets Accounted For" (does not exist, not built).
- Front end only, mock data. No backend work in this build.

## 2. Page title, type scale and buttons

- Page title: `text-2xl font-semibold text-highlighted` with a `text-sm text-muted` description, as the ticket tracker uses, not the design system's `text-lg`. This is a deliberate deviation for this surface so Move Asset matches its sibling.
- Field labels and values on the design system type scale (12px label above, 14px value), 24px between field groups, card and spacing tokens as the ticket tracker uses them.
- Button sizes follow the ticket tracker zones: header actions `size="md"`, form actions `size="sm"`, row actions `size="xs"`.
- One font only: Inter. Asset tags and serials use Inter too, kept legible with weight and colour, never a monospace or other family.

## 3. Components and patterns

- Source of truth for construction: `app/pages/ticket-tracker/index.vue`, `app/components/shared/Banner.vue`, `StatusBadge.vue`, `SimulatorBar.vue`, `FileAttachChip.vue`.
- Status pill (`AssetsStatusPill`): the two-part coloured name plus grey date badge, solid fills, 600 shade for gray and 700 for saturated hues so white text passes AA. Supplier Return is teal, Client Pull-Out is pink.
- New Status dropdown: `AssetsStatusPicker`, a searchable picker grouped by lane with lane headings, the selected item in the primary colour. It follows the grouped searchable status select of the live Move Asset page. (`USelectMenu` was tried first and crashed in the prototype's `@nuxt/ui` version when the table re-rendered as the menu closed.)
- The Asset card's model, location, serial and tag behave as on the asset detail page: blue link and copy button, and only an office location is a link. The Note field has a placeholder.
- Sidebar and top bar: reuse `EmailAmsSidebar` and `EmailTopNavbar`, the same ones the ticket tracker and templates pages use. Move Asset is its own active sidebar item on `/move-asset/**`, and the breadcrumb covers Home > Move Asset > tag > Done. Do not hand-roll either.
- `AssetsSimulatorBar` is feature-specific demo scaffolding and does not ship.

## 4. States and responsive

- Responsive: the Move form is one column on a phone and the Status history card sits under it (see the Dev Doc Responsive Spec).
- States: not found, exited unit ("can't be moved again"), blocked save, and the read-only role (no Move action).
- Dark mode: the exit details panel, banners and the confirm modal have dark equivalents.
- The confirm step and the inline reveal keep their behaviour.

## 5. Deliberate drift from the design system

Page title `text-2xl` here, not the canonical `text-lg`, for cohesion with the ticket tracker page. Everything else follows the design system: Inter only, the spacing scale, 24px between field groups on the Move form, semantic tokens first, no dashes.
