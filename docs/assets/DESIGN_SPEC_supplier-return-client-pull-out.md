# Design Specification: Supplier Return and Client Pull-Out

**Scope:** every kind of move on the Move Asset screen (Check In or Check Out, Return to supplier, Client pull-out), the two exit statuses, the Legacy statuses, the Move details drawer with the replacement picker, and the shell they need. The list, status strip, filters, detail layout and tabs are specified in `DESIGN_SPEC_assets-ux-enhancements.md`. Measured values live in [AMS_DESIGN_SYSTEM.md](AMS_DESIGN_SYSTEM.md).

Guiding decision: the Move Asset screen is cohesive with the ticket tracker (`app/pages/ticket-tracker/index.vue`). Where the ticket tracker and the generic design system disagree, this surface follows the ticket tracker, so the two sibling pages read as one app.

---

## 1. Locked, must not change

- The feature logic and flow: the two Terminal-lane statuses, the Monthly Rental block on Client Pull-Out, the four required fields (date, done by, reason, document), PDF or image only up to 10 MB, movement and location derived from the status (both exits are a Check Out, to the supplier or to the client), the terminal-action confirm step, counts leaving the active total.
- The kind of move is chosen before the form opens, so the form layout never changes. Fields that only some statuses need (the Charged Deduction documents) are always in the page and switched on, never added.
- No new fields beyond the live R24 Move Asset form. The generic move keeps its order: movement type, location type, location, supplier or team member, who did it, note, new status last.
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
- Move menu (`AssetsMoveMenu`, a `UDropdownMenu`): behind every "Move asset" button (list row action, asset header, Move Asset page). Three items with an icon and a description: "Check In or Check Out", "Return to supplier", "Client pull-out". The Client pull-out item is dimmed when the unit is not eligible, shows the reason in a tooltip on hover, and raises a toast on click. The Move form header has a "Change move type" menu with the same items.
- Movement type: retrieval style toggle buttons (Check In, Check Out). Location type: the retrieval icon cards (Asset Location, Supplier, User Address), always visible; Supplier and User Address are disabled while Check In is chosen. Selected text uses `blue-700` in light and the primary colour in dark for contrast.
- Team member search: two lines per result like the retrieval ticket, the name and then the employee number and email.
- Charged Deduction documents: one inert fieldset, switched on only for that status. Authority to Deduct and IT Clearance are both optional.
- New Status dropdown: `AssetsStatusPicker`, a searchable picker grouped by lane with lane headings, then a "Legacy" group (Defective, For Inspection, In Transit, Pending Disposal, Under Repair), the selected item in the primary colour. It follows the grouped searchable status select of the live Move Asset page. Supplier Return and Client Pull-Out are not in it, and no status is disabled.
- Move details drawer (`AssetsMoveDetailsDrawer`): a floating right slide-over, 440 px at most (full width minus 24 px on a phone), the same pattern as the retrieval Activity Log and Placeholder Library drawers. Sections: the move fields (empty states like "No note recorded"), the supporting document as the retrieval `FileAttachChip` (read only), and Replacement. The old `/move-asset/<tag>/details` page only forwards to `/assets/<tag>?moveDetails=1`.
- Replacement picker (`AssetsReplacementPicker`): searchable, two sections ("Same supplier", then "Other suggestions"), each with a "?" help (tooltip on hover, a click pins it open under the title), an open in new tab icon on each option, empty states, and the placeholder "Select a replacement unit". It is optional and has no lock rule. (`USelectMenu` was tried first and crashed in the prototype's `@nuxt/ui` version when the table re-rendered as the menu closed.)
- The Asset card's model, location, serial and tag behave as on the asset detail page: blue link and copy button, and only an office location is a link. The Note field has a placeholder.
- Sidebar and top bar: reuse `EmailAmsSidebar` and `EmailTopNavbar`, the same ones the ticket tracker and templates pages use. Move Asset is its own active sidebar item on `/move-asset/**`, and the breadcrumb covers Home > Move Asset > tag > Done. Do not hand-roll either.
- `AssetsSimulatorBar` is feature-specific demo scaffolding and does not ship.

## 4. States and responsive

- Responsive: the Move form is one column on a phone and the Status history card sits under it (see the Dev Doc Responsive Spec).
- States: not found, exited unit ("can't be moved again", with "View move details"), blocked save, and the read-only role (no Move action).
- The drawer is full width minus 24 px on a phone.
- Dark mode: the exit details panel, banners, the confirm modal and the drawer have dark equivalents. The date half of the status badge has a 1 px inset outline in its status colour (3:1 or better against the row); the status colours and fills are unchanged. The row hover in dark is opaque, so nothing shows through the pinned columns, also in Custody history.
- The confirm step and the inline reveal keep their behaviour.
- Scroll fade (app wide, `fadeScroll.client.ts` and `main.css`): the fade on a scrollable region shows only on an edge that still has content past it, none at the very top or bottom.

## 4a. Accessibility

WCAG 2.2 AA work on the new components: selected toggle text, selected card label, grey address previews, the "All required" badge (dark amber text), the Activity and Movements filter count badge (dark count on the active chip, a darker fill in light), and the opaque dark row hover. An axe run over 26 light states leaves only library or inherited items: the reka combobox and listbox roles, aria-hidden-focus when a modal opens, the design system placeholder colour (3.5:1), the existing All filters drawer headings (4.34:1) and the simulator bar. Lighthouse: Move form (desktop) accessibility 97, best practices 96, SEO 100; Assets list (mobile) 96, 100, 100. No sideways overflow at 320, 375, 768 and 1440 px.

## 5. Deliberate drift from the design system

Page title `text-2xl` here, not the canonical `text-lg`, for cohesion with the ticket tracker page. Everything else follows the design system: Inter only, the spacing scale, 24px between field groups on the Move form, semantic tokens first, no dashes.
