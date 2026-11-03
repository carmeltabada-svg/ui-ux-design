# AMS Design System (extracted from the implementation)

Measured from the code on Oct 7, 2026: 61 Vue files under `app/`, plus `app/assets/css/main.css`, `app/app.config.ts`, and the shared components. Counts below are real usage counts, so the dominant value is the convention. Where the code disagrees with itself, the **Drift register** (last section) names the canonical value to use from now on.

How to use this file: build new UI from the tables here, not from nearby code. Nearby code can be one of the drifted outliers. Related files: `AMS_PRODUCT.md` (what the product does), `DESIGN_SYSTEM.md` (Templates builder and editor conventions), memory `ams_design_conventions` (the standing rules this file encodes).

## 0. Stack and foundations

| Item | Value |
|---|---|
| Framework | Nuxt 4.5, Vue 3.5, TypeScript |
| UI library | Nuxt UI 4.11 (Reka UI underneath), Tailwind CSS 4.3 |
| Design tool | None. Components are Nuxt UI, themed in `main.css` and `app.config.ts`. No Figma design system. |
| Font | `Inter, sans-serif` only (`--font-sans`). Never another family, including print, PDF and email export. |
| Icons | Lucide through `i-lucide-*` (`UIcon`). One icon set only. |
| Editor | Tiptap 3 with Vue NodeViews for the email and form builders |
| Dark mode | Supported. Light, Dark or System (the default), chosen in the navbar toggle and remembered under `ams:color-mode`. Nuxt UI color mode puts `.dark` on `<html>`. Section 1.5 is the dark column. Documents stay light (`.ams-paper`). |
| Colors in PDF and print | Hex, never `oklch()` (html2canvas cannot parse it), so neutral and status tokens are pinned to hex in `:root` |

Component sizing default: Nuxt UI `md` is the form control size. Toolbars and dense rows use `sm` or `xs` (see section 5).

## 1. Color

### 1.1 Semantic tokens (use these first)

Defined in `main.css` `:root` (light) and `.dark` (dark), consumed through Nuxt UI classes. The Dark column is the value under `.dark`; section 1.5 has the contrast measurements.

| Token | Value (light) | Dark | Class | Use |
|---|---|---|---|---|
| `--ui-primary` | `#386BE6` | `#7da2ff` | `text-primary`, `bg-primary`, `border-primary` | One flat brand blue, not a Tailwind ramp. Primary actions, links, selected state, focus. |
| `--ui-text-highlighted` | `#0f172a` | `#f8fafc` | `text-highlighted` | Titles, headings |
| `--ui-text` | `#334155` | `#e2e8f0` | `text-default` | Body and values |
| `--ui-text-toned` | `#475569` | `#cbd5e1` | `text-toned` | Secondary body |
| `--ui-text-muted` | `#64748b` | `#94a3b8` | `text-muted` | Helper text, descriptions, dates |
| `--color-placeholder` | `#7b8aa0` | `#98a6bb` (5.9:1, passes AA, no exception in dark) | `text-placeholder` | Placeholders (input, textarea, select, date segments) and empty-state text ("Not set", "Not yet", "Nothing recorded yet"). 3.5:1 on white, below AA on purpose, a dedicated token so the 133 `text-dimmed` uses stay `#64748b` |
| `--color-helper` | `#67778f` | `#9aa8bd` | `text-helper` | Helper and description text under a field or a title. 4.55:1 on white, the lightest slate that passes AA. `--ui-text-muted` `#64748b` stays for icons, dates and meta |
| `--ui-text-dimmed` | `#64748b` | `#94a3b8` | `text-dimmed` | Uppercase labels (4.78:1 on white, AA) |
| `--ui-bg-muted` | `#f8fafc` | `#172033` | `bg-muted` | Subtle fill |
| `--ui-bg-elevated` | `#f1f5f9` | `#263449` | `bg-elevated` | Hover and raised fill |
| `--ui-bg-accented` | `#e2e8f0` | `#334155` | `bg-accented` | Stronger fill |
| `--ui-border` | `#e2e8f0` | `#334155` | `border-default` | Every card, divider and table line (157 uses) |
| `--ui-border-accented` | `#cbd5e1` | `#6b7a92` | `border-accented` | Dashed or emphasized outlines |
| `--ui-success` | `#00A155` (green-600) | `#4ade80` | `text-success`, `bg-success` | Success |
| `--ui-warning` | `#ea580c` (orange-600) | `#fb923c` | `text-warning` | Warning |
| `--ui-error` | `#ef4444` | `#f87171` | `text-error`, `color="error"` | Destructive and errors |
| `--ui-info` | `#3b82f6` | `#60a5fa` | `text-info` | Info |

Rule: status colors use the **600 shade**, never 500 or lighter. Text in a status color on white uses **700** (`text-red-700`, `text-orange-700`, `text-green-700`) so it passes 4.5:1.

### 1.2 Surfaces

Light classes stay as written. In dark, `bg-white` is gone: use `bg-card` (`--color-card`, white in light and `#1e293b` in dark). Tailwind `gray` and `slate` 50 to 300 and the tinted 50 to 300 of each status hue are redefined under `.dark`, so `bg-gray-50`, `border-gray-200` and `bg-red-50` follow the theme with no `dark:` class.

| Surface | Light | Dark |
|---|---|---|
| Page (`bg-gray-50`, `--ui-bg`) | `#f9fafb` | `#0f172a` |
| Card, header, popover (`bg-card`) | `#ffffff` | `#1e293b` |
| Strip (`bg-slate-50`, `bg-muted`) | `#f8fafc` | `#172033` |
| Hover and track (`bg-gray-100`, `bg-elevated`) | `#f1f5f9` | `#263449` |
| Border (`border-default`, `border-gray-200`) | `#e2e8f0` | `#334155` |
| Control edge (`border-accented`, input ring) | `#cbd5e1` | `#6b7a92` (3.4:1 on a card) |

| Surface | Class | Notes |
|---|---|---|
| Page background | `bg-gray-50` (53) | Pages sit on light gray, cards are white |
| Card, header, popover | `bg-white` (75) | |
| Table header strip | `bg-slate-50` (13) | Each cell owns the fill, never the `tr` (sticky columns) |
| Row hover | `group-hover:bg-gray-50` | |
| Tinted primary | `bg-primary/10` (27), `bg-primary/5` (16) | Selected, active nav, "used" rows |
| Overlay | Nuxt UI default | |

### 1.3 Status and tone palette

| Meaning | Fill or border | Text on white |
|---|---|---|
| Active, success | `rgb(0,127,69)` solid pill, `green-600` accent | `rgb(0,127,69)` or `green-700` |
| Retired | `rgb(137,75,0)` solid pill | `#894b00` |
| Draft, neutral | white fill, `#64748b` text, `#cbd5e1` border | `slate-600` |
| Warning | `orange-600` accent, `bg-orange-50/70`, `border-orange-300` | `orange-700` (`#894b00` on tinted badges) |
| Danger | `red-600` accent, `bg-red-50/70`, `border-red-300` | `red-700` |
| Info | `blue-600` accent, `bg-blue-50/60`, `border-blue-300` | `blue-700` |
| Required badge | `bg-orange-700 text-white` (single AA exception to the 600 rule) | |
| Active nav | `rgb(239,246,255)` fill, `text-blue-700` | |

Banner tone map lives in `shared/Banner.vue` (`TONES`). Never restate it.

### 1.5 Dark theme

Source of truth is `main.css`: the `.dark` block, the text overrides in `@layer utilities`, and the focus ring at the end. Dark values are plain hex or rgba, never `oklch()` or `color-mix()` (html2canvas, see section 0).

**Contrast, measured.** Ratio of each text color on the four dark surfaces.

| Text | Value | Page | Card | Strip | Hover |
|---|---|---|---|---|---|
| `text-highlighted` | `#f8fafc` | 17.1 | 14.0 | 15.5 | 12.0 |
| `text-default` | `#e2e8f0` | 14.5 | 11.9 | 13.2 | 10.2 |
| `text-toned` | `#cbd5e1` | 12.0 | 9.9 | 11.0 | 8.5 |
| `text-muted`, `text-dimmed` | `#94a3b8` | 7.0 | 5.7 | 6.3 | 4.9 |
| `text-helper` | `#9aa8bd` | 7.4 | 6.1 | 6.7 | 5.2 |
| `text-placeholder` | `#98a6bb` | 7.2 | 5.9 | 6.6 | 5.1 |
| `text-primary`, links | `#7da2ff` | 7.2 | 5.9 | 6.6 | 5.1 |
| `text-success` and `text-ams-success` | `#4ade80` | 10.2 | 8.4 | 9.3 | 7.2 |
| `text-warning` | `#fb923c` | 7.9 | 6.5 | 7.2 | 5.6 |
| `text-error` | `#f87171` | 6.5 | 5.3 | 5.9 | 4.5 |
| `text-info` | `#60a5fa` | 7.0 | 5.8 | 6.4 | 4.9 |
| `text-ams-warning` | `#fdba74` | 10.6 | 8.7 | 9.6 | 7.5 |
| `text-ams-remote` | `#c4a3ff` | 8.5 | 7.0 | 7.8 | 6.0 |

Rules for dark:
- **One primary token feeds text and fill** in Nuxt UI, so dark primary is `#7da2ff` and a solid primary button is `#7da2ff` with dark text (7.2:1). The light `#386BE6` is not used on dark surfaces.
- **Status pills keep their solid fills** (`rgb(0,127,69)`, `rgb(137,75,0)`, `bg-orange-700`) with white text. Status text (not fills) uses the lighter tokens: `text-ams-success`, `text-ams-warning`, and `text-red-700` or `text-orange-700` and the other 600 to 800 shades, which `main.css` maps to light tints under `.dark`.
- **No hard-coded surface colors.** `bg-white` becomes `bg-card`. The pinned `rgb(0,127,69)` text becomes `text-ams-success`, `#894b00` becomes `text-ams-warning`, the active nav fill becomes `bg-ams-nav`, and the remote badge uses `--color-ams-remote`. Fills written as solid `bg-[rgb(0,127,69)]` stay (they carry white text or are dots).
- **Placeholder passes AA in dark.** The light exception (3.5:1) is not carried over.
- **Focus ring** is a full strength 3px primary outline in dark (5.9:1 on a card, 7.2:1 on the page). Nuxt UI's own ring is the primary at 25% opacity, about 1.6:1.
- **Documents stay light.** Add `ams-paper` to any surface that stands for paper or a real email client: `/form-preview` (the form as a team member sees and prints it), the gate pass preview, the closure record attachment, and the simulator bar. The email editor and the form editor (canvas and page) are dark. A form page uses the `--ams-doc-*` tokens in `main.css` (page, text, label, hint, border, error, accent), which are the original hex values in light and on any `ams-paper` surface. Signature drawing and upload areas are a small light chip, because a signature is dark ink. User-picked text colors inside a document are inline and do not follow the theme. Inside `.ams-paper` every token above returns to its light value, so a white document sits inside the dark app. Do not put a translucent background directly on a paper surface (it blends with the dark page). Printed output is forced light by `@media print` in `main.css`.
- **Any new global class** is namespaced `ams-`.

### 1.4 Placeholder token highlight (editors and previews)

| State | Style |
|---|---|
| Default `.tok-hl` | `rgba(56,107,230,0.09)` fill, 3px radius, 0 2px padding |
| Hover | `0.18` |
| Active (just clicked) | `0.35` fill, `#1e3a8a` text, 1px ring, 0.6s pulse |
| Missing (ticket check) | orange `rgba(234,88,12,0.14)` |

In dark the same states use `--ams-tok-*`, `--ams-miss-*`, `--ams-bad-*` and `--ams-const-*` in `main.css` (the blue is `rgba(125,162,255,0.2)`, active text `#e0e9ff`). On a paper surface they stay at the light values above.

## 2. Typography

Family: Inter. Sizes in use (class counts): `text-xs` 505, `text-sm` 262, `text-base` 25, `text-lg` 8, `text-2xl` 4, `text-xl` 1.

| Role | Classes | Where |
|---|---|---|
| Page title | `text-lg font-semibold text-highlighted` | Page header next to the back button |
| Card or section title | `text-sm font-semibold text-highlighted` (or `text-default`) | Card headers |
| Modal and drawer title | `text-base font-semibold text-highlighted` | |
| **Field label** | `text-xs font-normal text-default` (+ `block mb-2` above a control, `mb-1` above plain text) | Sits on its own line ABOVE the value, never beside it. 12px, regular, `#334155`. |
| **Value** | `text-sm text-highlighted` | 14px, regular, `#0f172a`. The same style for typed values (Nuxt UI default, no override) and displayed values, so read and edit look the same |
| Description | `text-sm text-muted` | Under a page title |
| Helper text | `text-xs text-helper` (`mt-1` under a control or a title) | `#67778f`, the lightest slate that passes AA. Sits BELOW its control, never beside |
| Meta, date and time | `text-xs text-muted`, joined with a centre dot, one color | |
| Table header | `text-xs font-semibold uppercase tracking-wide` on `bg-slate-50` | |
| Error text | `text-xs text-red-600 mt-0.5` | Field validation |

### 2.1 Field labels, values and section labels (exact spec)

Sizes are Tailwind defaults: `text-xs` is 12px on a 16px line, `text-sm` is 14px on a 20px line, `text-base` is 16px on a 24px line. `tracking-wide` is 0.025em. Font family is Inter for all of them.

| Element | Size | Weight | Case and tracking | Color (token, hex) | Spacing | Classes |
|---|---|---|---|---|---|---|
| **Field label** (above an input, dropdown, chip) | 12px | 400 | Sentence case | `text-default` `#334155` | 8px below, 24px above the next group | `text-xs font-normal text-default block mb-2` |
| **Field label** (above plain text) | 12px | 400 | Sentence case | `text-default` `#334155` | 4px below | `text-xs font-normal text-default block mb-1` |
| **Field value** (plain text) | 14px | 400 | Sentence case | `text-highlighted` `#0f172a` | 4px under its label | `text-sm text-highlighted mt-1` |
| **Field value** (input, select, textarea) | 14px | 400 | Sentence case | `text-highlighted` `#0f172a` (the Nuxt UI default, no override), placeholder `text-dimmed` `#64748b` | Nuxt UI `size="md"` | no extra classes |
| **Value, emphasized or numeric** | 14px | 500 | | `text-highlighted` `#0f172a` | | `text-sm font-medium text-highlighted` (names and figures that lead a card; not for ordinary values) |
| **Value, empty or "Not set"** | 14px | 400 | | `text-placeholder` `#7b8aa0` | | `text-sm text-placeholder` |
| **Value, link or action text** | 14px | 500 | | `text-primary` `#386BE6` | | `text-sm font-medium text-primary` |
| **Helper text** (below its control) | 12px | 400 | Sentence case | `text-helper` `#67778f` (4.55:1) | 4px above | `text-xs text-helper mt-1` |
| **Validation error** | 12px | 400 | | `#DC2626` red-600 (use `text-red-700` `#b91c1c` when AA matters) | 2px above | `text-xs text-red-600 mt-0.5` |
| **Section label** (names a group inside a card or drawer, no box) | 12px | 600 | Uppercase, +0.025em | `text-dimmed` `#64748b` | 6px below, 16px above the second group in a list | `text-xs font-semibold uppercase tracking-wide text-dimmed mb-1.5` (`mt-4` for the later groups) |
| **Section header** (the strip of a collapsible rail card or table band) | 12px | 600 | Uppercase, +0.025em | `text-default` `#334155` on `bg-slate-50` `#f8fafc` | `px-4 py-2.5`, chevron `size-4` `text-muted` at the end | `text-xs font-semibold uppercase tracking-wide text-default` |
| **Section title** (a card with a heading, not a strip) | 14px | 600 | Sentence case | `text-highlighted` `#0f172a` (or `text-default` inside a rail) | `px-4 py-2.5` to `px-5 py-3` | `text-sm font-semibold text-highlighted` |
| **Section label with a count or status** ("Used in this template") | 12px | 600 | Uppercase, +0.025em | `text-primary` `#386BE6` on `bg-primary/10`, or `text-muted` on `bg-elevated` `#f1f5f9` for the unused group | `px-3 py-2`, `rounded-lg`, count in a `rounded-full` `xs` badge | `text-xs font-semibold uppercase tracking-wide text-primary` |
| **Inline row label** (stepper side labels, time labels) | 12px | 600 | Uppercase, +0.05em | `text-dimmed` `#64748b` | `min-w-10`, top aligned to the first line | `text-xs font-semibold uppercase tracking-wider text-dimmed` |

Rules that go with the table:
- A label is always on its own line above the value, never label-left and value-right.
- 24px (`gap-6` or `mb-6`) separates field groups. The 24px is for separation only: a helper text and the control it explains stay about 8px apart.
- Label color is `text-dimmed` for field and section labels, `text-default` only for a section header strip, `text-primary` only for a "used" or active group. Never `text-gray-400` for text (it fails contrast).
- Values never go semibold or above 14px inside cards. Semibold is for titles and labels.
- The three layers are separated by color first: value `#0f172a` (17.9:1), label `#334155` (10.4:1), helper text `#67778f` (4.55:1), placeholder and empty state `#7b8aa0` (3.5:1, below AA on purpose). Label and helper text must be clearly distinguishable to a normal reader; `#67778f` is as light as a slate gray can go and still pass AA, so do not lighten it further.
- The create ticket view groups its fields into section cards (`rounded-lg border border-default bg-white px-5 py-5`, 24px apart), each with a `text-sm font-semibold text-highlighted` heading: Team member, Case details, Dates, Assignment, Summary.

### 2.2 Primary and secondary styles

Primary is the standard above and applies by default. Secondary is a short list of approved overrides for screens where fidelity to a document or to Outlook matters. An override is added to this table with its reason, and ordinary app UI never gets one.

| Secondary style | Where | What differs from primary | Reason |
|---|---|---|---|
| Email subject line | Email template editor, read view (`SubjectField.vue`) | 16px semibold `text-highlighted` instead of 14px regular | Matches how Outlook shows a subject. The edit input is still 14px; decide whether to match it |
| Form field labels | Forms editor document (`FormFieldNodeView.vue`, `FormDocumentField.vue`) | `text-highlighted`, semibold, uppercase | The form is a printed document, not interface |
| Printed and generated documents | Audit document, form print styles, gate pass preview | Their own typography, uppercase captions | Paper output |


Weights: `semibold` 256, `medium` 191, `normal` 22, `bold` 14. Use semibold for titles and labels, medium for values, normal for descriptions. Avoid bold.
Tracking: `tracking-wide` for every uppercase label (107 uses). Line height: `leading-relaxed` only for long reading text (email preview), `leading-snug` or `leading-tight` for titles.
Minimum text size is 12px. `text-[10px]`, `text-[11px]` and `text-[9px]` exist only on badges and counters (see Drift register).

## 3. Spacing

Dominant steps, from counts. Use only these. The scale is a 4px base: 4, 8, 12, 16, 24, 32. Do not introduce 2px, 6px or 14px gaps between a label, its value or control, and the text under it (`mt-0.5`, `mb-0.5`, `mb-1.5`, `mt-1.5`, `mb-3.5`); icon nudges that align an icon with the first line of text are the only exception. Measured before the change, the label to field gap was 6px (47 labels), 2px (10), 8px (2) and 14px (1), and helper text sat 2, 4, 6, 8 or 12px under its field.

| Purpose | Value | Class |
|---|---|---|
| Icon to text, tight inline | 6px | `gap-1.5` (88) |
| Standard inline and row gap | 8px | `gap-2` (140) |
| Group of related controls | 12px | `gap-3` (69) |
| Tighter pair | 4px | `gap-1` (65) |
| Section gap inside a card | 16px | `gap-4` (22) |
| **Between field groups** | **24px** | `gap-6` or `mb-6` (51) |
| Label to plain value | 4px | `mt-1` |
| Label to an input, dropdown or chip | 8px | `mb-2` |
| Helper text under a control | 4px | `mt-1` |
| Hint or note and the control it refers to | 8px | stays grouped, not 24px |
| Value to its supporting detail (address, account manager) | 4px | `mt-1`, detail is `text-xs text-toned`; a "Label value" pair uses `text-muted` for the label part and `font-medium text-default` for the value part |

Padding:

| Element | Value |
|---|---|
| Card body | `p-4` (16px), roomy cards `px-5 py-4` |
| Card header row | `px-4 py-2.5` to `px-5 py-3`, `border-b border-default` |
| Table cell | `px-4 py-3.5` |
| Table header cell | `px-4 py-3.5` |
| Dense list row | `px-3 py-2` |
| Pill badge | `px-1.5 py-0.5` |
| Page gutter | `px-6` (see Drift register for the ticket workspace) |
| Modal body and footer | Nuxt UI default |
| Popover with a list | `p-1` (items) or `p-2` (swatches) |

Grid: `grid grid-cols-*` 34 uses. Two-pane layouts use `lg:grid-cols-[320px_minmax(0,1fr)] gap-6`.

## 4. Shape, borders, depth

| Item | Value |
|---|---|
| Card | `rounded-lg border border-default bg-white` (the base pattern, 39 uses with border) |
| Control, menu item, small chip | `rounded-md` |
| Pill, avatar, status | `rounded-full` (103) |
| Table container | `rounded-lg` with first and last header cells rounded |
| Dividers | `border-b border-default` (65), `border-t` (35) |
| Dashed hint area | `border border-dashed border-default` or `border-accented` |
| Banner | soft tinted stroke all round, 4px left accent, square left corners |
| Shadow | Almost none. `shadow-sm` only on small raised bits (8). Overlays use Nuxt UI `shadow-lg`. Do not add shadows to cards. |
| Ring | `ring-1 ring-default` on menus and chips, `ring-2 ring-white` to cut a badge out of an avatar |

## 5. Components (Nuxt UI usage)

### 5.1 Buttons (`UButton`, 302 uses)

| Intent | Props | Count |
|---|---|---|
| Toolbar or icon action | `color="neutral" variant="ghost" size="xs"` or `sm`, usually `square` | 95 |
| Primary action | `color="primary"` solid, `size="sm"` (or `md` in headers, modals) | 49 |
| Secondary action | `color="neutral" variant="outline"` | 52 |
| Quiet primary | `color="primary" variant="ghost"` or `link` | 18 |
| Destructive | `color="error"` (solid in confirm modals, outline for the trigger, ghost for row icons) | 10 |
| Tonal pick | `variant="soft"` | 8 |

Rules:
- One primary action per state. Show the action that applies now, fallbacks as quiet links beside it. No disabled primary that cannot be used yet. No repeat-send buttons, show the sent record instead.
- Icon-only buttons are `square`, carry `aria-label`, and have a `UTooltip` with the same text.
- Header actions use `size="md"`. Page toolbars use `sm`. Dense rows and drawer chrome use `xs`.
- A button that looks disabled but explains itself uses `aria-disabled` plus a reason (tooltip or toast), not a silent `disabled`.

#### Dashboard button hierarchy (audited + normalized, Oct 2026)

The dashboard reads as four tiers, separated by **zone** (where the control lives) and by **primary = act, neutral = navigate/filter-chrome**:

| Tier | Role | Treatment | Where |
|---|---|---|---|
| Selected / on | the current choice or an active filter | `color="primary" variant="solid"` | Segmented quick-chips (selected), header **Period** (active) + **Needs action** (on), active tab |
| Act | the operational next step | `color="primary" variant="soft"` (row), solid in the confirm dialog | `RowAction` row button; dialog confirm CTA |
| Tools | one-shot actions + inactive controls | `color="neutral" variant="outline"` | Export, Filters trigger, Sort, inactive Period/Needs-action, chips, `StateBlock` retry/clear, dialog "Not now" |
| Navigate | move to another view | `variant="link" color="neutral"` (muted) | Overview card links ("Open the Flagged tab", "View all assets", "Review warranty cases"), "Clear all"; the whole metric card / KPI tile is a bare clickable surface (ring + hover, no button chrome) |

Sizes descend by zone: header `md` → panel toolbars `sm` → row actions `xs`. Keep both header toggles on the **same** active treatment (solid primary); navigation links stay **neutral** so they don't compete with the primary "act" colour.

### 5.2 Form controls

| Control | Size | Notes |
|---|---|---|
| `UInput`, `USelect`, `USelectMenu`, `UTextarea` | `md` (14px value) | Filters in toolbars use `sm` |
| `UFormField` label | `text-xs` | Labels stay 12px, values 14px |
| Select | `SharedSelect` | Plain select up to 7 items, searchable above 7 |
| Dropdown or menu with many items | add `filter` once more than 5 items (max-height 220 to 288px) | |
| Selected item in a menu | label `text-primary font-medium` plus a `text-primary` check | |
| Date | `SharedDatePicker` | |
| Required marker | `FieldLabel` and `UFormField` red asterisk | |
| **Optional** | `<UBadge color="neutral" variant="outline" size="sm">Optional</UBadge>` beside the label, never the text "(optional)" | One style everywhere, the same badge as the P&C Acknowledgement card |
| **Selected option** in any select or dropdown | label `text-primary` medium, check icon `text-primary` | Set once in `app.config.ts` for select, select menu, input menu and dropdown menu (checked state), so no per-instance `ui` is needed |

### 5.3 Badges and status

- Status or mode pill: dedicated `StatusBadge` and `ModeBadge`, `text-xs font-semibold px-1.5 py-0.5 rounded-full border`. Do not use `UBadge xs` next to them (it renders smaller). `UBadge` is used for counts only (13 uses).
- Count chip: `UBadge variant="subtle" size="xs"` or the `rounded-full` solid chip.
- Unread dot or count: `size-2` dot or `min-w-[18px] h-[18px]` red chip with `ring-2 ring-white`.

#### Asset status badge colours (live Assets app, `models/CompanyAsset/StatusBadge.vue`)

Each status in `asset_statuses.php` has a `color` keyword. `StatusBadge.vue` turns it into a Tailwind 4 class; `it/` does not override Tailwind's colours, so these are the standard values (hex is the sRGB equivalent of the oklch value).

| Keyword | Badge class | Hex | Hover | Hover hex |
|---|---|---|---|---|
| green | `bg-green-700` | #008236 | `green-800` | #016630 |
| blue | `bg-blue-700` | #1447E6 | `blue-800` | #193CB8 |
| yellow | `bg-yellow-500` | #F0B100 | `yellow-600` | #D08700 |
| orange | `bg-orange-500` | #FF6900 | `orange-600` | #F54900 |
| purple | `bg-purple-700` | #8200DB | `purple-800` | #6E11B0 |
| red | `bg-red-700` | #C10007 | `red-800` | #9F0712 |
| gray | `bg-gray-600` | #4A5565 | `gray-700` | #364153 |
| teal (new) | `bg-teal-700` | #00786F | `teal-800` | #005F5A |
| pink (new) | `bg-pink-700` | #C6005C | `pink-800` | #A3004C |

The date half on the right of every badge is always `bg-gray-600` (#4A5565). All badge text is white. Size: `px-1.5 py-0.5 text-xs` in tables (`px-2 py-1 text-sm` is the medium size).

Colour per status, by lane:

| Lane | Status: colour |
|---|---|
| 1. Intake and Ready Pool | Available: green · For IT Configuration: blue · In Configuration: blue · Pending Deployment: orange |
| 2. Active Use | In Use: blue · Pending Replacement: orange · Scheduled Replacement: orange |
| 3. Return and Triage | Pending Return: orange · Overdue Return: red · Hold Off: yellow · Returned Device Servicing: purple · Returned Item Check: purple · Warranty Processing: yellow |
| 4. Review and Investigation | Forensic Review: red · Under Investigation: red |
| 5. Decommissioning | Decommissioned: gray · Decommission Checking: purple · For Disposal: red · Pending Sale: yellow |
| 6. Terminal | Disposed: gray · Sold: green · Recovery Deduction: green · Charged Deduction: orange · Gifted: green · Missing: red · **Supplier Return: teal (new)** · **Client Pull-Out: pink (new)** |
| Legacy | Under Repair: yellow · In Transit: purple · Defective: red · Pending Disposal: orange · For Inspection: yellow |

**New statuses take a colour no existing status uses.** Teal and pink are unused, so Supplier Return and Client Pull-Out cannot be mistaken for another status. Before adding a status colour, check this table; do not reuse one.

**Sub-status is not part of the badge.** The live list renders it as a separate neutral chip beside the badge (`rounded-md bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200`). Client Pull-Out follows this: a pink status badge with the date, then a grey Competitor or Direct Hire chip. Sub-statuses never get their own colour.

#### Assets table cells (from the live Assets list and the dashboard)

| Column | Cell |
|---|---|
| Type | Type icon (backend `asset_types.fontawesome_icon`; Computer Equipment is `fa-computer-speaker`, `i-lucide-monitor-speaker` in the prototype) + label |
| Model | Link-styled button. In the prototype it toasts that the asset model detail page is an existing view, out of scope |
| Status | Solid status badge with the date half. No sub-status in the table |
| Tech Pack | Dashboard badges: plan soft + icon (Rental blue `repeat`, Purchase orange `badge-check`, BYOD teal `laptop`), tier outline (Standard slate, High green, Ultra violet). BYOD has no tier |
| Owner | Always an avatar (initials square, `size-6 rounded-md bg-elevated`) + name |
| Location | Icon + text by rule: in use by a team member shows the member's address (house icon); at a supplier shows the supplier (truck); otherwise the location name (building) |
| Empty value | `i-lucide-minus` in `text-dimmed` with an "None" accessible label, never a typed dash |
| Actions | Centered, the column hugs its content |

Loading rows use skeletons shaped like each real cell (avatar circle, badge pill, link bar), inside the real table so the layout does not jump.

#### Blocked save on a form

When a save is blocked, scroll the error banner into view (`scrollIntoView` smooth, centered), pulse it with `flashElement`, and mark every missing field (red ring or `color="error"` plus a one-line reason under it). Do not leave the officer guessing why nothing happened.

#### Summary cards (Assets detail tabs: Custody history and Movements)

One component pair builds every summary card so the tabs cannot drift: `AssetsSummaryCard` (the card) and `AssetsSummaryCell` (one labelled value).

| Part | Spec |
|---|---|
| Card | `rounded-lg border border-default bg-card`, no shadow, `overflow-hidden` |
| Header strip | the section header strip: `px-4 py-2.5 border-b border-default bg-slate-50`, `text-xs font-semibold uppercase tracking-wide text-default` |
| Header strip | optional: the left card has the strip, the right card has none (as on the live Custody page) |
| Cell | `px-4 py-4`; label `text-xs font-semibold uppercase tracking-wide text-dimmed mb-2`; value `text-base font-semibold text-highlighted`; supporting line `text-xs text-muted mt-1`, at most two lines |
| Person value | a 24px neutral avatar (`bg-elevated text-muted`, initials), the name `text-sm font-medium`, then a muted suffix `text-sm font-normal text-muted` (employee number, status or "by name"). Use `flex`, not `inline-flex`, so the row is 24px |
| Stacked cells | the inner edges are `!pb-3` on the first and `!pt-3` on the second, so the gap between them is 24px plus the divider. The outer padding stays 16px |
| Dividers | `w-px bg-default` between side by side cells, `h-px bg-default` between stacked cells |
| Layout | two cards: `grid md:grid-cols-[1.4fr_1fr] gap-4`, equal height. Left card has two side by side cells, right card two stacked cells |

#### Filter chips (Activity feed and Movements)

`AssetsFilterChips`: the ticket tracker table chip (`UButton` size sm, `rounded-full`, outline neutral, solid primary when active) with the count in a pill badge. It sits directly under the tab header and summary cards, above the list, on every tab that has one.

#### Heavy table filters (Assets list)

The live page's eleven filters and no others (Tech Pack Currency is switched off there, so it is not built), without the tall panel.

| Part | Spec |
|---|---|
| Toolbar | one row that wraps: search, then the five promoted filters (Status, Asset Type, Asset Name, Ownership, Warranty Status) as small outline select menus with a primary count pill once something is picked, then "All filters" with a count badge, then "Clear" |
| Option lists | as the live page: Status grouped under lane headings with every status listed, A to Z inside a lane; Asset Type as "CE - Computer Equipment"; Asset Name disabled until a type is picked, then only the names of those types; Ownership "GoTeam-Owned" then "Client-Owned"; Warranty "Already Expired", "Expiring in 30, 60, 90 Days"; Movement "Checked In", "Checked Out"; Location "Office Location", "Supplier", "User Address"; Tech Pack Type BYOD, Monthly Rental, Outright Purchase |
| Search | Status, Brand and Checked Out To have a search box in the list |
| Counts | each option shows its count in a `neutral subtle sm` pill, faceted by the other filters; a picked value stays listed so it can be unpicked |
| All filters drawer | built like the Placeholder Library drawer: `USlideover inset`, `max-w-[440px]`, header with title, 12px helper and a ghost close button, a pinned strip (result count and an "N applied" pill), a scrolling body with section strips (`rounded-lg bg-elevated px-3 py-2`, 12px semibold uppercase, count pill) for Hardware, Commercial and Lifecycle, and a pinned footer (Clear all, Show N assets). The promoted filters sit at the top with no strip |
| Applied chips | a row under the toolbar, only while something is applied: `Name: values` with a remove button, plus "Clear all" |
| Metric cards | one line each under the title: a colour dot, a muted label and a semibold value, `rounded-lg border px-3 py-1.5`, over all assets. Total assets, In use, Ready to deploy, Overdue returns, Warranty ending in 90 days, Returned or pulled out. A card that maps to a filter applies it on click and shows the primary ring while active. They do not repeat the status filter by lane |
| Truncation | filter values, option labels, applied chips and the search placeholder cut with an ellipsis when they do not fit (`AssetsTruncate`), and the full text shows in a tooltip only while it is cut. Each metric card carries a tooltip with what it counts and how. Table cells are not cut |
| Title line | the title is the live status (`N assets tracked`); the line under it says where the units are (with team members, at GoTeam locations, at a supplier or client) |

#### Info note (Custody history)

`UAlert` `color="neutral" variant="subtle"` with the info icon and description `text-xs text-default`.

#### Dashboard badge system (`dashboard/Badge.vue` + `dashboard/StatusBadge.vue`, added Oct 2026)

The dashboard mirrors the **live Assets app** (`assets-test.go.team`), where badges are **solid**, not tinted. One primitive, `DashboardBadge`, with three levels that form a strict hierarchy (`rounded-md`, not the app's `rounded-full` pill):

| Level | `variant` | Use | Style |
|---|---|---|---|
| 1 (loudest) | `solid` | Asset status — the row's identity | white text on the status colour |
| 2 | `soft` | Severity, plan, sub-status | `bg-{tone}-50 text-{tone}-700 border` (+ dark `-950/-300/-900`) |
| 3 (quietest) | `outline` | Tech-pack tier | border + `text-{tone}-700`, transparent fill |

Read order: **solid status ≫ soft-dot severity ≫ soft-icon plan ≫ outline tier.** Severity keeps a leading dot; plan a leading icon (rental `i-lucide-repeat`, purchase `i-lucide-badge-check`); sub-status is a quiet grey soft badge beside the solid status. Never colour the status badge by severity — status colour is set by the status, severity is its own soft chip.

**Solid status colour is the live app's own map** (`statusTone()` + `STATUS_TONE` in `data/dashboard.ts`, from `asset_statuses.php`): 700 for cool/alarm tones, 500 for warm. All text white.

| Keyword | Class | Hex |
|---|---|---|
| green | `bg-green-700` | `#008236` |
| blue | `bg-blue-700` | `#1447E6` |
| yellow | `bg-yellow-500` | `#F0B100` |
| orange | `bg-orange-500` | `#FF6900` |
| purple | `bg-purple-700` | `#8200DB` |
| red | `bg-red-700` | `#C10007` |
| gray | `bg-gray-600` | `#4A5565` |

Status → colour, by lane (verbatim from the live app; keep `STATUS_TONE` in sync):
- **Intake/Ready:** Available green · For (IT) Configuration blue · In Configuration blue · Pending Deployment orange
- **Active Use:** In Use blue · Pending Replacement orange · Scheduled Replacement orange
- **Return/Triage:** Pending Return orange · Overdue Return red · Hold Off yellow · Returned Device Servicing purple · Returned Item Check purple · Warranty Processing yellow
- **Review:** Forensic Review red · Under Investigation red
- **Decommissioning:** Decommissioned gray · Decommission Checking purple · For Disposal red · Pending Sale yellow
- **Terminal:** Disposed gray · Sold green · Recovery Deduction green · Charged Deduction orange · Gifted green · Missing red
- **Legacy:** Under Repair yellow · In Transit purple · Defective red · Pending Disposal orange · For Inspection yellow

#### Dashboard page patterns (`pages/dashboard.vue`, `components/dashboard/*`)

- **Metric card (`LensCard`, built to `container.svg`):** `rounded-lg` ring card, 115px body + 48px footer strip (`bg-muted`) split by a divider. Body is `overflow-hidden` so the faint watermark icon (`size-32`, `opacity-[0.06]`, horizontal `linear-gradient(to right, <tone>, transparent 55%)`, `translate-x-[37%]`) peeks off the **right edge only** and never enters the footer — kept faint, not busy. Count in the tone colour, 30px bold. Featured card (Total Assets) gets a subtle `from-card to-blue-50` wash.
- **White header band + scroll-away layout:** the greeting + card strip sit in a solid `bg-card` band (the page root is `bg-gray-50`, so the header reads white and the content area grey). They scroll away; only the tab zone is `sticky top-0`, and that zone also carries a solid `bg-card` fill so nothing shows through when stuck. Once the cards scroll out a compact summary bar (`cardsPinned` via IntersectionObserver) appears in the pinned zone.
- **Header controls (right of the title):** two real controls over the whole dashboard, not navigation — a **Needs-action focus** toggle (`focusNeedsAction`; narrows every list view to High/Medium + ex-staff, dropping clean/low-noise rows) and an **Export** button (CSV of the current record view; disabled on Overview and the teasers). Greeting subtitle gives a value read, not filler ("See where the fleet stands, and where it needs you today.").
- **All states, no dead ends:** the `Dashboard` simulator control (`simTable`: normal / loading / empty / error / edge) drives the **whole** dashboard, not just the tables. `dashboard.vue` renders a content skeleton for `loading`, a `DashboardStateBlock` error + retry for `error` (both for every view), and an empty state for Overview on `empty`; the record tables keep their own empty/filtered states. Every view therefore has a designed loading, empty and error state.
- **Table pattern:** always-visible search + severity quick chips (`DashboardSegmented`) + sort; everything else behind a funnel `DashboardFilterPopover`. Pinned first column(s) via `.ams-sticky`, right-edge `.fade-scroll-x`. No per-table count summary beside the filters (the metric cards already carry those numbers).
- **Clients tab:** an asset view, not a client tracker — clients ranked by the assets we hold with them, no severity, no "needs attention" framing. Clients never carry a severity grade (the model grades assets only).
- **Greeting:** time-aware, by the operator's **first name** (`OPERATOR_FIRST_NAME` map for the initial-only personas); no repeated "Dashboard", no repeated attention counts.

### 5.4 Banners (`SharedBanner`, one component)

White surface, tinted stroke, 4px left accent, icon, title 14px semibold, description and helper 12px `text-muted`. Tones: info, success, warning, danger, neutral. `compact` for notes inside a field group. One banner per stage, never two stacked. A sent or confirmed record uses `SentBanner` (title, short description, date and time on the far right).

### 5.5 Modals (`UModal`)

| Part | Spec |
|---|---|
| Width | `max-w-md` default (5), `max-w-lg` for forms (4), `max-w-sm` for a simple confirm, `max-w-[720px]` for previews |
| Header | `text-base font-semibold text-highlighted` title, optional leading icon (`text-error size-5` for destructive), ghost `sm` `square` `i-lucide-x` close |
| Body | `text-sm text-default` |
| Footer | `flex justify-end gap-2 w-full`, dismiss left (`outline neutral`), confirm right |
| Destructive confirm | confirm is `color="error"`, copy names the action |

Button copy: the dismiss button names the safe outcome ("Keep it", "Keep ticket", "Not yet", "Not now", "Keep current"), the confirm names the action ("Delete template", "Cancel retrieval", "Close ticket", "Apply change", "Take over ticket"). Never a bare Cancel or OK.

### 5.6 Drawers (`USlideover`)

Right side, inset: `inset w-[calc(100%-1.5rem)] inset-y-3 right-3`, `max-w-[440px]` for libraries, `max-w-md` default. Header: outline `xs` `rounded-full` `square` close button on the left (retrieval drawers) or ghost `sm` close at the top right (Placeholder Library), `text-base font-semibold` title, `text-xs text-muted` subtitle, optional context badge. Pinned search and filters above the scrolling body. Body scrolls with the edge fade (section 8).

### 5.7 Popovers and menus

`UPopover` and `UDropdownMenu` content widths `w-40` to `w-72` (small menus w-48, pickers w-72, create menu w-64 to w-80). Popover content `p-1` or `p-2`. Browsing popovers and menus: scrollable above about 7 items, with search above 5 to 7 items. Return of focus after a pick is suppressed (`onCloseAutoFocus` prevent) when the trigger sits in a scrolled page.

### 5.8 Tables and lists

Container `rounded-lg border border-default bg-white`. Header cells `bg-slate-50`, `px-4 py-3.5`, uppercase 12px, sticky left column `z-[20]`. Body cells `px-4 py-3.5 border-b border-default group-hover:bg-gray-50`. Row action buttons appear on hover (`opacity-0 group-hover:opacity-100`) and stay visible while their menu is open. Pagination at 7 rows in the Templates list. Card lists (templates) use the same card pattern per row.

### 5.9 Tabs

`SharedAlignedTabs` for page tabs (Email, History). `UTabs variant="link"` for the notifications popover.

### 5.10 Empty, loading, error states

| State | Pattern |
|---|---|
| Empty | `flex flex-col items-center text-center gap-2 py-16 text-muted`, `size-6` lucide icon, title `text-sm font-medium text-default`, one-line hint, a real next action only when it applies. Never assume retrieval is the only ticket type. |
| Loading | `SharedSkeleton` blocks with shimmer (reduced motion removes the shimmer) |
| Not found | plain state with a way back |
| Error | `app/error.vue` with Try again and Back |
| No results | "No ... match" with a "Clear search and filters" action |

### 5.11 Toasts

By color: success 18, warning 15, error 4, info 2, neutral 2. Success for completed actions, warning for blocked actions (always with a reason), error for failures, info for simulation notices. Title plus a short description, matching lucide icon. No dashes in copy.

## 6. Layout and shell

| Item | Value |
|---|---|
| Top navbar | `h-16`, `px-4`, `border-b border-default bg-white`, sticky `top-0 z-20` |
| Sidebar | 240px wide, `border-r`, `h-screen sticky top-0`, hidden below `lg` |
| Rows in sidebar and toolbars | fixed 32px height |
| Page header | `sticky top-16 z-10 bg-white px-6 pt-4 pb-3 border-b border-default` (back button, `text-lg` title, optional description at `pl-[34px]`) |
| Page content | `px-6 py-6`, page background `bg-gray-50`, `min-h-screen` |
| Back button | ghost neutral `sm` `square` arrow-left with a tooltip "Back to X", left of the title |
| Breadcrumb | Home > section > current page, every crumb but the last links back |
| Sticky behavior | Page headers are sticky from `lg` up only. Below that only the 64px navbar sticks. |

Z-index scale in use: `z-10` page header, `z-20` navbar and sticky table column, `z-[100]` toasts, overlays from Nuxt UI. Do not introduce new values.

Breakpoints: only `sm` (phone to tablet gutter and stacking) and `lg` (rails, sticky headers, side-by-side panes) are used. Design phone first: no horizontal page scroll at 375px, stage progress becomes a segmented bar with a "Stage N of 6" popover, headers stack with actions below.

## 7. Icons and imagery

| Size | Class | Use |
|---|---|---|
| 14px | `size-3.5` (43) | Inline with 12px text, small buttons |
| 16px | `size-4` (76) | Default, buttons, menu items, selection cards |
| 20px | `size-5` (22) | Header and modal title icons |
| 24px | `size-6` | Empty states |
| 32px | `size-8` | Avatars, notification circles |

Icons carry `aria-hidden="true"` when decorative. The color follows the text unless it signals state.

## 8. Motion and behavior

### 8.1 Animations in `main.css`

| Name | Duration and easing | Use |
|---|---|---|
| `stage-enter` | 0.22s ease-out, 4px rise and fade | Stage, tab and step content change |
| `stage-enter` on the page root | same as above | **Every route-level view** (list, detail, Move Asset): put `stage-enter` on the page's outermost element, or on the table container for a list page, so list to detail and back animate identically. Tickets, Templates, Retrieval and Assets all do this |
| `banner-enter` | 0.32s cubic-bezier(0.22,1,0.36,1) | Banner appears |
| `banner-icon-pop` | 0.42s spring, 0.08s delay | Banner icon |
| `banner-closed-enter` and icon | 0.46s and 0.5s | "Ticket closed" stamp |
| `copy-flash` | 0.2s ease-out | Copy buttons |
| `btn-ready-pulse` | 1s ring, 3 iterations | First time a primary action becomes ready after the operator has done something. Only for steps that wait for an action (a final review once every required task is done, a captured branch, a chosen outcome and template, a tracking number, evidence files, a routing choice). Steps that only ask to proceed (came back or charge, continue to the next step) never pulse. The key waits for saved tickets to load so page load itself does not spend the pulse |
| `skeleton-shimmer` | looped | Loading |
| `tok-pulse` | 0.6s | Placeholder token click |
| `notif-badge-pop` | 0.28s | Unread count change |
| `msg-banner-enter` | 0.28s | Callouts in the email body |
| `ams-page` transition | 0.22s fade and 6px drop, `out-in` | Retrieval route changes only |

Interaction transitions: `transition-colors` (54) at the Tailwind default (150ms), `transition-opacity` (16), `transition-transform duration-200` for chevrons. Menus use Nuxt UI `scale-in` 100ms.

Rules: understated (a short fade and a tiny settle, no springy over-shoot), one-shot attention cues (the ready pulse fires once per item), and **everything is disabled under `prefers-reduced-motion`**. Add a reduced-motion rule with any new animation.

### 8.2 Scroll fade

Any scrollable drawer, menu, select viewport or list gets `fade-scroll-y` (or `-x`). `plugins/fadeScroll.client.ts` toggles `.is-overflowing`, and only then is the mask applied. Size is `--fade-scroll-size: 20px`. Menus, selects, input menus and drawer bodies get it globally from `app.config.ts`.

### 8.3 Behaviors

- **Autosave**: forms autosave on a 600ms debounce with `AutosaveIndicator`. Email templates save on an explicit Edit, Save flow and record a version on save.
- **Persistence**: all created or edited data survives a refresh. Forms, email templates, tickets and checklists mirror to `localStorage` (keys prefixed `ams:`) through `defineStorageSyncPlugin`. Any new store must do the same.
- **Edit entry**: the Edit button on a template card opens the editor already in edit mode (`?mode=edit`).
- **Read-only reference**: the Placeholder Library opens outside edit mode with copy on hover and sample values, no insert.
- **Destructive actions**: always a confirm modal with the dismiss and confirm copy rule above. The Activity Log records who and what.
- **Sending**: any send to a team member is blocked with a warning toast while its email or form has unresolved placeholders (`canSendResolved()`).
- **Revisiting a completed stage**: show what happened (SentBanner, read-only recipients, previewable chips, Continue), never the original action again.
- **Steppers**: done green, current blue, future gray, except an overdue stage which is gray until reached and red when current or reached. Going back never retracts progress.
- **Search and filter**: list filters sit in one bordered card with the table. Long pickers get search (see 5.2 and 5.7).
- **Links**: only `http`, `https`, `mailto`, `tel` and relative links are allowed (`safeUrl`).
- **Copy**: no dashes in UX copy (commas and periods instead). No "HRIS" or "R24" in anything a user sees. Activity Log entries always carry a short specific detail.
- **Accessibility**: text at least 4.5:1. Icon-only buttons have an `aria-label`. Look-only-disabled controls carry `aria-disabled` and a reason. Targets at least 24px (44px for primary touch actions on phones).

## 9. Drift register (where the code disagrees, and what to use)

These are the real inconsistencies measured in the code. New work follows the **Use** column. Fixing old instances is optional and listed in order of visible impact.

| # | Drift (measured) | Use |
|---|---|---|
| 1 | Neutral gray family is mixed: `bg-gray-*` 105, `bg-slate-*` 20, `text-gray-*` 40, `text-slate-*` 18, `border-gray-*` 53 | Nuxt UI neutral is slate. Prefer semantic tokens: `bg-elevated`, `bg-muted`, `text-muted`, `text-dimmed`, `border-default`. Where a literal is needed use **slate**, except the page background which stays `bg-gray-50` (53 uses) until it moves to `bg-muted`. |
| 2 | Borders written as `border-gray-200` (26) beside `border-default` (157) | `border-default`, always |
| 3 | Error red written three ways: `text-red-600` (24), `text-red-700` (15), `text-error` (17), literal `#DC2626` (15) | `text-error` for icons and borders, `text-red-700` for text on white when AA matters, never the literal hex |
| 4 | Page gutter: `px-6` on Templates, Master Data, create; `px-4 sm:px-8` on the ticket workspace | New pages: `px-4 sm:px-6`. The ticket workspace keeps `px-4 sm:px-8` until it is aligned. |
| 5 | Page header padding: `pt-4 pb-3` (5 pages), `py-6` (Master Data hub), `pt-5 pb-5` (ticket workspace) | `pt-4 pb-3` with the back button and `text-lg` title row |
| 6 | Page title size: `text-lg` on most pages, `text-2xl` on the Master Data hub | `text-lg font-semibold text-highlighted` |
| 7 | Sub-12px text: `text-[11px]` 8, `text-[10px]` 7, `text-[9px]` 2 | `text-xs`. Only a numeric badge inside a 14 to 18px circle may go smaller. |
| 8 | Literal hex and rgb colors: 137 hex and 52 rgb() values in templates | Semantic tokens first. Literals only for print and PDF surfaces (form documents, emails), the status pills (`rgb(0,127,69)`, `rgb(137,75,0)`), and the placeholder highlight. |
| 9 | Inline `style="...px"` 47 times | Tailwind classes. Keep inline px only for fixed 32px rows, the 240px sidebar and dynamic values. |
| 10 | Button size mixed inside one toolbar (`xs` 135, `sm` 118, `md` 43) | One size per row: header `md`, toolbar `sm`, dense row and drawer chrome `xs` |
| 11 | Spacing outside the scale: `py-3.5`, `py-2.5`, `gap-2.5`, `gap-[10px]`, `mb-1.5`/`mb-2` mixed | Stay on 4, 6, 8, 12, 16, 24 (`gap-1`, `1.5`, `2`, `3`, `4`, `6`). `py-3.5` is allowed for table cells only. |
| 12 | Radius: `rounded-sm` 11, `rounded-none` 5, `rounded-2xl` 2, `rounded-xl` 1, `rounded-[2px]` 1 | `rounded-md`, `rounded-lg`, `rounded-full` only. |
| 13 | The Required badge `bg-orange-700` departs from the 600 shade rule | Accepted exception (AA contrast). Do not copy it elsewhere. |
| 14 | `DESIGN.md` in `retrieval-ticket-module/` is stale (Public Sans, `--ui-text-dimmed` `#94a3b8`) | Ignore it. This file and `main.css` are the authority. |
| 15 | Global Nuxt UI slot overrides in `app.config.ts` (fade on select, menu, drawer) and generic keyframe names | Keep, and flag in the Dev Doc as "Known and accepted". Namespace any new global class with `ams-`. |

## 10. Checklist before reporting UI work done

1. Typography matches section 2: field labels 12px sentence case above values (section labels stay uppercase), values 14px medium, helper text below its control.
2. Spacing uses only the scale in section 3, with 24px between field groups.
3. Colors come from the tokens in section 1, status colors are the 600 shade, text on white is 4.5:1 or better.
4. Buttons follow 5.1: one primary per state, icon-only buttons have a label and a tooltip, destructive actions confirm with named buttons.
5. Every scrollable region has the fade, every long picker has search.
6. Motion uses the named animations, understated, with a reduced-motion rule.
7. New data persists across a refresh, new links go through `safeUrl`, new HTML inserted from data is escaped.
8. Phone width (375px) has no horizontal scroll, headers stack, sticky behavior is `lg` only.
9. No dashes in copy, no HRIS or R24, Inter only.
10. Typecheck is clean and the changed screens were checked in the preview.
