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
| `GT-CE-LTP-0826-0005` | Already Supplier Return | Exited guard |
| `GT-CE-LTP-0726-0002` | Already Client Pull-Out (Direct Hire), custodian Ines Valdez | Custody and Movements for a pull-out |

## Test first: Known Traps
1. Supplier Return on an In Use unit: its earlier check out to the team member must still be in Movements and Custody History. → Dev Doc: Known Traps 1
2. A Client Pull-Out must not add a second, still counting "Current" row to Custody History. → Known Traps 2
3. Double click Confirm on an exit: one history entry, one movement, one toast. → Known Traps 3
4. The status badge date half is a light tint of the status colour. The status fill colours must equal the live app's; only Supplier Return (teal) and Client Pull-Out (pink) are new. → Known Traps 4
5. Links are blue, never underlined, and show a pointer cursor. On Move Asset only an office location is a link. → Known Traps 5
6. `/assets/constructor` and `/assets/__proto__` must show "not found", not an error. → Known Traps 6
7. A unit that has already left (Supplier Return or Client Pull-Out) must not be movable again, even from a direct URL. → Known Traps 7
8. Reset sample data must bring back every unit, including one you exited. → Known Traps 8

## Out of Scope (do not log as bugs)
Backend and permissions; reversing an exit; the camera QR scanner; the asset model and location pages (links show a note); the simulator strip (must not ship); a new lane for the exits; sub-status as its own colour; a bottom action bar on Move Asset. Anything about the Assets list filters, metric cards or the asset detail layout belongs to the UI/UX enhancements QA Doc.
Also not bugs in the prototype (they are decisions listed in Dev Doc section 10): the optional Note not showing next to a reason; an empty location when a Client Pull-Out unit has no client; the made up time of day and movement numbers; the Done page showing success for any known tag. Log them only if the ported build's product owner has decided otherwise.

---

## Test cases

### A. The two new statuses (→ Dev Doc: 1. Foundations, 5. How an exit shows elsewhere, 6. Location display rule)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| A1 | Look at the two new statuses in the Assets list | Supplier Return teal, Client Pull-Out pink, with the grey sub-status chip **not shown** in the table; date half is a lighter tint of each status colour; date reads like "2026, Oct 20" | Date half is dark grey, or sub-status appears in the table |
| A2 | Open the status filter and pick Supplier Return, then Client Pull-Out | Both are listed under Terminal; only units on the picked status show | A status is missing or the rows do not narrow |
| A3 | Viewing as Read only | Move icon hidden in Actions; "Move asset" hidden on the asset page | Read only user can move |
| A4 | Open `/assets/constructor` | "We couldn't find that asset" | Error page |
| A5 | Look at the Location of one In Use unit, one unit at an office, the Supplier Return unit and the Client Pull-Out unit (Assets list Location column or the asset page; the Move form shows only the In Use and office units, because exited units cannot be opened there; hover each) | In Use: the team member's address with a house icon, tooltip "Asset is based on the team member's current address", plain text. Office: building icon, tooltip "Asset is based on the asset location", blue link. Supplier Return: the supplier's name, truck icon, tooltip "Asset is located at the supplier facility", plain text. Client Pull-Out: the client's name, building icon, tooltip "Asset was pulled out by the client", plain text | A home address, supplier or client is a link; wrong icon or tooltip |
| A6 | Open the asset page of the Supplier Return unit and of the Client Pull-Out unit | Header holder text "At the supplier" and "Pulled out by Fabrikam Logistics" | Shows a team member or "In stock" |
| A7 | Open the asset page of the Client Pull-Out unit and hover the grey chip beside the status badge in the header | Tooltip "Sub-status: Direct Hire" | Chip missing or has no tooltip |

### B. Move Asset (→ Dev Doc: 3. Move Asset flow, 7. Move Asset screens)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| B1 | Sidebar > Move Asset; enter an unknown tag | Inline error and toast, field marked | No error |
| B2 | Enter a valid In Use tag | Opens the move form; sidebar highlights Move Asset | Assets stays highlighted |
| B3 | Enter a Supplier Return tag, or open `/move-asset/GT-CE-LTP-0826-0005/move` directly | "can't be moved again" with a link | A working form appears |
| B4 | Open a Monthly Rental unit's status picker | Client Pull-Out disabled with an info button; hover shows the reason; click shows a toast | Option selectable |
| B5 | Pick Client Pull-Out (BYOD unit); click Move Asset with nothing filled | Banner lists what is needed, page scrolls to it, banner pulses, each missing field red with a line | Nothing visible happens |
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
| C1 | After a Supplier Return, open the Movements tab | A Check In at the supplier address with the reason; the earlier check out to the team member is still there | Earlier check out missing |
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
| D4 | (Prototype only) In the browser console set `localStorage['ams:assets:v4']` to bad data (not JSON; a status that does not exist; a history that is not a list; an `__proto__` key), then reload | The list opens with the sample data, nothing breaks, nothing polluted (`({}).polluted` is undefined) | Error page, or bad data applied |
| D5 | Fill half of an exit form, then reload, or click Cancel, or the back arrow | Everything is gone and no warning is shown; Cancel and the back arrow land on the Assets list | A draft is kept, or a prompt appears (unless the product owner added one) |

### E. Entry page (→ Dev Doc: 7.1)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| E1 | Open `/move-asset` | Tab title "Move Asset - GoTeam Assets"; heading "Move Asset"; subtitle "Scan the asset tag or manually enter the tag."; label "Manual Asset Tag Input"; placeholder "e.g. GT-CE-LTP-1233-0926-0013"; the field has focus; button "Find Asset" | Any wording differs, or no focus |
| E2 | Enter `GT-NOPE-0001`, press Enter | Button shows loading for about a quarter second; the field turns red; text "Asset tag not found. Please check the tag and try again."; error toast with title "Error" and text "Asset not found"; no navigation | No toast, or navigation |
| E3 | Enter the Supplier Return tag | Text "This unit has already been returned or pulled out, so it can't be moved again."; no toast; the field is not red | A toast, or the form opens |
| E4 | After an error, type one character | The message disappears | It stays |
| E5 | Look at the "Try:" chips and click one | Four tags, none exited; the click fills the field and does not submit | Exited tag listed, or it submits |
| E6 | Type a valid tag and press Enter (do not click the button) | Same as clicking "Find Asset": loading, then the Move form | Enter does nothing |
| E7 | Viewing as Read only, open `/move-asset` | The form is replaced by a warning "You can't move assets" with "Only an asset officer can move an asset. Switch the role in the prototype controls to try this page." | Form is usable |
| E8 | Enter an empty value (or only spaces), submit; then a valid tag with spaces around it, then the same tag in lower case | Empty: the not found text, no toast, no wait. Spaces around a valid tag: works. Lower case: not found (exact, case sensitive match) | Empty submit opens something, or surrounding spaces fail |

### F. Status picker (→ Dev Doc: 7.4.1)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| F1 | Click "Select status" | A popover as wide as the field; search box "Search status" has focus; groups in this order with small capital headings: Intake & Ready Pool, Active Use, Return & Triage, Review & Investigation, Decommissioning, Terminal | Order or names differ, search not focused |
| F2 | Type "sup", then "zzz" | "sup" lists only Supplier Return (and any status containing "sup") under its group; "zzz" shows "No status matches."; matching ignores case | Groups with no matches still show |
| F3 | Click and Tab over a status other than the two exits (prototype only) | Greyed, no pointer, no toast, cannot be focused or chosen | Chosen, or a toast appears |
| F4 | Open the picker on the Monthly Rental unit and choose Supplier Return | Allowed | Supplier Return is blocked for Monthly Rental |
| F5 | Choose a status | Popover closes, the search clears, the field shows the name; reopening shows it blue with a check | Popover stays open |
| F6 | On the Monthly Rental unit, hover the Client Pull-Out row, then click it, then click its info button; also Tab to it | Hover tooltip: "Only Outright Purchase and BYOD units can be pulled out by the client. This unit is Monthly Rental." Click on either: info toast titled "Client Pull-Out isn't available for this unit" with the same reason; status is not chosen. The row is focusable. The info button is named "Why is Client Pull-Out unavailable" | No reason, or it can be chosen |
| F7 | Open the picker and press Esc | The popover closes and nothing is chosen. A search you typed is still there when you reopen it | Esc selects something |

### G. Exit details panel and validation (→ Dev Doc: 6. Fields and validation, 7.4, 7.5)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| G1 | Pick Supplier Return | Amber panel "Supplier Return details" with an amber "All required" badge. Fields: Date, "Replacement unit from the supplier" (Optional badge, placeholder "Not linked yet"), document "Supplier return agreement" with "· PDF or image (JPG, PNG), up to 10 MB" and a button "Attach document", Reason. No "why" select. Movement type "Check In", label "Checked in by", Location the supplier address | A field missing or extra |
| G2 | Pick Client Pull-Out (BYOD or Outright Purchase unit) | Panel "Client Pull-Out details". First field "Why the client pulled it out" (placeholder "Select a reason", options Competitor and Direct Hire). No replacement field. Document label "Client instruction". Movement type "Check Out", label "Checked out by", Location the client address | A field missing or extra |
| G3 | Before picking a status, read the Movement card | Movement type and Location say "Set when you pick the status" (muted). "Checked by" shows the officer with initials, name and a "You" badge | A value shown before a status is picked |
| G4 | Click "Move Asset" without picking a status | Banner (alert) titled "Something is still needed" with "Choose the new status first. The details to fill in depend on it."; the picker has a red ring and "Choose the new status." under it; page scrolls smoothly so the banner is centred and the banner pulses | Any text differs, no scroll or no pulse |
| G5 | Pick Client Pull-Out and click Move Asset with nothing filled | Marks and one line texts: "Choose why the client pulled it out." under the select; "Attach the client instruction." with a red Attach button; "Say why the unit is leaving." under Reason. The date is filled with today so it is not marked. For Supplier Return the file text is "Attach the supplier return agreement." | A missing field not marked, or a wrong text |
| G6 | Same click, read the banner | "Can't move the asset yet. Still needed: why the client pulled it out, the client instruction, the reason." (order: date, why, document, reason; with the date cleared it starts "the date, ..."). Supplier Return: "...the supplier return agreement, the reason." | Order or wording differs |
| G7 | After a blocked save fix the fields one by one | Each mark and its line disappear as soon as that field is valid; the banner shrinks and disappears when nothing is missing; clearing a field again marks it again at once | Marks stay, or do not come back |
| G8 | Fill every field including a Note and a changed date, then change the status to the other exit | The whole form is empty: date back to today, why, replacement, file, reason and Note all cleared; no error marks | Some value carries over |
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
| H7 | Save an exit with a document, reload, open the document chip in Movements | (Prototype) a one page stand-in opens because the file is not stored. (Ported build) the real file opens from the stored copy | The ported build opens a stand-in or a broken link |

### I. Confirm, save and the done page (→ Dev Doc: 7.6, 7.8)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| I1 | Fill a valid Supplier Return (with a replacement) and click Move Asset | Modal title "Return this unit to the supplier?"; text "This is a terminal status. The unit leaves the active count, and the change is recorded in its history."; rows Asset ("{tag} · {model}"), New status "Supplier Return", Movement "Check In · {supplier address}", Date ("2026, Oct 20" style), Document (file name), Replacement unit (tag), Reason. For Client Pull-Out: title "Confirm the client pull-out?", New status "Client Pull-Out · Competitor", Movement "Check Out · {client address}", no Replacement row | A row missing, or Note is listed |
| I2 | Click "Keep editing" | Modal closes; every field still filled; nothing saved | Data lost or saved |
| I3 | Open the modal and press Esc, or click outside | Same as "Keep editing"; focus stays inside the modal while open | Saves, or focus escapes |
| I4 | Confirm | Success toast "{tag} is now Supplier Return" (or "{tag} is now Client Pull-Out · Competitor") with "The unit is out of the active count. Its history has the change and the document." | Text differs, or two toasts |
| I5 | Watch the done page | Tab title "Asset moved - GoTeam Assets"; green check; "Asset Moved Successfully"; "{tag} has been moved. You will be redirected in 5 seconds." counting 5, 4, 3, 2, 1, then the asset's Movements tab opens | Count skips, redirect is early or late, wrong tab |
| I6 | On the done page click "Move Another Asset", then repeat and click "View Asset" | Move Another goes to `/move-asset`; View Asset goes to the Movements tab at once; neither is followed by a late redirect | A second redirect fires |
| I7 | Open `/move-asset/NOT-A-TAG/done` | After the countdown (or at once with either button) you land on `/move-asset` | Error page |

### J. Replacement unit (→ Dev Doc: 6. Replacement unit rules)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| J1 | Pick Supplier Return and open the replacement list | Only units whose status is exactly Available (for example `-0003`, `-0004`); each reads "{tag} · {model}"; the unit you are returning is not listed; with more than 7 options a search box appears | An In Use or other status unit listed |
| J2 | Choose one and click Move Asset (valid form) | The confirm modal has a "Replacement unit" row with that tag | Row missing |
| J3 | Confirm, open the replacement unit's Activity feed and its Move form | A separate "Replacement" event "linked this unit as the replacement for {returned tag}" dated the chosen date; its status and status date did not change; the Move form's Status history has the new top entry with the note "Linked as the replacement for {returned tag}". The returned unit's Activity feed detail has the row "Replacement Unit" | Shows a status change |
| J4 | Start another Supplier Return and open the list again | The unit linked in J3 is no longer offered | It is offered again |
| J5 | Choose a replacement, then try to unset it | There is no clear control; only changing the status (which resets the form) removes it | A silent bad value after clearing |

### K. What a save changes (→ Dev Doc: 6. What a save writes, 7.7)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| K1 | Supplier Return on `GT-CE-LTP-1233-0926-0013` | Status Supplier Return; Movements gets a Check In at "Northline IT Supply, 88 Ayala Avenue, Makati City 1226"; the earlier check out to Mara Lim stays; the list's custodian and client columns are empty; the unit's location is now the supplier (name) | Custodian still shown, or earlier check out lost |
| K2 | Client Pull-Out on `GT-CE-MNT-1151-0426-0037` | Status Client Pull-Out with the chosen sub-status chip; Movements gets a Check Out at "Contoso Realty, 5th Avenue corner 26th Street, Bonifacio Global City, Taguig 1634"; the card says "Checked out to Carlo Diaz" and "Recorded by Karl Bustillo"; the custodian is kept | Custodian cleared, or movement type wrong |
| K3 | Move `GT-CE-LTP-1240-1026-0001` (For IT Configuration) and an Available unit to Supplier Return | Both succeed (any status that has not exited may start an exit) | Blocked because of the starting status (unless the product owner set a rule) |
| K4 | Open the Move form of a unit that has history (for example the replacement unit from J3, or any unit with two entries) and read Status history | Newest entry first with a blue dot and connector, earlier entries grey; each has the badge with its date, "by {name}", the text (reason, else note, else "No note recorded" in muted colour). The paperclip document link and "Replacement: {tag}" lines exist in the code but only an exited unit has them, and the form never opens for an exited unit, so they cannot be seen in the prototype. In the ported build, verify them wherever an exit's history is shown | Order, dot colours or a line is wrong |
| K5 | Choose a date that is not today and save | The badge date, Movements date and Activity feed use the chosen date, in "2026, Oct 20" style | Today's date is used |
| K6 | Open the Activity feed after an exit | A status change event "{old status} → Supplier Return" (or "Client Pull-Out (Competitor)") with Status Date, Reason and Document rows, and a movement event with Movement Type, Movement Number, Location and "Resulting Status" | An event missing |

### L. Shell, guards and prototype controls (→ Dev Doc: 5. Shell, 8)
| # | Steps | Expected | Bug if |
|---|---|---|---|
| L1 | Look at the sidebar on `/move-asset`, `/move-asset/{tag}/move` and `/assets` | "Move Asset" (truck icon) is active on the first two, "Assets" on the third | Both or neither highlighted |
| L2 | Read the breadcrumbs on the entry, form and done pages and click each link | Entry: Home > Move Asset (current, no link). Form: Home > Move Asset (link) > {tag} (current). Done: Home > Move Asset > {tag} (link back to the form) > Done | Wrong trail or links |
| L3 | Viewing as Read only, open a Move form URL directly | (Prototype) the form still opens: the role is not checked on this page. The ported build must refuse it | The ported build lets a read only user save |
| L4 | Click the arrow beside the title (tooltip "Back to Assets"), and Cancel | Both go to the Assets list, with no confirmation | Different destination or a prompt |
| L5 | Set State to Not found, open a Move form; set it to Loading | Not found: "We couldn't find that asset", "The tag may be wrong or the unit may have been removed.", button "Back to Assets". Loading: the form shows as usual (not handled on this page) | Error page |
| L6 | Click Reset sample data | Info toast "Sample data reset" with "The asset list and its history are back to the starting data."; exited units are available again | Toast missing or data kept |
| L7 | Hover every link and button on Move Asset | Pointer cursor; no underline ever; disabled controls keep the default cursor | Underline, or no pointer |
| L8 | Check the tab titles | Entry "Move Asset - GoTeam Assets"; form "Move {tag} - GoTeam Assets"; done "Asset moved - GoTeam Assets" | Titles differ |
| L9 | Press Tab once on a fresh load | A skip link appears first and jumps to the main region | No skip link |
| L10 | Reload directly on `/move-asset/{tag}/move` and `/move-asset/{tag}/done` | The page renders (no server error, no flash of the wrong page) | 404 or hydration error |

---

## Responsive & Touch (→ Dev Doc: Responsive Spec)
Run Move Asset on the built app at 390, 360, 768, 1920 and 320 px, and drag 320 to 1920.
- **No horizontal page scroll** on the entry page, the move form (with the exit panel open) and the done page.
- **Move form** is one column on a phone; the Status history card sits under the form and becomes a sticky column from 1280 px. Asset card is two columns below 768 px and four from 768 px. Movement card and exit panel are one column below 768 px and two from 768 px.
- **Touch targets** at least 44 by 44 px on mobile, 8 px apart (the copy buttons have an extended hit area; verify each).
- **Text** at least 12 px; addresses wrap rather than overflow.
- **200% zoom** reflows; **on-screen keyboard** open does not hide the confirm buttons; **landscape phone** works.
- **Keyboard:** Tab reaches every control in a logical order with a visible 2 px focus ring; the confirm modal traps focus and Esc closes it; the status picker search takes focus when it opens.
- **Dark mode:** the exit panel, banners and badges keep contrast.

## Smoke flows (already automated in Playwright)
The prototype ships `tests/e2e/assets-smoke.spec.ts` (10 tests, passing). Port or extend it against the real app. The tests find the form by `#reason`, `input[type=file]`, the button named "Select status", the buttons "Move Asset" and "Return to supplier", the alert banner, and the texts "can't be moved again" and "Asset Moved Successfully". The exit flows:
1. Move a unit to Supplier Return with a document, confirm, see it in Movements, reload and confirm it persisted; open the document in a new tab.
2. An exited unit cannot be moved again from a direct URL; an unknown tag is not found.
3. A blocked Client Pull-Out save scrolls to the banner and marks the missing fields.

## Sign-off checklist
- [ ] A1 to A7 · [ ] B1 to B14 · [ ] C1 to C5 · [ ] D1 to D5
- [ ] E1 to E8 · [ ] F1 to F7 · [ ] G1 to G11 · [ ] H1 to H7
- [ ] I1 to I7 · [ ] J1 to J5 · [ ] K1 to K6 · [ ] L1 to L10
- [ ] Responsive and touch block · [ ] Keyboard and dark mode · [ ] Simulator strip absent in production

## Quick regression pass (after a fix)
Exit with missing fields · confirm and save · save and reload · exited unit stays blocked · document opens in a new tab · Reset sample data.
