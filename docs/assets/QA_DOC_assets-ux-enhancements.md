# QA Doc: Assets list and asset detail UI/UX enhancements

**Audience:** QA testing the ported build. **Companion:** `DEV_DOC_assets-ux-enhancements.md` (every case names the Dev Doc section it maps to).
**Also see:** the Supplier Return and Client Pull-Out flow (Move Asset form, confirm step, exit documents) is tested from `QA_DOC_supplier-return-client-pull-out.md`.
**Build to test:** the ported application.

**How to test fast.** The dark strip at the top (State, Viewing as, Scenario, and on an asset: Custody history, Warranty, Transit, plus Reset sample data) switches every state without setup. It is **verification scaffolding, not a feature**: confirm it is **absent** from the production build.

## Test first: Known Traps
1. Scroll the list sideways all the way to the end: the Actions column must not move by even a pixel, and no cell is clipped (Serial shows in full).
2. Switch tabs on an asset detail page several times: no content may flash or jump over the page.
3. The Purchase Order field and the Warranty card must always agree, and the Warranty Status filter must agree with the card's dates.
4. Pick values in one filter, then look at the counts of the other options: they must change with the other filters, never with their own.
5. Asset Name is disabled until an Asset Type is picked, and it only lists that type's names.
6. Custody "Used age" is days / 30 rounded down per row, and the total is the sum of the rows (a unit used 1 mo and 4 mo shows 5 mo).
7. Reset sample data must bring back every unit as it was, including the units from the database.
8. Only an office location is a link. A team member's address, a supplier and a client are plain text.

## Out of Scope (do not log as bugs)
Backend and permissions; the Supplier Return and Client Pull-Out flow itself; the asset model, location, owner and purchase order pages (links show a note); Add Asset, Find by QR, Add historical movement, Delete asset, photo upload; a camera QR scanner and a real QR code; the Tech Pack Currency filter and the Legacy status group; server side metric counts; the simulator strip (must not ship); per category colours in the Activity feed; status group pills by lane; ellipsis in table cells.

**Prototype only (log in the ported build, not in the prototype):** Find by QR, CSV and Add Asset do nothing; the "Historical" badge never shows; comments and legacy tags are lost on reload; comment files cannot be reopened after a reload. The Dev Doc's "Code inconsistencies to know about" lists them with the intended fix.

---

## Test cases

### A. List header, metric cards and table (→ Dev Doc: 2. List header and metric cards, 3. List table)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| A1 | Open Assets | Title "40 assets tracked", a line saying where the units are, six one line metric cards, one white card, 17 columns plus checkbox | A column from the live list is missing, or a column is clipped |
| A2 | Read the line under the title | "8 with team members, 30 at GoTeam locations, 2 at a supplier or client." (zero parts left out) | The line repeats the status counts |
| A3 | Hover each metric card | A tooltip says what it counts; Returned or pulled out gives the Supplier Return and Client Pull-Out split | No tooltip |
| A4 | Click "In use", then click it again | Only In Use units show and the Status chip reads "In Use"; the card shows the primary ring; the second click clears it | Other units remain, or the ring stays |
| A5 | Click "Warranty ending in 90 days" | The three demo units show; the chip reads "Warranty Status: Expiring in 30 Days, Expiring in 60 Days, Expiring in 90 Days" | The count is 0 |
| A6 | Click "Total assets" | Nothing changes (display only) | A filter is applied |
| A7 | Scroll the table to the far right and left | Tag and Serial frozen left, Actions frozen right, no gap at the top right corner, Actions never moves | Frozen column moves, overlaps, or a corner gap shows |
| A8 | Look at long serials, names and addresses | Full text in every cell, no ellipsis | A cell is cut |
| A9 | Tick two rows, Export selected | "2 selected", a CSV downloads with those rows, toast appears; a serial starting with `=` is written as `'=...` | Wrong rows, no file, or a live formula |
| A10 | Tick a row, then filter so it is off the list | "N selected" drops the hidden row; Export has only visible rows | Hidden rows exported |
| A11 | Check empty values (Checked out to on a stock unit, cost on a BYOD) | Muted minus, announced "None" to a screen reader | A typed dash, or a blank cell |
| A12 | Click a tag; click a model; click a PO | Tag opens the detail page; model and PO show an "existing view" toast; none underline | Underline, no pointer cursor |
| A13 | Look at Location for an In Use unit, a stock unit and a unit at a supplier | In Use: home address, plain text. Stock unit: office name, a blue link. Supplier: plain text | A team member's address or a supplier is a link |
| A14 | State = Loading; Scenario = Empty list | Skeleton rows in the same 18 cells; then "No assets yet", title and cards read 0 | Layout jumps, or the title still says 40 |
| A15 | Viewing as Read only | In Actions the Move icon is replaced by the muted minus on every row | Read only user can move, or the cell is blank |
| A16 | Look at the Tag, Serial and Model cells | Tag: blue medium link to the detail page; Serial: muted plain text; Model: blue link that toasts "asset model detail page" | Serial is a link, Tag is not blue |
| A17 | Look at the Name and Type cells on a laptop, a monitor, a desktop and another name | Laptop, monitor and desktop each have their own icon, any other name a tag icon; Type "Computer Equipment" has an icon, other types text only | Same icon for all names |
| A18 | Look at the Status cell, then open a unit with a sub-status (a Client Pull-Out) | Solid status badge with a lighter date half reading like `2026, Oct 23`; no sub-status in the table; Supplier Return is teal, Client Pull-Out pink | Sub-status in the table, a date format like `10/23/2026` |
| A19 | Look at the Tech Pack cell for a Rental, a Purchase and a BYOD unit | Rental blue with a repeat icon, Purchase orange with a check icon, BYOD teal with a laptop and no tier; others add a tier badge (Standard, High, Ultra) | BYOD with a tier |
| A20 | Look at Ownership and Movement Status | "GoTeam-Owned" or "Client-Owned"; Checked In has a blue log-in icon, Checked Out a purple log-out icon | Both icons the same colour |
| A21 | Look at "Checked in by / Checked out to" and "Checked out to (Client)" | The first has a tinted round avatar and name (muted minus if none); the second shows a square avatar and the client only for a Checked Out unit with a client | Client shown for a Checked In unit |
| A22 | Look at Owner and Supplier | Owner always has a square initials avatar and name; Supplier has the same or the muted minus | Owner blank |
| A23 | Look at Acquisition Cost on a priced unit and a BYOD | Right aligned `PHP 1,234.00` (currency, thousands separator, two decimals); a BYOD with cost 0 shows the muted minus | A bare number, or "0.00" |
| A24 | Click the truck icon in Actions; hover it | Opens `/move-asset/{tag}/move`; tooltip "Move asset"; screen reader label "Move {tag}" | No tooltip, wrong link |
| A25 | Hover a row; scroll sideways | The whole row tints, frozen cells included; the Serial column has a right border; the checkbox column stays frozen | A frozen cell does not tint |
| A26 | Type a model name, then a serial fragment, then a custodian, in capitals | Model text finds nothing; serial and custodian find their units whatever the case; the list returns to page 1 | The search matches the model or the location |
| A27 | Open the page size select | 10, 15, 25 (default 10); the footer reads "Show 10 assets per page · 1-10 of 40"; hidden while Loading and on an empty list | Other sizes, a pager on an empty list |
| A28 | Tick the header checkbox, change page, tick a row | Header ticks the current page only; "N selected" keeps counting across pages with "Export selected" and "Clear" beside it; Clear unticks all | Header ticks every page |
| A29 | Export one row, then three rows; open the CSV | File `assets.csv`; columns Tag, Serial, Model, Type, Status, Sub-status, Tech Pack, Checked out to, Owner, Location; toast "1 asset exported" then "3 assets exported" | Plural wrong, other columns |
| A30 | Click Find by QR, CSV and Add Asset | Nothing happens (no action in the prototype); they are outline, outline and primary | Treat as a bug only if the ported build lacks them |
| A31 | Set State = Not found on the list | "We couldn't load the assets", "Check your connection and try again.", a Try again button that restores the list; no pager | Blank or a pager |
| A32 | Apply a filter in Status, then click "Returned or pulled out", then "Warranty ending in 90 days" | Each card first clears Status and Warranty, then sets its own; the first shows two statuses in the chip; the card values and the title never change with filters or search | Old Status filter left behind, card values change |

### B. List filters (→ Dev Doc: 4. List filters)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| B1 | Look at the toolbar | One row: search, Status, Asset Type, Asset Name, Ownership, Warranty Status, All filters (wraps on a phone) | A tall filter panel, a labelled card |
| B2 | Open Status | Options under lane headings, every status listed (27), A to Z in a lane, a search box, a count pill on each | A status missing, no search, counts as plain text |
| B3 | Type "ret" in the Status search | Only matching statuses and their headings stay | The list does not narrow |
| B4 | Pick In Use, then open Asset Type | Three options: CE - Computer Equipment, FF - Furniture and Fixtures, OE - Office Equipment; FF and OE show 0 | Only Computer Equipment is listed |
| B5 | Asset Name before picking a type | Disabled; in the drawer the hint says "Pick an asset type first" | Enabled |
| B6 | Pick CE, open Asset Name; then unpick CE | Names of CE listed (14); a picked name is dropped when its type is unpicked | Names of other types listed, or a stale name stays |
| B7 | Open Ownership, Warranty Status | Ownership: GoTeam-Owned then Client-Owned. Warranty: Already Expired, Expiring in 30 / 60 / 90 Days | Active Warranty or No Warranty listed |
| B8 | Pick two Status values, then open Ownership | Counts show how many units match with the Status choice applied; the Status counts ignore their own choice | Every Status option reads 0 after a pick |
| B9 | Open All filters | A drawer styled like the Placeholder Library drawer: inset card, header with a close button, pinned strip "N of M assets", sections Hardware, Commercial and Lifecycle, pinned footer | A different drawer style, or a section title on the promoted filters |
| B10 | In the drawer check Brand, Tech Pack Type, Owner, Movement Type, Location Type, Checked Out To | Brand from the model's first word; Tech Pack Type BYOD, Monthly Rental, Outright Purchase; Movement Type Checked In, Checked Out; Location Type Office Location, Supplier, User Address; Checked Out To "Name — Company" | A Currency filter, extra values |
| B11 | Pick filters in the drawer, press "Show N assets" | The drawer closes; the list has N rows; the toolbar badge shows the number of filters on | The count differs from the rows |
| B12 | Look at the chips row | `Name: values` per filter, a remove button each, "Clear all"; row hidden when no filter is on | A bare value chip, or an empty row |
| B13 | Remove one chip, then Clear all | The list widens each time; Clear all also clears search | Rows stay filtered |
| B14 | Pick values with no results | "No assets match" with "Clear search and filters" | Blank table |
| B15 | Pick a status with a long set of values (several) | The chip text is cut with an ellipsis; hovering shows the full text | The chip overflows the card |
| B16 | Make the search box narrow (resize) | The placeholder shows an ellipsis; hovering shows "Search tag, serial or custodian" | Cut text with no tooltip |
| B17 | Pick a filter, go to page 2, change the filter | Back on page 1 | Empty page |
| B18 | Keyboard: Tab to a filter, Enter, arrows, Space, Esc | Opens, moves, selects, closes; visible focus ring | Mouse only |
| B19 | Open Status, Brand, Checked Out To, then the others | Only those three have a search box, with the placeholders "Search statuses", "Search brands", "Search people" | A search box on Ownership, or a different placeholder |
| B20 | Pick two Status values and one Asset Type; look at the toolbar | Status shows a pill "2", Asset Type "1"; the All filters button shows a badge "2" (filters on, not values) and turns subtle; "Clear" appears. Type only a search: "Clear" still appears, the badge and chips row do not | Badge counts values, or Clear missing for a search |
| B21 | Open All filters with two filters on | Title "All filters" and helper "Results update as you choose. Counts show how many assets each value would match."; strip "N of 40 assets" and a pill "2 applied"; each section strip shows how many filters are on in it; Clear all enabled. With nothing on, Clear all is disabled. With one match the button reads "Show 1 asset" | Plural wrong, Clear all enabled with nothing on |
| B22 | Look at a filter inside the drawer, before and after picking | 12 px label, placeholder "All {name}", one pick shows the value, several show "N selected"; the option rows show count pills; Asset Name shows the hint "Pick an asset type first" while disabled | Compact toolbar style in the drawer |
| B23 | Filter Location Type = Supplier, User Address, Office Location | Supplier gives the Supplier Return units; User Address gives units with a custodian; Office Location gives units with none; a Client Pull-Out unit appears under none of the three | A client unit under Office Location |
| B24 | Open Brand, Owner and Checked Out To | Brand: first word of each model, A to Z; Owner: the owners in the data; Checked Out To: "Name — Company" where the company is known, A to Z | Brand list empty, name without company |
| B25 | Pick a status, then filter so that status has no units | It stays in the list with a 0 pill and can be unpicked | The pick disappears silently |
| B26 | Type a search, then add a Status filter | Both apply (AND); the chips row shows Status only; Clear all removes both; with only a search and no match the empty state is "No assets match" | Search shown as a chip, or search kept after Clear all |
| B27 | Check units with warranty ending today, in 30, 31, 60, 61 and 90 days and already ended; and a BYOD | 0 to 30 days: 30 Days; 31 to 60: 60 Days; 61 to 90: 90 Days; ended: Already Expired; BYOD (no warranty) in none | A unit in two buckets, BYOD in a bucket |

### C. Asset detail (→ Dev Doc: 5. Detail header and details card, 6. Detail right rail)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| C1 | Open an asset | Sticky header (desktop), details card, rail with Current movement, QR code, Warranty | Rail cards use different font sizes |
| C2 | Click Edit details while scrolled down | Card scrolls into view under the header, blue border and ring, banner | No scroll or no highlight |
| C3 | Clear Serial; press Cmd or Ctrl+S | Error under Serial; stays in edit mode | Saves empty |
| C4 | Fix it; save with Ctrl+S | Toast, values updated, edit ends; reload keeps them | Values lost |
| C5 | Edit a BYOD unit (cost 0) and save | Saves; PO unchanged | PO cleared or cost rejected |
| C6 | In edit mode type a cost of `1e999` | Rejected with a message | Saves an infinite cost |
| C7 | In edit mode open a dropdown, press Esc | Only the dropdown closes; draft kept. Esc again cancels | Draft thrown away |
| C8 | Warranty = Needs PO; click Link PO | Edit opens, scrolls to PO, the PO field pulses; PO field says "Not linked" meanwhile | Field not highlighted |
| C9 | Look at the Warranty card | Fields in order: Asset model (chip icon, blue link), Warranty period (shield), Purchase date (calendar), Expiration date (calendar), Time remaining (hourglass and a badge) | The model sits under the period text, or an icon is missing |
| C10 | Warranty = Active, Expiring soon, Expired | Dates and the badge change colour (green, amber, red) | Same badge every time |
| C11 | Compare a database unit's Warranty card with its Warranty Status filter | The card's expiry falls in the bucket the filter puts it in | They disagree |
| C12 | Look at the Current movement card | Status icon, Date with a calendar icon, Location with its icon, person with an avatar | A value without its icon |
| C13 | Click the copy buttons (tag, serial, model) | Icon turns to a green check for 1.5 s, tooltip "Copied", no toast | Toast appears |
| C14 | QR Print and Download | Print dialog; an SVG downloads; the scan hint has an icon | Nothing happens |
| C15 | Overflow menu | Only "Delete asset" (shows a note) | Copy tag or Print QR listed |
| C16 | Open `/assets/constructor` and `/assets/__proto__` | "We couldn't find that asset" | Error page |
| C17 | Read the header of an In Use unit | Back arrow (tooltip "Back to Assets"), tag with copy button, then status badge with its date and any sub-status chip, "·", movement state, type, name, holder, each dot separated; right side Edit details, Move asset, a "More actions" menu | A missing part, dots missing |
| C18 | Viewing as Read only, open a unit and Warranty = Needs PO | No Edit details, no Move asset, no Link PO; the More actions menu and Back still show | Any editing control visible |
| C19 | Read the details card in view mode | Identity (Tag, Serial, Name, Model), Location, Ownership & finance (Owner with square avatar, "Acquisition Cost (PHP)" with the number only or the muted minus, Purchase Order or "Not linked"), Tech pack (Type badge, Currency), then Timestamps; every value has its icon | A field out of order, the cost with a prefix |
| C20 | Click Timestamps | Opens (arrow turns down), shows Created and Updated like `17 Mar 2026, 1:49 PM`; collapsed by default and again on a new page | Open by default |
| C21 | Click Edit details and read every field | Editable: Serial, Model, Location, Owner, Acquisition Cost, Purchase Order, Type, Currency (PHP or USD radio). Tag and Name stay text. Required ones have a red asterisk. Helper texts: "Manufacturer's serial number", "Pick the exact model this unit is", "Where this asset currently lives", "Legal owner entity of this asset", "Enter 0 if there was no cost", "Currency the acquisition cost is in" | Tag editable, helper missing |
| C22 | Blank each required field and save | Messages: "Enter the serial number", "Pick the model", "Pick where the asset lives", "Pick the owner", "Enter the cost, 0 if there is none" (also for a negative number); they appear only after the first save attempt; the page scrolls the first error to the centre | Messages before any attempt, no scroll |
| C23 | Edit then press Cancel; edit then Save changes | Banner reads "Editing asset details. Press Esc to cancel, Cmd+S or Ctrl+S to save."; Cancel toasts "Changes discarded"; Save toasts "Asset details saved" | Wrong text, no toast |
| C24 | In edit mode press "Use GoTeam (default)"; pick a PO, then its X; switch Currency to USD | Owner becomes GoTeam; the PO returns to "Not linked" and X is disabled again; the cost label reads "Acquisition Cost (USD)" | X enabled with no PO, label stays PHP |
| C25 | Start editing, then move to another asset (list, then another tag) | The other asset opens in view mode, no draft carried over; for an exited unit "Move asset" is not offered | Edit mode or the old draft remains |
| C26 | Click Model, Location (office unit), Owner, Purchase Order | Each shows a toast naming the page (model detail, location, client, purchase order) and that it is an existing view; a team member address, supplier and client are not clickable | A link that opens nothing, a plain address as link |
| C27 | QR card: open two units, Print, Download | The pattern differs per tag and is the same on return; Download gives `{tag}-qr.svg` and a toast "QR code downloaded"; Print opens the print dialog with the tag below the code | Same pattern for every tag, no toast |
| C28 | Warranty = Active, Expiring soon, Expired; read the Time remaining | Active "N mo remaining" (green); Expiring soon "12 days remaining" (amber, 30 days or fewer); Expired "Expired N mo ago" (red, at least 1); dates like "March 05, 2027" | Wrong tone, date format |
| C29 | Warranty = Needs PO; open a BYOD unit | Needs PO: "Coverage can't be calculated yet. It needs a linked purchase order and the asset model's warranty period." with a blue "Link PO" link. BYOD: "No manufacturer warranty. This unit is covered by its owner, not by GoTeam." with no Link PO | Link PO on a BYOD |
| C30 | Transit = In transit, then In use receipt confirmed; open a unit with no movement | Current movement shows an amber "Receipt open" chip, then a green "Receipt confirmed" chip; label "Checked out to" with a member, otherwise "Checked in by"; none: "No movement recorded yet." | Chip missing |
| C31 | Set State = Not found on any asset | "We couldn't find that asset", "The tag may be wrong or the unit may have been removed.", "Back to Assets" | Page renders the asset |
| C32 | Open `/assets/{tag}`; narrow the window until the tabs overflow | It redirects to Activity feed; the active tab is blue text with a ring; left and right arrow buttons and fades appear only on the side with hidden tabs and scroll by about 160 px | Arrows when nothing overflows, no redirect |
| C33 | On a unit whose model warranty is not 12 months (for example GT-CE-LTP-1226-0021, 24 months), read "Warranty period" and the dates | The period says the model's months ("24 months from the purchase date") and the expiration date is that many months after the purchase date | Period line disagrees with the expiry date |

### D. Detail tabs (→ Dev Doc: 7. Detail tabs)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| D1 | Activity feed on an asset with a move | Day pill centred on a grey line, white event cards with the actor's avatar on a grey rail | Pill line off centre, icons instead of avatars |
| D2 | Click the chevron on an event | Field by field detail opens and closes | Stays closed |
| D3 | Activity feed and Movements, look at the filter chips | The same chip as the ticket tracker table (small outline pill, solid primary when active) with a count pill, directly under the header on both tabs | Chips on the right on one tab and below on the other, or a larger chip |
| D4 | Filters All, Status changes, Movements | List narrows; "Nothing matches" has a way out | No counts |
| D5 | Event with no note or document | Note box says "No note recorded", document line "No document attached" | The parts disappear |
| D6 | Movements tab | Two summary cards like Custody history; day pills; one card per movement; grey connecting line visible | Line invisible (white) |
| D7 | Compare the Movements summary cards with the Custody cards | Same card, strip, label, value and supporting line sizes; person rows have a 24px neutral avatar and a muted suffix; both cards the same height; no empty band under the contents; 24px between stacked sections | Any size, padding or avatar difference |
| D8 | Add a comment (text, a file, an emoji) | Appears in the card; "View all" opens the drawer; delete works on your own | Comment lost |
| D9 | Attach an `.html` or `.svg` file to a comment | Rejected with a message | Accepted |
| D10 | Custody history of an In Use unit | Age summary card with a title strip and an untitled card (Currently with, First deployed to), neutral avatars, `# empNo`, 9 columns plus checkbox, Current or Maiden badge | A title on the second card, tinted avatars, a missing column |
| D11 | Custody history of a unit that was never Available | "—", `No "Available" record yet`, "Across 0 custodians", "No usage yet", "Not currently deployed", "No deployments yet"; the table says "No custodians recorded yet..." | Different wording |
| D12 | Compare a unit used for about 1 and 4 months | Used age shows "1 mo" and "4 mo"; Total used age is 5 mo | Total is 4 mo |
| D13 | Custody history with each Custody simulator state | Matches the live page; Open in Received Date when Transit is on | A live column missing |
| D14 | Select two rows, press Copy 2 Selected | Toast says copied; clipboard holds `empNo_name_MM-dd-yyyy; ...` oldest first | Wrong format |
| D15 | Tick two custody rows, then type a search that matches neither | Footer reads "0 of 0 row(s) selected."; Copy has nothing hidden | Hidden rows still counted or copied |
| D16 | Look at the custody note | A neutral subtle alert with an info icon, 12 px text, the link in blue | Plain grey paragraph |
| D17 | Legacy tags: add, rename, duplicate, remove | Duplicate rejected with a message; remove asks to confirm | Duplicates allowed |
| D18 | Photos | "No photos uploaded yet." empty state | Missing |
| D19 | Switch between all five tabs quickly | No flash or jump | Content flickers over the page |
| D20 | Read an Activity feed with a creation, a status change, a replacement link and a move | "{actor} added this asset as [badge]"; "changed the status from [badge] to [badge]"; "linked this unit as the replacement for {tag}"; "checked this asset out to {member}" or "checked this asset in at {location}" with a `#NNNN` number | Sentence reads differently, no badges |
| D21 | Under each event read the meta line; open the chevron | Icon, time, "·", kind (Added, Status change, Movement, Replacement); details are field pairs (Asset Status "A → B", Status Date, Reason or Note, Document, Movement Type, Movement Number, Location, Checked Out To, Resulting Status, Replaces, Linked on, Tag, Serial, Model) | A kind missing its detail rows |
| D22 | Look at day pills for events today, yesterday and older; two events on one day | "Today", "Yesterday", then the date like `2026, Oct 23`; same day events share one pill and are joined by a thin rail | Raw ISO date |
| D23 | Use an asset with more than 10 events; switch filter on page 2 | Pager appears only above 10 events; a filter change returns to page 1; counts are right ("Status changes" includes added and replacement events) | Pager on 10 or fewer |
| D24 | Click a document chip in the Activity feed and in a movement card | Opens in a new tab; the chip has a paperclip and an arrow-up-right icon | Opens in the same tab |
| D25 | Read a movement card | Header: Checked out or Checked in, status chip in the status colour, `#NNNN`, time on the right. Facts: Location with icon, Checked out to or Checked in by with an avatar, Recorded by (only for a check out to a member recorded by someone else), Note, Supporting document | Recorded by on a check in |
| D26 | Transit = In transit; open Movements with the filter on All, then on Check ins | The newest card shows "Waiting for the custodian to confirm receipt." only on All | Note on other cards or filters |
| D27 | Read the Movements summary cards | Movement summary: Total movements N with "X checked out" over "Y checked in", Last moved with date, time and ago; the untitled card: Currently (avatar, who or where, "Checked out"/"Checked in") over First recorded (date, "by {name}"); hidden while Loading or with no movements | Counts wrong |
| D28 | Click Add historical movement; as Read only too | A toast says it is an existing action; the button shows for the read only role as well; no "Historical" badge appears anywhere in the prototype | Opens a form |
| D29 | Filter an unrelated chip on each tab; open a unit with no movements | Activity "Nothing matches this filter" + "Show all activity"; Movements "No movements match this filter" + "Show all movements"; none: "No movements recorded yet" with "Move this asset" for an officer (not for an exited unit or Read only) | No way out |
| D30 | Open a movement with no comments, then add one, then add three more | "No comments yet." and an "Add comment" button that opens the composer; after the first comment, "Add comment" opens the drawer; two comments show inline (two lines each, "You ·" on yours), more adds "View all N comments"; the count badge is right | Composer opens when comments exist |
| D31 | In the composer: send empty, type text, attach a PDF, a 12 MB file, an `.exe`, an emoji; press Ctrl+Enter | Send is disabled when empty; a file over 10 MB gives "X is over 10 MB."; an unsupported type gives "X is not a supported file type. Attach an image, PDF, Office file, text or zip."; the emoji is appended; a pending file shows a chip with remove; Ctrl or Cmd+Enter sends and the composer closes | Empty comment sent, wrong text |
| D32 | Open "View all", delete your own comment, hover another | Title "{Checked out/in} #NNNN · Comments", description the location; a trash button appears on hover or keyboard focus only on your own comments and deletes at once; the composer is pinned in the footer | Delete on others' comments |
| D33 | Read the Custody table row by row | Seq is a round badge (blue for the current row); Custodian has an avatar and "Current" or "Maiden" badge; Condition "Brand New" or "Refurbished"; Deploy Date and Received Date like `14 Oct 2026`; "Open" badge when receipt is open; Location is an address; Used Age like "4 mo" or "< 1 mo" | Wrong badge, other date format |
| D34 | Custody: tick the header box with a search active, change the search, press Copy with nothing ticked | The header box ticks every matching row on all pages; typing in the search clears the ticks; Copy with none ticked shows the warning "Select at least one row to copy."; with rows ticked "Copied N row(s). Paste into a single cell."; the button reads "Copy N Selected" | Ticks survive a new search |
| D35 | Read the custody summary subtitles | Actual age "Available since 14 Oct 2026 1:34 PM"; Total used age "Across N custodian(s)" over "First used ..."; with none "—", "Across 0 custodians" and "No usage yet" | Plural wrong |
| D36 | Legacy tags: add, rename, duplicate in another case, empty save, Enter key, remove and keep, remove and confirm, search, page through 11 tags | Modal "Add legacy tag" or "Edit legacy tag" with the placeholder "e.g. HP-LTP-0098"; Enter saves; errors "Enter the legacy tag." and "This asset already has that legacy tag."; toasts "Legacy tag added", "Legacy tag updated", "Legacy tag removed"; new tags appear first with "Added on {date}"; footer "N tag(s)" and "Page X of Y" with four buttons; empty states "No legacy tags yet. This asset has kept its original tag." and "No legacy tags match your search." | Duplicate in another case allowed |
| D37 | Open Photos | Heading "Photos", line "Photos taken of this asset.", dashed card with a camera icon and "No photos uploaded yet."; no upload control | An upload control |
| D38 | State = Loading on the list and each tab | List: 6 skeleton rows; Activity feed: 3 skeletons (its chip row stays); Movements: 3 skeletons, no chips or summary cards; Custody history: one "Loading custody history..." row and no summary cards; Photos and Legacy tags ignore Loading | A tab that jumps when data arrives |

### E. Data and shell (→ Dev Doc: 1. Data and seed, 8. Shell and simulator)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| E1 | Edit a unit, reload | The edit is still there | Resets |
| E2 | Change a unit that came from the database, then Reset sample data | It returns to its starting state; comments and legacy tags reset too | The change stays |
| E3 | Breadcrumbs on list and detail | List: Home > Assets. Detail (any tab): Home > Assets > {TAG}; the Assets crumb links back; the tab name is not added | Wrong trail |
| E4 | Navigate list to detail and back | Same short entrance each way | Different animation |
| E5 | Open the same tag in two tabs, edit in one | The other shows the change after reload | Data lost |
| E6 | Tamper `ams:assets:v4` in storage (a bad status, a `__proto__` id) | Bad entries ignored, no error | A crash |
| E7 | Add a comment and a legacy tag, then reload | In the prototype both are gone after a reload (memory only); the edited unit data stays. In the ported build they must persist | Treat as a bug only in the ported build |
| E8 | Go through every simulator option: State (Populated, Loading, Not found), Viewing as (Asset officer, Read only), Scenario (Standard data, Empty list), and on a detail page Custody history (From the data, No custody history, Single checked out, Single returned, Long history), Warranty (From the data, Needs PO, Active, Expiring soon, Expired), Transit (From the data, In transit receipt open, In use receipt confirmed) | Each option changes the screen as in the Dev Doc's simulator table; the Custody option also changes the header holder text ("Currently with {name}", "Last held by {name}", "No custodian"); Empty list makes the title read "0 assets tracked" and the line "Assets you add will show here." | An option with no effect |
| E9 | Click Hide on the strip; open a list page after a reload | The strip disappears until reload; Custody, Warranty and Transit appear only on a detail page; the strip is a row above the app (it pushes the page down) | The strip overlaps the page |
| E10 | Look at the sidebar on `/assets`, a detail page and `/move-asset` | Assets is active on the list and the detail; Move Asset is its own item, active on `/move-asset/**` and not Assets | Both active |
| E11 | Read the browser tab title | List "Assets - GoTeam Assets"; detail "{TAG} - GoTeam Assets" | Generic title |
| E12 | Change Custody, Warranty and Transit, then press Reset sample data | The three selects return to "From the data"; units, comments and legacy tags reset; toast "Sample data reset" | A select keeps its value |
| E13 | Hover links and buttons; press Tab from the top of a page | Pointer cursor on every clickable element, no underline on links even on hover; the first Tab stop is the skip link, and it moves focus to the main content | Underlined link, default arrow cursor |

---

## Responsive & Touch (→ Dev Doc: Responsive Spec)
Run on the built app at 390, 360, 768, 1920 and 320 px, and drag 320 to 1920.
- **No horizontal page scroll.** The table scrolls sideways inside its card only. → Responsive Spec: List table.
- **Toolbar** wraps onto rows; the All filters drawer fits the screen (full width minus 24 px on a phone). → Toolbar, All filters drawer.
- **Detail header** stacks on a phone, is not sticky below 640 px, and actions wrap. → Detail header.
- **Detail grid** is one column below 1280 px with the rail under the content. → Detail grid.
- **Summary cards** stack on a phone and sit side by side, equal height, above that. → Summary cards.
- **Touch targets** at least 44 by 44 px on mobile, 8 px apart (copy buttons and chevrons have an extended hit area; verify each).
- **Forms** (edit details) are one column on a phone. **Text** at least 12 px; addresses and tags wrap rather than overflow.
- **200% zoom** reflows; **on-screen keyboard** open does not hide the confirm buttons; **landscape phone** works.
- **Keyboard:** Tab reaches every control in a logical order with a visible 2 px focus ring; Esc closes menus, the drawer and the edit mode; Cmd or Ctrl+S saves the edit; the metric cards and chips toggle with Space or Enter.
- **Dark mode:** every screen readable, badges, chips and pills keep contrast.

## Smoke flows (already automated in Playwright)
The prototype ships `tests/e2e/assets-smoke.spec.ts` (10 tests, passing). Port or extend it against the real app. The flows that belong to the list and detail redesign:
1. The list shows 17 columns and keeps Actions on one pixel; no cell is clipped.
2. Filters narrow the list, show a named chip, share state with the drawer, and clear.
3. Edit details with Ctrl+S, Esc, then reload.
4. The five tabs switch without two pages on screen; removing a legacy tag asks to confirm.
5. Tampered saved data is ignored.

## Sign-off checklist
- [ ] A1 to A32 · [ ] B1 to B27 · [ ] C1 to C33 · [ ] D1 to D38 · [ ] E1 to E13
- [ ] Every row of the Dev Doc's Feature coverage matrix points to a case above that passed
- [ ] Responsive and touch block · [ ] Keyboard and dark mode · [ ] Simulator strip absent in production

## Quick regression pass (after a fix)
List sideways scroll · a filter, its chip and Clear all · the All filters drawer · edit and save · tab switch · custody empty and populated · Reset sample data.
