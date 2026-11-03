# QA Doc: Supplier Return and Client Pull-Out

**Audience:** QA testing the ported build. **Companion:** `DEV_DOC_supplier-return-client-pull-out.md` (every case below names the Dev Doc section it maps to; the Feature coverage matrix at the end of the Dev Doc lists every feature against its case). The cases for the Assets list and asset detail UI/UX work are in `QA_DOC_assets-ux-enhancements.md`.
**Build to test:** the ported application.

**How to test fast.** The dark strip at the top (State, Viewing as, Scenario, plus Reset sample data) switches every state without setup. It is **verification scaffolding, not a feature**: confirm it is **absent** from the production build.

**Sample units in the prototype** (use your own equivalents in the ported build)

| Tag | What it is | Use it for |
|---|---|---|
| `GT-CE-LTP-1233-0926-0013` | Monthly Rental, In Use by Mara Lim, supplier Northline IT Supply | Supplier Return; Client Pull-Out blocked |
| `GT-CE-LTP-1180-0326-0042` | Outright Purchase, In Use by Bea Ramos, client Contoso Realty | Client Pull-Out |
| `GT-CE-MNT-1151-0426-0037` | BYOD, In Use by Carlo Diaz, client Contoso Realty, supplier Metro Peripherals | Client Pull-Out |
| `GT-CE-LTP-1240-1026-0003`, `-0004` | Outright Purchase, Available, no client | Replacement units; "any status may start an exit" |
| `GT-CE-LTP-1240-1026-0001` | Outright Purchase, For IT Configuration, no client | Start from a non-In Use status |
| `GT-CE-LTP-0826-0005` | Already Supplier Return (movement "Checked Out", at the supplier) | Exited guard, Move details drawer |
| `GT-CE-LTP-0726-0002` | Already Client Pull-Out (Direct Hire), custodian Ines Valdez | Custody and Movements for a pull-out |
| `GT-CE-LTP-1180-0326-0043` | Available, same purchase order PO-6895557 and supplier Northline IT Supply as `-0042` | Replacement picker, section "Same supplier" |
| `GT-CE-LTP-1180-0526-0017` | Available, supplier Orbit Supply Co, same model and tech pack as `-0042` | Replacement picker, section "Other suggestions" |
| `GT-CE-LTP-1233-0526-0018` | Available, supplier Orbit Supply Co, Monthly Rental, client Northwind Health | Replacement picker, "Other suggestions" (same client and tech pack as `-0013`) |

The prototype now has 43 sample units (it had 40) and the storage key is `ams:assets:v5`.

## Test first: Known Traps
1. Supplier Return on an In Use unit: its earlier check out to the team member must still be in Movements and Custody History. A Supplier Return is itself a Check Out (to the supplier address). → Dev Doc: Known Traps 1
2. A Client Pull-Out must not add a second, still counting "Current" row to Custody History. Custody ends at a Supplier Return, a Client Pull-Out or a check in. → Known Traps 2
3. Double click Confirm on an exit: one history entry, one movement, one toast. → Known Traps 3
4. The status badge date half is a light tint of the status colour. The status fill colours must equal the live app's; only Supplier Return (teal) and Client Pull-Out (pink) are new. → Known Traps 4
5. Links are blue, never underlined, and show a pointer cursor. On Move Asset only an office location is a link. → Known Traps 5
6. `/assets/constructor` and `/assets/__proto__` must show "not found", not an error. → Known Traps 6
7. A unit that has already left (Supplier Return or Client Pull-Out) must not be movable again, even from a direct URL. → Known Traps 7
8. Reset sample data must bring back every unit, including one you exited. → Known Traps 8
9. The kind of move is chosen before the form opens, so the form never changes shape: choosing a status or a movement type must not add or remove a block (Charged Deduction documents are always on screen, only switched on).
10. A scroll fade must show only on an edge that still has content past it: none at the very top or bottom, none on a list that fits.

## Out of Scope (do not log as bugs)
Backend and permissions; reversing an exit; the camera QR scanner; the asset model and location pages (links show a note); the simulator strip (must not ship); a new lane for the exits; sub-status as its own colour; a bottom action bar on Move Asset. Anything about the Assets list filters, metric cards or the asset detail layout belongs to the UI/UX enhancements QA Doc.
Also not bugs in the prototype (they are decisions listed in Dev Doc section 10): the optional Note not showing next to a reason; an empty location when a Client Pull-Out unit has no client; the made up time of day and movement numbers; the Done page showing success for any known tag. Log them only if the ported build's product owner has decided otherwise.

---

## Test cases

### A. The two new statuses (→ Dev Doc: 1. Foundations, 5. How an exit shows elsewhere, 6. Location display rule)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| A1 | Look at the two new statuses in the Assets list | Supplier Return teal, Client Pull-Out pink, with the grey sub-status chip **not shown** in the table; date half is a lighter tint of each status colour; date reads like "2026, Oct 20" | Date half is dark grey, or sub-status appears in the table |
| A2 | Open the status filter and pick Supplier Return, then Client Pull-Out | Both are listed under Terminal; only units on the picked status show. The filter has a Legacy group after the lanes (see M) | A status is missing or the rows do not narrow |
| A3 | Viewing as Read only | Move icon hidden in Actions; "Move asset" hidden on the asset page (an exited unit shows "Move details" instead) | Read only user can move |
| A4 | Open `/assets/constructor` | "We couldn't find that asset" | Error page |
| A5 | Look at the Location of one In Use unit, one unit at an office, the Supplier Return unit and the Client Pull-Out unit (Assets list Location column or the asset page; the Move form shows only the In Use and office units, because exited units cannot be opened there; hover each) | In Use: the team member's address with a house icon, tooltip "Asset is based on the team member's current address", plain text. Office: building icon, tooltip "Asset is based on the asset location", blue link. Supplier Return: the supplier's name, truck icon, tooltip "Asset is located at the supplier facility", plain text. Client Pull-Out: the client's name, building icon, tooltip "Asset was pulled out by the client", plain text | A home address, supplier or client is a link; wrong icon or tooltip |
| A6 | Open the asset page of the Supplier Return unit and of the Client Pull-Out unit | Header holder text "At the supplier" and "Pulled out by Fabrikam Logistics" | Shows a team member or "In stock" |
| A7 | Open the asset page of the Client Pull-Out unit and hover the grey chip beside the status badge in the header | Tooltip "Sub-status: Direct Hire" | Chip missing or has no tooltip |

### B. Move Asset (→ Dev Doc: 3. Move Asset flow, 7. Move Asset screens)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| B1 | Sidebar > Move Asset; enter an unknown tag, press Enter or open the Move Asset menu and pick any kind | Inline error and toast, field marked | No error |
| B2 | Enter a valid In Use tag and pick a kind from the Move Asset menu | Opens the move form (`/move-asset/{tag}/move`, with `?kind=supplier` or `?kind=client` for the two exits, no kind for Check In or Check Out); sidebar highlights Move Asset | Assets stays highlighted, wrong kind opens |
| B3 | Enter a Supplier Return tag, or open `/move-asset/GT-CE-LTP-0826-0005/move` directly | "can't be moved again" with the buttons "View move details" (opens the drawer) and "View asset" | A working form appears |
| B4 | Open the Move asset menu on a Monthly Rental unit (see N) | "Client pull-out" is shown off with a reason tooltip; clicking it raises a toast; the other two kinds open | Option opens the form |
| B5 | Open Client pull-out on a BYOD unit; click Move Asset with nothing filled | Banner lists what is needed, page scrolls to it, banner pulses, each missing field red with a line | Nothing visible happens |
| B6 | Attach a PDF over 10 MB, then a `.docx` | Inline error each time; nothing stored | File accepted |
| B7 | Fill all fields; click Move Asset | Confirm modal with the action named ("Confirm pull-out") | Saves without confirming |
| B8 | Confirm | Done page, 5 second countdown, then the asset's Movements tab | Wrong destination |
| B9 | Supplier Return with a replacement unit | The replacement's feed shows "linked this unit as the replacement for ..." | Shows a status change |
| B10 | Cancel and Move Asset buttons | At the end of the Movement card, not a bar | Floating bar |
| B11 | Look at the Note field | Optional badge, placeholder "Add context for this move, such as a ticket number or the reason" | Empty field with no hint |
| B12 | On the move form of an In Use unit and of a unit at an office, click the model, the location and the copy buttons (tag in the title, model, serial) | Model: blue link, "existing view" toast. Copy buttons: green check for 1.5 s, "Copied" tooltip, no toast. Location: a blue link only for the office unit; the In Use unit's home address is plain text. A supplier or client location is plain text | A team member's address is a link, or a copy button shows a toast |
| B13 | Double click Confirm on an exit | One history entry, one movement, one toast | Duplicates |
| B14 | Open a move form and read the Asset card | Fields Model, Serial, Type, Tech Pack, Current status (badge with date), Location. Tech Pack has its own icon (repeat, badge-check, laptop) and is plain text. Type has an icon for Computer Equipment. Two columns on a phone, four from 768 px; Current status and Location are wide | A field missing, or Tech Pack is a badge |

### C. How an exit shows in Movements and Custody (→ Dev Doc: 5. How an exit shows elsewhere)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| C1 | After a Supplier Return, open the Movements tab | A Check Out to the supplier address (location type Supplier) with the reason; the earlier check out to the team member is still there | Earlier check out missing, or the movement is a Check In |
| C2 | After a Client Pull-Out, open the Movements tab | A Check Out to the client address with the reason; the card header has the pink Client Pull-Out badge | Wrong movement type or a label instead of an address |
| C3 | Click the document chip (Supplier Return agreement) | Opens in a new tab | Opens in the same tab or nothing |
| C4 | Open Custody history of a Client Pull-Out unit (GT-CE-LTP-0726-0002) | One row only; no "Current" badge; Currently with says "Not currently deployed" | A second open row still counting |
| C5 | Open Custody history of a Supplier Return unit | The last custody row is closed on the return date; earlier custodians keep their rows | The row stays open |

### D. Shell and persistence (→ Dev Doc: 5. How an exit shows elsewhere, 8. Persistence)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| D1 | Save an exit, reload the page | The unit is still exited, history intact | Resets |
| D2 | Exit a unit from the database sample, then Reset sample data, then open its Move form | Starting data is back; the form opens (the unit is no longer exited) | Still "can't be moved again" |
| D3 | Breadcrumbs on Move entry, form and done | Home > Move Asset > tag > Done | Wrong trail |
| D4 | (Prototype only) In the browser console set `localStorage['ams:assets:v5']` to bad data (not JSON; a status that does not exist; a history that is not a list; an `__proto__` key), then reload | The list opens with the sample data, nothing breaks, nothing polluted (`({}).polluted` is undefined) | Error page, or bad data applied |
| D5 | Fill half of an exit form, then reload, or click Cancel, or the back arrow | Everything is gone and no warning is shown; Cancel and the back arrow land on the Assets list | A draft is kept, or a prompt appears (unless the product owner added one) |

### E. Entry page (→ Dev Doc: 7.1)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| E1 | Open `/move-asset` | Tab title "Move Asset - GoTeam Assets"; heading "Move Asset"; subtitle "Scan the asset tag or manually enter the tag."; label "Manual Asset Tag Input"; placeholder "e.g. GT-CE-LTP-1233-0926-0013"; the field has focus; one button "Move Asset" with a chevron (a menu, see N). There is no "Find Asset" button | Any wording differs, no focus, or a "Find Asset" button |
| E2 | Enter `GT-NOPE-0001`, press Enter (or pick a kind from the Move Asset menu) | Button shows loading for about a quarter second; the field turns red; text "Asset tag not found. Please check the tag and try again."; error toast with title "Error" and text "Asset not found"; no navigation | No toast, or navigation |
| E3 | Enter the Supplier Return tag, press Enter | Text "This unit has already been returned or pulled out, so it can't be moved again." with a link "View move details" (opens the drawer on the asset page); no toast; the field is not red | A toast, or the form opens |
| E4 | After an error, type one character | The message disappears | It stays |
| E5 | Look at the "Try:" chips and click one | Four tags, none exited; the click fills the field and does not submit | Exited tag listed, or it submits |
| E6 | Type a valid tag and press Enter (do not open the menu) | Loading, then the Check In or Check Out form (no `?kind`) | Enter does nothing, or opens an exit |
| E9 | Type the tag of a Monthly Rental unit, open the Move Asset menu and pick Client pull-out | Info toast "Client Pull-Out isn't available for this unit" with the reason; no navigation | The form opens |
| E7 | Viewing as Read only, open `/move-asset` | The form is replaced by a warning "You can't move assets" with "Only an asset officer can move an asset. Switch the role in the prototype controls to try this page." | Form is usable |
| E8 | Enter an empty value (or only spaces), submit; then a valid tag with spaces around it, then the same tag in lower case | Empty: the not found text, no toast, no wait. Spaces around a valid tag: works. Lower case: not found (exact, case sensitive match) | Empty submit opens something, or surrounding spaces fail |

### F. Status picker (→ Dev Doc: 7.4.1). Used by Check In or Check Out; the two exits have their status fixed by the menu
| # | Steps | Expected | Bug if |
|---|---|---|---|
| F1 | On a Check In or Check Out form click "Select status" | A popover as wide as the field; search box "Search status" has focus; groups in this order with small capital headings: Intake & Ready Pool, Active Use, Return & Triage, Review & Investigation, Decommissioning, Terminal, then Legacy | Order or names differ, search not focused |
| F2 | Type "sup", then "zzz" | "sup" lists only statuses containing "sup" (Supplier Return is not in this list); "zzz" shows "No status matches."; matching ignores case | Groups with no matches still show, or Supplier Return is listed |
| F3 | Scan the whole list, then Tab and click through it | Every status can be chosen: none is greyed or disabled. Supplier Return and Client Pull-Out are not in the list | A disabled status, or an exit status listed |
| F4 | Open the Move asset menu on the Monthly Rental unit and choose Return to supplier | Allowed; the form opens with Supplier Return fixed | Supplier Return is blocked for Monthly Rental |
| F5 | Choose a status | Popover closes, the search clears, the field shows the name; reopening shows it blue with a check | Popover stays open |
| F6 | The disabled Client pull-out on a Monthly Rental unit is covered in N (the Move asset menu). Also open `/move-asset/GT-CE-LTP-1233-0926-0013/move?kind=client` directly | A warning alert "This unit can't be pulled out by the client" with the reason; Move Asset does not save a pull-out for it | The form saves a pull-out for a Monthly Rental |
| F7 | Open the picker and press Esc | The popover closes and nothing is chosen. A search you typed is still there when you reopen it | Esc selects something |

### G. Exit details panel and validation (→ Dev Doc: 6. Fields and validation, 7.4, 7.5)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| G1 | Open Return to supplier | Amber panel "Supplier Return details" with an amber "All required" badge. Fields: Date, "Replacement unit from the supplier" (Optional badge, placeholder "Select a replacement unit"), document "Supplier return agreement" with "· PDF or image (JPG, PNG), up to 10 MB" and a button "Attach document", Reason. No "why" select. The Movement card shows (does not ask) New status Supplier Return, Movement type "Check Out", Location type "Supplier", the supplier and its address, and "Checked out by" | A field missing or extra, or the movement says Check In |
| G2 | Open Client pull-out (BYOD or Outright Purchase unit) | Panel "Client Pull-Out details". First field "Why the client pulled it out" (placeholder "Select a reason", options Competitor and Direct Hire). No replacement field. Document label "Client instruction". Movement type "Check Out", Location type "User Address", "Checked out to" the team member who has the unit, Location the client address, "Checked out by" | A field missing or extra |
| G3 | Open Check In or Check Out and read the Movement card before touching anything | Fields in the live order: Movement type (Check In / Check Out), Location type cards, the location, supplier or team member, "Checked in by" or "Checked out by" with the officer's initials, name and a "You" badge, Note, New status last (placeholder "Select status") | A field out of order, or an invented field |
| G4 | On Check In or Check Out click "Move Asset" without picking a status | Banner (alert) titled "Something is still needed" with "Can't move the asset yet. Still needed: the new status."; the picker is marked "Choose the new status."; page scrolls smoothly so the banner is centred and the banner pulses | Any text differs, no scroll or no pulse |
| G5 | Pick Client Pull-Out and click Move Asset with nothing filled | Marks and one line texts: "Choose why the client pulled it out." under the select; "Attach the client instruction." with a red Attach button; "Say why the unit is leaving." under Reason. The date is filled with today so it is not marked. For Supplier Return the file text is "Attach the supplier return agreement." | A missing field not marked, or a wrong text |
| G6 | Same click, read the banner | "Can't move the asset yet. Still needed: why the client pulled it out, the client instruction, the reason." (order: date, why, document, reason; with the date cleared it starts "the date, ..."). Supplier Return: "...the supplier return agreement, the reason." | Order or wording differs |
| G7 | After a blocked save fix the fields one by one | Each mark and its line disappear as soon as that field is valid; the banner shrinks and disappears when nothing is missing; clearing a field again marks it again at once | Marks stay, or do not come back |
| G8 | Fill every field of an exit, then use "Change move type" and pick the other exit | The page opens the other kind with an empty form: date back to today, why, replacement, file, reason and Note all cleared; no error marks | Some value carries over |
| G9 | Look at the Date field, clear it, then click Move Asset | Default is today's local date; label "Date" with a red asterisk; accessible name "Exit date". Cleared: marked, "Pick the date.", banner starts "the date". A past or a future date is accepted | Default is not today |
| G10 | Reason: type only spaces, then click Move Asset; then read the placeholder | Spaces count as empty: marked "Say why the unit is leaving." Placeholder "For example: the client moved this team member to their own payroll on 20 Oct." Saved reason is trimmed (check the confirm modal) | Spaces accepted |
| G11 | Leave the Note empty and save | Allowed; the Note has an "Optional" badge | Note is required |

### H. Documents (→ Dev Doc: 6. Document rules, 7.4.2)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| H1 | Attach a small PDF, a JPG and a PNG (one at a time) | Each is accepted; the chip shows the name and the size ("12 KB", or "1.5 MB" from 1 MB up, one decimal); PDF has a text icon, images an image icon | One type refused |
| H2 | Attach a `.docx`, a `.txt`, a `.gif` | Text "{name} can't be attached. Use a PDF or an image (JPG or PNG), for example a printed email or a photo of it." with an alert icon; no chip; the "Attach ..." line is not also shown | Accepted, or wrong text |
| H3 | Attach a PDF of 10 MB exactly, then one of 10 MB plus 1 byte | Exactly 10 MB: accepted. Plus 1 byte: "{name} is over 10 MB. Attach a smaller PDF or image." | Limit differs |
| H4 | Attach a good PDF, then use Replace and pick a `.docx` | The error shows and the good file is gone (the Attach button is back, marked if you tried to save) | The old file stays attached behind the error |
| H5 | With a chip showing, hover and click its three buttons | Eye: tooltip "Open file in a new tab", opens the file in a new tab. Replace (tooltip "Replace") opens the picker. Remove (tooltip "Remove") clears the chip and any error | A button missing or opens in the same tab |
| H6 | Remove the file, then attach the same file again | Accepted; the picker fires again | The second pick does nothing |
| H7 | Save an exit with a document, reload, open the document chip in Movements, in the Activity Feed and in the Move details drawer | The real file opens each time, before and after the reload (see R). In the ported build it opens from the stored copy | A stand-in or a broken link for a document attached in this build |

### I. Confirm, save and the done page (→ Dev Doc: 7.6, 7.8)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| I1 | Fill a valid Supplier Return (with a replacement) and click Move Asset | Modal title "Return this unit to the supplier?"; text "This is a terminal status. The unit leaves the active count, and the change is recorded in its history."; rows Asset ("{tag} · {model}"), New status "Supplier Return", Movement "Check Out · {supplier address}", Date ("2026, Oct 20" style), Document (file name), Replacement unit (tag), Reason. For Client Pull-Out: title "Confirm the client pull-out?", New status "Client Pull-Out · Competitor", Movement "Check Out · {client address}", no Replacement row | A row missing, or Note is listed |
| I2 | Click "Keep editing" | Modal closes; every field still filled; nothing saved | Data lost or saved |
| I3 | Open the modal and press Esc, or click outside | Same as "Keep editing"; focus stays inside the modal while open | Saves, or focus escapes |
| I4 | Confirm | Success toast "{tag} is now Supplier Return" (or "{tag} is now Client Pull-Out · Competitor") with "The unit is out of the active count. Its history has the change and the document." | Text differs, or two toasts |
| I5 | Watch the done page | Tab title "Asset moved - GoTeam Assets"; green check; "Asset Moved Successfully"; "{tag} has been moved. You will be redirected in 5 seconds." counting 5, 4, 3, 2, 1, then the asset's Movements tab opens | Count skips, redirect is early or late, wrong tab |
| I6 | On the done page click "Move Another Asset", then repeat and click "View Asset" | Move Another goes to `/move-asset`; View Asset goes to the Movements tab at once; neither is followed by a late redirect | A second redirect fires |
| I7 | Open `/move-asset/NOT-A-TAG/done` | After the countdown (or at once with either button) you land on `/move-asset` | Error page |

### J. Replacement unit (→ Dev Doc: 6. Replacement unit rules)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| J1 | Open Return to supplier and open the replacement list | Only units whose status is exactly Available, not the unit itself and not already another unit's replacement; two sections, a search box and an open in new tab icon per row (see Q for the picker in detail) | An In Use or other status unit listed |
| J2 | Choose one and click Move Asset (valid form) | The confirm modal has a "Replacement unit" row with that tag | Row missing |
| J3 | Confirm, open the replacement unit's Activity feed and its Move form | A separate "Replacement" event "linked this unit as the replacement for {returned tag}" dated the chosen date; its status and status date did not change; the Move form's Status history has the new top entry with the note "Linked as the replacement for {returned tag}". The returned unit's Activity feed detail has the row "Replacement Unit" | Shows a status change |
| J4 | Start another Supplier Return and open the list again | The unit linked in J3 is no longer offered | It is offered again |
| J5 | Choose a replacement, then unset it | A "Clear. Not linked yet" row appears at the top of the open list; choosing it empties the field back to the placeholder "Select a replacement unit" | A silent bad value after clearing |

### K. What a save changes (→ Dev Doc: 6. What a save writes, 7.7)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| K1 | Supplier Return on `GT-CE-LTP-1233-0926-0013` | Status Supplier Return; Movements gets a Check Out (location type Supplier) at "Northline IT Supply, 88 Ayala Avenue, Makati City 1226"; the earlier check out to Mara Lim stays; the list's custodian and client columns are empty; the unit's location is now the supplier (name) | Custodian still shown, or earlier check out lost |
| K2 | Client Pull-Out on `GT-CE-MNT-1151-0426-0037` | Status Client Pull-Out with the chosen sub-status chip; Movements gets a Check Out at "Contoso Realty, 5th Avenue corner 26th Street, Bonifacio Global City, Taguig 1634"; the card says "Checked out to Carlo Diaz" and "Recorded by Karl Bustillo"; the custodian is kept | Custodian cleared, or movement type wrong |
| K3 | Return `GT-CE-LTP-1240-1026-0001` (For IT Configuration) and an Available unit to the supplier | Both succeed (any status that has not exited may start an exit) | Blocked because of the starting status (unless the product owner set a rule) |
| K4 | Open the Move form of a unit that has history (for example the replacement unit from J3, or any unit with two entries) and read Status history | Newest entry first with a blue dot and connector, earlier entries grey; each has the badge with its date, "by {name}", the text (reason, else note, else "No note recorded" in muted colour). The paperclip document link and "Replacement: {tag}" lines exist in the code but only an exited unit has them, and the form never opens for an exited unit, so they cannot be seen in the prototype. In the ported build, verify them wherever an exit's history is shown | Order, dot colours or a line is wrong |
| K5 | Choose a date that is not today and save | The badge date, Movements date and Activity feed use the chosen date, in "2026, Oct 20" style | Today's date is used |
| K6 | Open the Activity feed after an exit | A status change event "{old status} → Supplier Return" (or "Client Pull-Out (Competitor)") with Status Date, Reason and Document rows, and a movement event with Movement Type, Movement Number, Location and "Resulting Status". Linking or unlinking a replacement shows "link" events with a verb (see Q) | An event missing |

### L. Shell, guards and prototype controls (→ Dev Doc: 5. Shell, 8)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| L1 | Look at the sidebar on `/move-asset`, `/move-asset/{tag}/move` and `/assets` | "Move Asset" (truck icon) is active on the first two, "Assets" on the third | Both or neither highlighted |
| L2 | Read the breadcrumbs on the entry, form and done pages and click each link | Entry: Home > Move Asset (current, no link). Form: Home > Move Asset (link) > {tag} (current). Done: Home > Move Asset > {tag} (link back to the form) > Done | Wrong trail or links |
| L3 | Viewing as Read only, open a Move form URL directly | (Prototype) the form still opens: the role is not checked on the form page (the entry page and the Move buttons are). The ported build must refuse it | The ported build lets a read only user save |
| L4 | Click the arrow beside the title (tooltip "Back to Assets"), and Cancel | Both go to the Assets list, with no confirmation. "Change move type" (top right of the header) opens the same menu as the Move asset button | Different destination or a prompt |
| L5 | Set State to Not found, open a Move form; set it to Loading | Not found: "We couldn't find that asset", "The tag may be wrong or the unit may have been removed.", button "Back to Assets". Loading: the form shows as usual (not handled on this page) | Error page |
| L6 | Click Reset sample data | Info toast "Sample data reset" with "The asset list and its history are back to the starting data."; exited units are available again; the stored attachment files are cleared too | Toast missing or data kept |
| L7 | Hover every link and button on Move Asset | Pointer cursor; no underline ever; disabled controls keep the default cursor | Underline, or no pointer |
| L8 | Check the tab titles | Entry "Move Asset - GoTeam Assets"; form "Move {tag} - GoTeam Assets"; done "Asset moved - GoTeam Assets" | Titles differ |
| L9 | Press Tab once on a fresh load | A skip link appears first and jumps to the main region | No skip link |
| L10 | Reload directly on `/move-asset/{tag}/move` and `/move-asset/{tag}/done` | The page renders (no server error, no flash of the wrong page) | 404 or hydration error |

### M. Check In and Check Out, and the Legacy statuses (→ Dev Doc: 3. Move Asset flow)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| M1 | Open Check In or Check Out (no `?kind`) and read the form top to bottom | Header "Change move type" menu; subtitle "Check this unit in or out and set its status."; order: Movement type, Location type, the location, supplier or team member, "Checked in by" or "Checked out by", Note, New status last | A different order, or a field that the live form does not have |
| M2 | Open Check In or Check Out on a unit that is Checked In (for example `GT-CE-LTP-1240-1026-0003`), then on a unit that is Checked Out | The toggle starts on Check Out for a unit that is in, and on Check In for a unit that is out; it is two retrieval style buttons, labelled Check In and Check Out | The wrong default, or a select instead of buttons |
| M3 | Pick Check In | Location type shows three icon cards (Asset Location, Supplier, User Address), always visible; Supplier and User Address are off; the line under them reads "A Check In always goes to an asset location."; Asset location (placeholder "Search asset location") is asked | A Check In can go to a supplier or a team member |
| M4 | Pick Check Out, then each location type | Asset Location: asset location select. Supplier: supplier select (placeholder "Search supplier") and its address shown. User Address: team member search and the member's address shown; before a pick the text reads "The team member's address will be used". The form height does not jump | Cards appear and disappear, or the form jumps |
| M5 | Team member search: type part of a name, then an employee number, then an email | The field shows "Find team member" with the placeholder "Type a name or employee ID..."; each row is two lines, the name over "{employee number} · {email}"; all three searches find the same person | Search only matches the name, or a row has one line |
| M6 | Save a Check Out to a team member picked by employee number | The unit's custodian is that member; Movements has a Check Out "Checked out to {name}"; toast "{tag} is now {status}" with "The move is in the asset's Movements and Activity Feed."; the done page opens | Custodian not set |
| M7 | Click "Move Asset" with nothing filled | Banner "Something is still needed" listing what is missing in order (movement type, location type, asset location, supplier or "who it is checked out to", the new status); each marked field has a line such as "Choose where the unit goes." or "Choose who the unit is checked out to." | A missing field not marked |
| M8 | Open the status list and the assets list Status filter and look at the Legacy group | After the lanes: Defective (red), For Inspection (yellow), In Transit (purple), Pending Disposal (orange), Under Repair (yellow), A to Z; they are chosen like any status. The filter shows 0 for each (no sample unit has one) | A Legacy status missing, or a colour that is not the live one |
| M9 | Save a Check In with a Legacy status (for example Defective) and look at the list | The unit shows the status badge in its colour with the date; the filter count for Defective becomes 1; Movements has the Check In | Badge uncoloured, or the filter does not find it |
| M10 | Pick Charged Deduction | On a Check In or Check Out form, a "Supporting documents" warning block is already on screen before you pick the status; it becomes usable only now: Authority to Deduct and IT Clearance, each with an Optional badge, a button "Attach document", PDF, PNG or JPG up to 10 MB. Nothing moves on the page when you pick or change the status | The block appears and pushes the form, or a document is required |
| M11 | Switch to any other status; then back to Charged Deduction and attach a `.docx` | The two document slots stay on screen but cannot be used (inert) for any other status. With Charged Deduction on, the `.docx` is refused with the usual "can't be attached" text | Slots disappear, or the `.docx` is accepted |
| M12 | Save a Charged Deduction with both documents, open the Activity Feed | The status change event has a Document row (the Authority to Deduct) and an IT Clearance row, and the IT Clearance chip "IT Clearance: {name}" beside the Authority chip opens the file in a new tab | The IT Clearance cannot be opened |

### N. The three kinds of move and the Move menu (→ Dev Doc: 3. Move Asset flow)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| N1 | Open the Move menu from the three places: the truck icon in the Assets list row, the "Move asset" button in the asset page header, the "Move Asset" button on the Move Asset page | The same menu in each: "Check In or Check Out" (Move the unit to any other status), "Return to supplier" (Send the unit back to its supplier), "Client pull-out" (The client takes the unit back). On the Move Asset page the kind opens for the tag typed in the field; there the menu does not know the unit yet, so a Monthly Rental shows the toast from E9 instead of the off item | A different menu, or only two kinds |
| N2 | Pick each kind from the list row | Check In or Check Out opens `/move-asset/{tag}/move`; Return to supplier opens `?kind=supplier`; Client pull-out opens `?kind=client`. The form header, subtitle and fields match the kind (subtitles: "Check this unit in or out and set its status.", "Return this unit to its supplier.", "Record the client pulling this unit out.") | The wrong kind, or a form that changes shape after it opened |
| N3 | Open the menu on a Monthly Rental unit (for example `GT-CE-LTP-1233-0926-0013`) and hover Client pull-out | The item is dimmed with the description "Not available for this unit" and a tooltip with the reason "Only Outright Purchase and BYOD units can be pulled out by the client. This unit is Monthly Rental." | No tooltip, or the item looks usable with no reason |
| N4 | Click the disabled Client pull-out | A toast "Client pull-out isn't available for this unit" with the same reason; no navigation | The form opens |
| N5 | Use the menu with the keyboard: Tab to the button, Enter, arrows, Enter; press Esc | Opens, moves, picks, closes; focus returns to the button; a visible focus ring | Mouse only |
| N6 | Click "Change move type" in the form header and pick another kind | The page switches kind in place (the browser Back button does not return to the old kind) and the new form is empty | The old values stay |
| N7 | Look at the menu as Read only | The Move buttons are not shown at all | Read only user sees the menu |

### O. The Move details drawer (→ Dev Doc: 7. Move Asset screens)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| O1 | On the done page of an exit click "View Move Details"; on a normal Check In or Check Out done page look for it | The asset page opens with a floating panel from the right (title "Move details", subtitle "{tag} · What was recorded when this unit left. The move itself is final."). A Check In or Check Out has no "View Move Details" button | The button shows for an unexited unit |
| O2 | Open `/move-asset/GT-CE-LTP-0826-0005/details` directly | It forwards to `/assets/GT-CE-LTP-0826-0005?moveDetails=1` with the drawer open; closing it removes `?moveDetails` from the address | A page of its own, or the drawer cannot be closed |
| O3 | Open the drawer from the asset page header "Move details" button (exited unit, as an officer and as Read only) | The drawer opens; the button exists only for an exited unit; a unit that has not exited shows "Move asset" instead for an officer, and nothing for Read only | The button on a unit that has not exited |
| O4 | Read the drawer | Panel at most 440 px wide, inset from the screen edges, close button first. Section Move: New status (pill with date), the fields (Date, Done by, Movement, Location), Reason, Note, then "Supplier return agreement" or "Client instruction" with the document chip (read only, tooltip "Open file in a new tab") | A field edited in place, or a missing section |
| O5 | Open the drawer for a unit whose record has no note, document or reason | The empty states read "No note recorded", "No reason recorded", "No document attached" (and "No date recorded", "No name recorded", "No movement recorded", "No location recorded") in muted text | A blank value |
| O6 | Open the drawer of a unit that is not exited (via `?moveDetails=1` on its page) | "{tag} has no move to show" with "Move details appear once a unit has been returned to its supplier or pulled out by its client." and a "Move this asset" button | The drawer shows another unit's data |
| O7 | Press Esc and click outside while the drawer is open; resize to a phone | Both close it; on a phone it fills the width less 24 px | Cannot be dismissed |

### P. The replacement unit, any time (→ Dev Doc: 6. Replacement unit rules)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| P1 | Open the drawer of a Supplier Return unit and read the Replacement section | Heading "Replacement unit from the supplier" with an Optional badge; the linked unit as "{tag} · {model}" with an open in new tab icon and its status badge, or "Not linked yet"; a button "Add replacement" or "Edit replacement" (officers only). A Client Pull-Out has no Replacement section | The section on a Client Pull-Out, or a Read only user can edit |
| P2 | Add a replacement long after the exit (not on the day) | Allowed at any time: there is no lock rule. Save toast "{replacement} is the replacement for {tag}"; both units show history entries | A "too late" refusal |
| P3 | Change it to another unit, then clear it | The previous unit gets "No longer the replacement for {tag}"; clearing toasts "The replacement for {tag} was cleared"; the old and new units each have an Activity Feed "link" event with a verb | The old unit keeps the link |
| P4 | In edit mode read the helper text and press Cancel | "Both units show the change in their history. The replacement unit's own status does not change."; Cancel leaves the old value | The status of the replacement unit changes |

### Q. The replacement picker (→ Dev Doc: 6. Replacement unit rules)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| Q1 | Open the picker for `GT-CE-LTP-1233-0926-0013` (Return to supplier form) | A popover about 36 rem wide with a search box "Search tag, model, serial, supplier or PO"; two sections with small capital headings: "Same supplier" then "Other suggestions"; each option shows "{tag} · {model}" and the supplier and PO under it | One flat list, or a unit that is not Available |
| Q2 | Open the picker for `GT-CE-LTP-1180-0326-0042` | `-0043` is under "Same supplier" (same purchase order and supplier, listed first); `-0017` is under "Other suggestions" (same model and tech pack, different supplier) | Wrong section |
| Q3 | Hover then click the "?" beside each heading | Hover and keyboard focus show a tooltip; a click pins the text inline under the heading and the tooltip stops showing; another click unpins | Help only on hover |
| Q4 | Type a tag fragment, a model, a serial, a supplier, a PO; then a text that matches nothing | Each narrows the options and hides a section with no match; no match reads `No unit matches "{text}".` | Search does not cover a field |
| Q5 | Click the open in new tab icon on a row; Ctrl or Cmd click a row | The unit's asset page opens in a new tab and the picker stays open and unchanged; a plain click chooses it and closes the picker, clearing the search | Ctrl click chooses it |
| Q6 | Choose a unit and reopen the picker | The trigger shows "{tag} · {model}"; that row is blue with a check; a row "Clear. Not linked yet" is at the top; the footer line reads "Ctrl+click (Cmd+click on a Mac) an option, or use its icon, to open the unit in a new tab." | No way to clear |
| Q7 | Pick a unit already used as another unit's replacement, and the unit being returned | Neither is offered | They are offered |
| Q8 | Use a unit with no Available match (set up by linking all candidates elsewhere, or use a unit with a very different model) | The list says "No Available unit matches this one yet. Units from the same supplier or purchase order, or with the same model, tech pack or client, show up here. The replacement is optional, so you can leave it empty."; with no Available units at all the trigger reads "No available units to link yet". The Replacement stays optional | A block on saving the exit |
| Q9 | Keyboard: Tab to the trigger, Enter, type, Tab to rows and the icons, Esc | All reachable; Esc closes; focus returns to the trigger; page behind does not scroll while open | Mouse only |

### R. Attachments and the stand-in file (→ Dev Doc: 8. Persistence)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| R1 | Save an exit with a PDF or image, open it from Movements, the Activity Feed and the drawer; reload; open it again | The real file opens each time in a new tab, with no link back to the app | A stand-in, a blank page, or an opener to the app |
| R2 | Do R1 for a Charged Deduction (both documents) | Both open as the real files after a reload | One of them shows the stand-in |
| R3 | Open the paperwork of a sample unit (`GT-CE-LTP-0826-0005`, `GT-CE-LTP-0726-0002`) | A stand-in page opens naming the file and reading "The file itself is not stored in this browser. Attach the document again to see it here." (a PDF for a PDF, an image for an image) | A broken link |
| R4 | Check a record made before this build (an older saved snapshot) | Its file cannot be recovered: the stand-in opens; attach it again | A crash |
| R5 | Press Reset sample data, then open a document you attached | The stored files are cleared with the data; the stand-in opens (or the unit is back to the sample record) | The old file still opens for a record that no longer exists |
| R6 | Open the same flow in a private window | The save still works; the file opens in that session and may not after a reload | An error that blocks the save |

### S. Scroll fade (→ Dev Doc: 8. Shell)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| S1 | Open the Move form and scroll the body from top to bottom | No fade at the very top; a fade at the bottom while there is more below; a fade at both edges in the middle; none at the very bottom | A fade over content that has nothing past it |
| S2 | Open a short list (a filter with two options, the status picker after a search) | No fade at all because nothing scrolls | A fade on a list that fits |
| S3 | Check the replacement picker, a filter menu, the All filters drawer and the Move details drawer | The same behaviour as S1 in each | One of them always fades |
| S4 | Resize so a region begins or stops overflowing | The fade appears or goes away without a reload | It stays |

### T. Contrast and keyboard in dark and light (WCAG 2.2 AA)
Run each check in both themes (system setting) and, where it matters, with the keyboard only.
| # | Steps | Expected | Bug if |
|---|---|---|---|
| T1 | Movement type toggle, selected and not selected | The selected button's text is readable (at least 4.5 to 1) | Pale text on a pale fill |
| T2 | Location type cards: selected, not selected, disabled | The selected card's label reads well; in dark mode it uses the primary colour; the grey address preview under a card is readable | A label that fades into the card |
| T3 | The "All required" badge on the exit panel | Dark amber text on the amber fill in both themes | Low contrast |
| T4 | The Activity and Movements filter chip with its count, active and inactive | The count badge on the active chip is dark text in dark mode and the fill is darker in light mode | The count disappears on the active chip |
| T5 | Hover a row in the Assets list in dark mode, with the frozen columns, and in Custody history | The hover colour is opaque: nothing shows through the pinned columns | See through frozen cells |
| T6 | The date half of a status badge | A 1 px outline in the status colour; the text is readable against the row (3 to 1 or better for the edge). The status colours and fills are unchanged | The outline changes a colour, or the date is hard to read |
| T7 | Keyboard only: open the Move menu, the form, the status picker, the replacement picker, the confirm modal, the drawer | Tab order is logical, a 2 px focus ring is visible on every control, Esc closes each overlay and focus returns to where it was | A control with no visible focus |
| T8 | Run axe on the Move form (light and dark) | Only inherited or library items remain: Reka combobox and listbox roles, aria-hidden-focus while a modal opens, the design system placeholder colour at 3.5 to 1, the existing All filters drawer headings at 4.34 to 1, and the simulator bar | A new failure in an Assets component |
| T9 | Sideways overflow at 320, 375, 768 and 1440 px | None on the entry page, form, drawer, list and detail | A horizontal page scroll |

---

## Responsive & Touch (→ Dev Doc: Responsive Spec)
Run Move Asset on the built app at 390, 360, 768, 1920 and 320 px, and drag 320 to 1920.
- **No horizontal page scroll** on the entry page, the move form (with the exit panel open) and the done page.
- **Move form** is one column on a phone; the Status history card sits under the form and becomes a sticky column from 1280 px. Asset card is two columns below 768 px and four from 768 px. Movement card and exit panel are one column below 768 px and two from 768 px.
- **Touch targets** at least 44 by 44 px on mobile, 8 px apart (the copy buttons have an extended hit area; verify each).
- **Text** at least 12 px; addresses wrap rather than overflow.
- **200% zoom** reflows; **on-screen keyboard** open does not hide the confirm buttons; **landscape phone** works.
- **Keyboard:** Tab reaches every control in a logical order with a visible 2 px focus ring; the confirm modal traps focus and Esc closes it; the status picker search takes focus when it opens.
- **Dark mode:** the exit panel, banners and badges keep contrast (see T).
- **Move menu and drawers:** the Move menu, the replacement picker and the Move details drawer fit a 320 px screen; the drawer fills the width less 24 px on a phone.

## Smoke flows (already automated in Playwright)
The prototype ships `tests/e2e/assets-smoke.spec.ts` (16 tests: 10 older and 6 under "Every kind of move", all passing). Port or extend it against the real app. The tests find the form by `#reason`, `input[type=file]`, the button named "Select status", the buttons "Move Asset" and "Return to supplier", the alert banner, and the texts "can't be moved again" and "Asset Moved Successfully". The exit tests start from `?kind=supplier` or `?kind=client`. The exit flows:
1. Move a unit to Supplier Return with a document, confirm, see it in Movements, reload and confirm it persisted; open the document in a new tab.
2. An exited unit cannot be moved again from a direct URL; an unknown tag is not found.
3. A blocked Client Pull-Out save scrolls to the banner and marks the missing fields.

The six "Every kind of move" tests:
4. The Move asset menu on the list row offers the three kinds and explains the one that is off.
5. A Check In to an asset location with a Legacy status shows in Movements.
6. A Check Out to a team member chosen by employee number or email records the custodian.
7. Charged Deduction documents stay on screen and switch on only for that status.
8. The Move details drawer opens from a link, and the replacement can be added later.
9. The Legacy statuses are in the list's Status filter.

## Sign-off checklist
- [ ] A1 to A7 · [ ] B1 to B14 · [ ] C1 to C5 · [ ] D1 to D5
- [ ] E1 to E9 · [ ] F1 to F7 · [ ] G1 to G11 · [ ] H1 to H7
- [ ] I1 to I7 · [ ] J1 to J5 · [ ] K1 to K6 · [ ] L1 to L10
- [ ] M1 to M12 · [ ] N1 to N7 · [ ] O1 to O7 · [ ] P1 to P4 · [ ] Q1 to Q9 · [ ] R1 to R6 · [ ] S1 to S4 · [ ] T1 to T9
- [ ] Responsive and touch block · [ ] Keyboard and dark mode · [ ] Simulator strip absent in production

## Quick regression pass (after a fix)
The Move menu (three kinds, disabled Client pull-out) · a Check In and a Check Out · exit with missing fields · confirm and save · save and reload · exited unit stays blocked · Move details drawer · document opens in a new tab after a reload · Reset sample data.
