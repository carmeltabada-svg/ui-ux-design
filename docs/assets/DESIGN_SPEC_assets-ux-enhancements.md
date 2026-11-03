# Design Spec: Assets list and asset detail UI/UX enhancements

**Status:** final. Design and layout are confirmed; this is the record of what is locked.
**Measured values live in** [AMS_DESIGN_SYSTEM.md](AMS_DESIGN_SYSTEM.md) (summary cards, heavy table filters, filter chips, info note, badge colours, assets table cell rules, truncation). This file summarises the decisions and does not repeat the numbers.
**Same design:** the Supplier Return and Client Pull-Out exit flow shares this design. Its spec is `DESIGN_SPEC_supplier-return-client-pull-out.md`.

## Locked (do not change)
- Status fills are the live `StatusBadge.vue` colours; the date half is a light tint of the fill. No existing badge or colour changes.
- The 17 column order of the table, the frozen Tag, Serial and Actions columns, whole pixel widths, no ellipsis in table cells.
- The eleven live filters and their live option lists. No Currency filter, no Legacy group, no invented filters.
- Links are blue-700 (blue-400 dark), no underline, pointer cursor. Only an office location is a link.
- Type scale: field label `text-xs font-normal text-default`, value `text-sm text-highlighted mt-1`, section label `text-xs font-semibold uppercase tracking-wide text-dimmed mb-2`, minimum text 12 px, spacing steps 4, 8, 12, 16, 24, no shadows on cards, no dashes in copy.
- Summary cards are one component pair (`AssetsSummaryCard`, `AssetsSummaryCell`) on Custody history and Movements.

## Decisions and why

| Area | Decision | Why |
|---|---|---|
| List title | The live status line "N assets tracked" with a line saying where the units are (team members, GoTeam locations, supplier or client) | The page is named in the sidebar and breadcrumb, so the title carries information; the line adds what the cards do not |
| Metric cards | Six one line cards (Total assets, In use, Ready to deploy, Overdue returns, Warranty ending in 90 days, Returned or pulled out) with tooltips | Lane pills duplicated the Status filter; these show values the filter cannot, and each can apply a filter |
| Filters | One toolbar row of the five promoted live filters, an All filters drawer for the rest, a named chip row only while a filter is on | The live filter card takes a lot of space; this keeps every filter at the cost of one row |
| Counts | In a pill on every option, faceted by the other filters | Nobody picks a value that returns nothing |
| Drawer | Same look as the Placeholder Library drawer | One drawer pattern across the app |
| Truncation | Filter values, options, chips and the search placeholder cut with an ellipsis and show a tooltip only while cut | Long values must not break the row; table cells stay in full |
| Detail rail | Three cards with an icon on every value; the model is its own field in the Warranty card | A label and value structure reads cleaner than a footnote under the period |
| Tabs | One chip row under the header on both Activity feed and Movements; equal height summary cards | Consistent position and spec across tabs |
| Custody history | Copied from the seeded R24 app, populated and empty (title strip on the age card only, neutral avatars, `# empNo`) | Matches the live page |
| Info note | `UAlert`, neutral subtle, 12 px | A recommended Nuxt component instead of custom markup |
| Seed | 30 units from the local R24 database plus 10 hand made units and 4 warranty demo units | Few units meant few use cases |

## Responsive
Table scrolls sideways with frozen identity columns (no card stack); the toolbar wraps; the drawer is full width minus 24 px on a phone and 440 px above; the detail rail drops below the content under 1280 px. Details in the Dev Doc Responsive Spec.

## Accessibility
WCAG 2.2 AA checked with axe over 28 page states; only inherited contrast failures remain (placeholder 3.5:1, `text-muted` 4.47:1 on a tinted panel). Focus ring 2 px on every control; chips and cards are buttons with `aria-pressed`; icons are decorative with `aria-hidden`.

## Not designed here
Mobile card layouts for the table, saved filter views, a Total value metric, a Legacy status group.
