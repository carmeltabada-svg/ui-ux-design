# WCAG 2.2 audit: dark mode

**Date:** 2026-10-15. **Branch:** audited on `checkpoint` at HEAD `28f319d` with unrelated uncommitted changes from another session (a dashboard page, since kept out of `main`). Status as of 27 October 2026: D1, D2 and B2 are fixed, B1 is partly fixed (see the notes on each). **Standard:** WCAG 2.2, Level AA. **Method:** automated scans of the running app in dark and in light, so that failures that dark mode introduced can be told apart from ones that were already there.

This is an automated and scripted audit. Automated tools find roughly a third of accessibility problems, so **this is not a conformance statement**. What was not checked is listed at the end.

## Result in one paragraph

Dark mode did not introduce new failures of the kinds the scans can find, apart from **two small exceptions, both since fixed** (the form preview caption and the focus ring on a few controls). The dark theme is cleaner than the light one on text contrast: dark has 1 real text failure plus dimmed (inactive-looking) elements, light has about 18 distinct failing pairs. The rest of the findings below exist in **both** themes and were there before dark mode. Nothing blocks use of dark mode.

## What was run

| Check | Tool | Coverage |
|---|---|---|
| Rules for WCAG 2.0, 2.1 and 2.2 A and AA | axe-core 4.10.2, in a real Chromium, run on every screen below in dark and in light | 17 screens and states |
| Text contrast 1.4.3 | A separate scanner I wrote (resolves oklch and `color-mix` colors through a canvas, composites ancestor backgrounds and opacity, uses the large-text threshold by size and weight), run in dark and light | the same screens, plus 3 more states (a failed send, the Placeholder Check drawer, the sent banner with its toast) |
| Focus ring contrast, first 20 to 30 Tab stops | The same scanner | ticket list, ticket 424, email editor |
| Target size 2.5.8 and control boundary contrast 1.4.11 | The same scanner | all screens |
| Theme toggle: system default, keyboard, persistence, name and state | Playwright script | ticket list |
| Reflow at 320 px | Playwright script (page scroll width) | 8 pages, in dark |

Screens and states: ticket list, create ticket, tickets 422 to 426 (several stages), Templates (email and forms tabs), email editor, form editor, form preview, Master Data, offboarding checklists, the Activity Log drawer, the Cancel retrieval modal, the Simulation Control popover, the theme menu, a failed send, a sent banner and toast, the Placeholder Check drawer. Viewport 1302 px unless stated.

## Findings

### A. Introduced by dark mode (fix these)

| # | SC | Finding | Where | Fix |
|---|---|---|---|---|
| D1 | 1.4.3 (AA) | The caption "Submit the completed form to the Asset Management Team at ..." is `#6B7280` on the dark page, **3.69:1** at 11px (needs 4.5:1). It sits on the dark desk, outside the white document. | `app/pages/form-preview.vue` (`text-[#6B7280]`) | Use a theme token (`text-muted` or `text-dimmed`) instead of the fixed gray |
| D2 | 1.4.11 and 2.4.7 | Focus ring on a few controls is visible but weak: **1.58:1** on the breadcrumb links ("Home", "Ticket Tracker") and **2.22:1** on "Collapse Sidebar" (3:1 is the target for a focus indicator). Light is worse on the same controls (1.40 and 1.73). The other Tab stops tested (about 70 in all) passed. | Header breadcrumb links and the sidebar collapse button, which use their own `outline-primary` class instead of the global `:focus-visible` rule | Remove the per-component outline so the global dark ring applies, or give these controls the same ring |

### B. Present in both themes (not caused by dark mode)

| # | SC | Finding | Where | Severity |
|---|---|---|---|---|
| B1 | 4.1.2 (A) | Buttons with no accessible name: the icon-only select buttons (`role=combobox`) in the create view (2) and in drawers and the Simulation Control popover. | Create view "Case details" and "Assignment" selects; Nuxt UI selects without a label | Critical (axe), easy: add `aria-label` or tie the visible label to the control |
| B2 | 4.1.2 (A) | A `div role="button"` that contains focusable controls ("All steps" in the Communications card), so a control is nested in a control. | Ticket workspace right rail | Serious. Make the row a real button and move the inner controls out |
| B3 | 4.1.2 (A) | `aria-expanded` on a `span` popover trigger (a role that does not support it): 3 instances in the form editor (field settings). | Form editor field gear | Critical (axe), a small markup fix |
| B4 | 4.1.1 / 1.3.1 | The breadcrumb renders a link inside a link (seen in the DOM on the email editor: `<a href="/"> ... <a href="/">`). axe did not flag it consistently. | Header breadcrumb | Moderate |
| B5 | 1.4.3 (AA) | Elements dimmed with `opacity` to look inactive fail contrast: the create view sections before a team member is picked (1.8:1 to 3.7:1 in dark; worse in light) and the **Close Ticket** button (**3.45:1** in dark, 2.4:1 in light), which is `aria-disabled` but still clickable. Inactive controls are exempt from 1.4.3, but the dimmed section headings and labels are not controls, and an `aria-disabled` button that can still be clicked is arguably active. | Create view, ticket header | Already in DEV_HANDOFF section 15. Dim with color tokens that keep 4.5:1 for text, and mark the button `aria-disabled` |
| B6 | 1.4.11 (AA) | Input, select and search boundaries are low contrast (about 1.2 to 2.4:1 between the border and its surroundings). Identical in light. The scanner's reading of Nuxt UI's ring borders is approximate, so confirm manually. | Most text inputs, selects, table checkboxes | Moderate. A 3:1 border token for form controls |
| B7 | 2.5.8 (AA) | Targets under 24 px: breadcrumb links (62 x 20), "All steps" (266 x 16), checklist "Move up" (16 wide), the Required/Optional badge button (83 x 20), ticket number links (45 x 20), row checkboxes (16 x 16). Several may meet the spacing exception; not individually checked. | Header, workspace, checklist, list | Moderate. Already noted as "touch targets below 44px" |
| B8 | 1.4.10 (AA) | At 320 px the email editor overflows by 189 px and the form preview by 248 px in dark. These are desktop editors (known). Light was not re-run. | Editors | Known limitation |
| B9 | 2.4.3 (A) | After choosing an item in the theme menu with the keyboard, focus lands on a `div` instead of returning to the toggle. | Theme toggle | Minor |

### C. Light-theme failures seen on the way (not dark mode, for the record)

Avatar initials `#386be6` on `#ebf0fc` 4.17:1; white on the red "Send Overdue Reminder" 3.76:1; the "2" badge on the notification bell on a light red (1.5:1 to 4.0:1 depending on the red); placeholder text 3.51:1 (a decision); the Placeholder Check status label `#00a155` on its tint 2.99:1 and "Fixed company detail" 4.34:1; error banner helper text 4.47:1; "No paths assigned" 4.45:1. Several are already in DEV_HANDOFF section 15. None occur in dark.

## What passed in dark

- Text contrast on every other text node in the 19 screens and states scanned, including the sent banner, the "Email not sent" banner, the toast, the Placeholder Check statuses, badges and the Activity Log.
- Dark is the default only when the system asks for it: with no stored choice the page follows `prefers-color-scheme` (checked both ways), and `color-scheme: dark` is set so native controls and scrollbars follow.
- The theme toggle has an accessible name ("Color theme, currently System"), opens with Enter, exposes System, Light and Dark with a checked state, saves the choice (`ams:color-mode`) and keeps it after a reload.
- No axe rule failed in dark that did not also fail in light, apart from D1.

## Not checked (be explicit about these)

- **Screen reader testing** (NVDA, VoiceOver): reading order, announcements, live regions, the toast and banner announcements.
- **Forced colors / Windows high contrast** and `prefers-contrast`.
- **A full manual keyboard pass**: only the first 20 to 30 Tab stops on three pages and the theme menu were walked; modal focus trapping, the editors' toolbars and Escape handling were not tested.
- **Screens and states not scanned:** the Close Ticket modal (the script could not open it), the email Full Preview modal, the saved-checklists modal, the gate pass drawer and preview, the version history preview, every stage of every ticket (only tickets at the stages listed), the dashboard page (added by another session), mobile and tablet widths other than 320 px in dark.
- **Light-versus-dark colors for the documents** (email body, form document, print): documents are intended to stay light; the editor surfaces were scanned but no PDF or print output was checked.
- **WCAG 2.2 criteria that need a person:** 2.4.11 Focus Not Obscured (the sticky header over a focused control), 2.5.7 Dragging (checklist reorder has Move up and Move down), 3.3.x error handling wording, 1.4.12 text spacing and 1.4.4 resize to 200%.
- **Lighthouse:** the Chrome DevTools session was in use by another session, so Lighthouse was not run.
- **Working tree:** the scans ran against the server on port 3000, which also carries uncommitted changes from another session (a dashboard page, sidebar and navbar edits). Those pages and edits are in the result only where they appear on the screens above.

## Recommended order

1. D1 and D2 (about an hour): the form preview caption and the focus ring on the breadcrumb and sidebar controls.
2. B1 and B3 (axe "critical", small markup fixes), then B2 and B4.
3. B5 and B6 (token work) so inactive states and control borders meet contrast in both themes.
4. A manual pass with a screen reader and a full keyboard walk before calling dark mode AA conformant.
