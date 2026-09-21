---
name: doc-to-prd
trigger: "make this into a prd / doc to prd"
description: "Turns an end-user's raw request documents (a long, narrative/storytelling PDF and/or a simple demo HTML showing a flow) into a clean PRD. Does the extraction/de-fluffing step itself, then hands off to the write-spec skill for the actual PRD authoring — never re-implements spec writing."
sources: [user]
aliases: [doc-to-prd, intake-to-prd, PRD from docs]
---

# Doc → PRD

**What this is for:** end users send requests as prose — a multi-page PDF written like a story (context, anecdotes, meandering justification) and sometimes a simple HTML page that just demos a flow visually. Neither is a spec. This skill's job is narrow: extract the actual product signal from that noise, verify nothing was lost or invented, and only then call `write-spec` to produce the real PRD. It does not write the PRD itself — that stays `write-spec`'s job, so PRD structure/quality only has one source of truth in this environment.

---

## Step 1 — Ingest every source document

- **PDF**: read it directly (the Read tool handles PDFs natively). If it's long, read in page ranges rather than skipping content — a "few pages of storytelling" doc still needs every page actually read, not summarized from the first page's tone.
- **HTML flow demo**: read the file or open it in the Browser pane. Treat it as a *behavioral* artifact — extract the screens/states/steps it demonstrates, not its visual styling (that's a design-pipeline concern, not this skill's).
- **Multiple documents**: read all of them before extracting anything. Note upfront which is authoritative if they conflict (usually the newest one, or ask if unclear).

## Step 2 — Extract the signal, strip the narrative

Produce an **Extracted Brief** — short, factual, bulleted, in the source's own terms (don't paraphrase into product jargon the source didn't use, that's where meaning quietly drifts):

- **Who** — the roles/personas the doc describes or implies, exactly as named in the source
- **The problem** — what's actually wrong or missing, separated from the anecdote used to illustrate it (an anecdote is evidence for a problem, not the problem statement itself)
- **Current flow** — the as-is process/screens described or shown, step by step, factual
- **Desired flow / outcome** — what the doc asks for or demonstrates as the target state
- **Explicit requirements or constraints** — anything stated as a must/must-not, a number, a deadline, a compliance/business rule
- **Numbers mentioned** — volumes, frequencies, timings, thresholds — carried verbatim, never rounded or invented
- **Open questions** — anything the source implies but doesn't actually state (a persona mentioned once with no detail, a flow step that's shown but never explained, a requirement that contradicts another part of the doc)

**Never invent.** If the doc is vague about something a PRD would normally need (success metric, edge case, scope boundary), that goes in Open Questions — it does not get filled in with a plausible-sounding guess.

Output the Extracted Brief and show it before moving on — this is the checkpoint where the requester (or you) can catch a misread before it propagates into the PRD.

## Step 3 — Cross-check, if multiple sources

When both a PDF and an HTML demo exist: confirm the demo's flow actually matches the PDF's described flow. Flag any place they disagree (the doc says one thing, the demo shows another) as an Open Question — don't silently pick one.

## Step 4 — Hand off to `write-spec`

Pass the Extracted Brief (not the raw source documents) to the `write-spec` skill to produce the actual PRD — goals/non-goals, success metrics, acceptance criteria, phased scope. This skill does not author PRD sections itself; `write-spec` already owns that structure and quality bar.

## Step 5 — Traceability check before delivering

Skim the finished PRD against the Extracted Brief: every requirement in the PRD should trace back to something actually in Step 2's brief (and therefore back to the source doc), not something that crept in during spec-writing. Flag anything that doesn't trace.

---

## Output

Deliver both as **actual `.md` files**, not just inline chat text. Write them next to the source document (or the session's scratchpad directory if the source has no clear folder), **never inside the current project's working directory** — this skill's output is a deliverable for the requester, not project source, and shouldn't get committed or mixed into repo contents. Then send both with `SendUserFile`:
1. **Extracted Brief** — save as `<source-name>-extracted-brief.md`, so the requester can sanity-check the source was read correctly
2. **PRD** (from `write-spec`, Step 4) — save as `<source-name>-PRD.md`, the actual deliverable

Show a short summary in chat, but the files are the deliverable — don't make the requester copy text out of the conversation.

## Hard rules

1. Never summarize a long PDF from its opening pages alone — read the whole thing.
2. Never invent a requirement, metric, or persona detail the source doesn't state or clearly imply — Open Questions, not guesses.
3. Never skip the Extracted Brief checkpoint — it's what catches a misread before it becomes a wrong PRD.
4. Never re-implement PRD structure here — `write-spec` is the single source of truth for PRD authoring in this environment.
5. Conflicting sources get flagged, never silently resolved by picking one.
