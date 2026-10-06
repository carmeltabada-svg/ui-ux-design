<script setup lang="ts">
// Standalone page mirroring how an attached form actually opens in the real
// workflows - a real page in its own tab with no AMS app chrome (sidebar/navbar).
// Styled as an actual printable document (letterhead, bordered tables, a fixed
// "paper" canvas). Renders off the shared RETRIEVAL_FORMS/RETRIEVAL_FORM_SECTIONS
// records (app/data/retrievalForms.ts) - the builder autosaves into those same
// records, so this always reflects the latest saved state, no draft-passing needed.
// `ssr: false` - this page's whole point is to reflect whatever was most
// recently saved in the builder, and that only ever lives in localStorage
// (there's no backend). An SSR pass can't read localStorage, so it always
// rendered the static seed data first and only swapped in the real,
// saved state after a client-side hydration step - visible as the page
// flashing from a default background to the real one a beat later.
// Skipping SSR here means there's no server-rendered HTML to reconcile
// against, so the saved snapshot can be read and applied synchronously,
// before the very first paint, with nothing to flash away from.
definePageMeta({ layout: 'blank', ssr: false })

import { RETRIEVAL_FORMS, RETRIEVAL_FORM_CONTENT, PAGE_SIZES, DEFAULT_PAGE_MARGINS, type PageSize } from '~/data/retrievalForms'
import { SAMPLE_VALUES, resolveTokensForPrint, expandCaseAssetRows, expandTicketAssets, omitReceivedDate } from '~/data/templates'
import { backgroundStyle } from '~/utils/formBackground'
import { provideFormFieldRegistry } from '~/utils/formFieldRegistry'
import { provideFormSubmitAttempt } from '~/utils/formSubmitAttempt'
import { provideFormFieldsInteractive } from '~/utils/formFieldsInteractive'
import { hydrateFormsFromStorage } from '~/utils/formStorage'
import { buildFormLetterhead } from '~/utils/formLetterhead'
import { renderFormFieldsAsStaticHtml } from '~/utils/formFieldStaticRender'
import { buildPrintCss } from '~/utils/formPrintStyles'

hydrateFormsFromStorage()

const route = useRoute()
const formId = computed(() => (route.query.formId as string) || 'return-ack-onsite')
const ticketRef = computed(() => (route.query.ref as string) || 'APR-2026-04821')

const form = computed(() => RETRIEVAL_FORMS.find(f => f.id === formId.value))
// Live computed onto the reactive store, not a one-time snapshot - same
// reasoning as the builder page's own `content`: this page's setup runs
// before localStorage hydration (`page:finish`), so a plain ref taken here
// would miss whatever hydration loads a moment later.
//
// Resolved through resolveTokensForPrint before it ever reaches the editor -
// this page is both the "team member fills this out" view and the source of
// the printed/PDF'd copy, so any `{{TOKEN}}` a field's label/hint/body text
// still carries (see FormFieldNodeView.vue's placeholder insertion) gets
// swapped for its real sample value here, same as the email preview already
// does - a raw, unresolved `{{CODE}}` should never reach a recipient, on
// screen or on paper. There's no real ticket data in this prototype, so
// SAMPLE_VALUES stands in for it, the same simulated-data pattern this page
// already uses for its own ticket ref/dates.
// Opened from a ticket (?ticket=<id>): use that ticket's own values, handed
// over through localStorage by the ticket page, and leave any code it has no
// value for as its raw {{CODE}} token instead of generic sample data. Opened
// from the Templates/Forms editors (no ticket): SAMPLE_VALUES as before.
const ticketValues = computed<Record<string, string> | null>(() => {
  const id = route.query.ticket as string | undefined
  if (!id) return null
  try { return JSON.parse(localStorage.getItem(`ams:formPreviewValues:${id}`) ?? 'null') } catch { return null }
})
// Post-Retrieval Charging forms come with the case's equipment rows, so the
// equipment table prints one row per asset in the case, not just the first.
const caseAssetRows = computed<Record<string, string>[]>(() => {
  try { return JSON.parse(ticketValues.value?.__CASE_ASSET_ROWS ?? '[]') } catch { return [] }
})
// Every confirmed asset of the ticket, for the retrieval forms' asset tables.
const ticketAssetLines = computed(() => {
  try { return JSON.parse(ticketValues.value?.__TICKET_ASSET_ROWS ?? '[]') } catch { return [] }
})
const content = computed(() => ticketValues.value
  ? resolveTokensForPrint(expandTicketAssets(expandCaseAssetRows(ticketValues.value?.__CASE_NOT_RETURNED ? omitReceivedDate(RETRIEVAL_FORM_CONTENT[formId.value] ?? '') : (RETRIEVAL_FORM_CONTENT[formId.value] ?? ''), caseAssetRows.value), ticketAssetLines.value), ticketValues.value, true, true)
  : resolveTokensForPrint(RETRIEVAL_FORM_CONTENT[formId.value] ?? '', SAMPLE_VALUES, false, true))
const mode = computed(() => (route.query.mode as 'onsite' | 'remote') || form.value?.mode || 'onsite')
const pageSize = computed<PageSize>(() => form.value?.pageSize || 'letter')

// The repeating per-page letterhead (logo/address/ref-stamp header, doc
// name/"Internal Use Only" footer) - shared with the builder's own edit
// canvas, see ~/utils/formLetterhead.ts. Rendered once per physically
// paginated page by tiptap-pagination-plus, not once around the whole
// document.
const letterhead = computed(() => buildFormLetterhead(
  { name: form.value?.name || '', themeColor: form.value?.themeColor || '#386BE6', category: form.value?.category },
  mode.value
))

// @page's `size` can't be scoped by a CSS selector - it's a page-level rule,
// not tied to any element - so a static <style> block can't switch it per
// form. Injecting the rule's text reactively through useHead is the only way
// to keep the printed page size in sync with the form's own picked size.
const PAGE_SIZE_INCHES: Record<PageSize, string> = {
  letter: '8.5in 11in',
  legal: '8.5in 14in',
  a4: '210mm 297mm',
  tabloid: '11in 17in'
}
// margin: 0, not a physical printer margin - the printed page is the exact
// same `.rm-page-break` box already on screen, and that box already has its
// own real internal margin baked in (the page's own CSS custom properties,
// from FormDocumentEditor's pageSizeConfig/margins). A nonzero @page margin
// here would stack a *second*, independent margin on top of that, padding
// the printed page out further than what's actually shown on screen -
// exactly the kind of print/preview mismatch this is meant to avoid.
useHead({
  style: [{ innerHTML: computed(() => `@page { size: ${PAGE_SIZE_INCHES[pageSize.value]}; margin: 0; }`) }]
})

useSeoMeta({
  title: () => form.value?.name ?? 'Form preview',
  description: 'Preview of the attachment form referenced by retrieval emails.'
})

const toast = useToast()

// Real pagination (tiptap-pagination-plus, see FormDocumentEditor.vue) - the
// repeating per-page letterhead above is wired straight into its own
// header/footer widgets, so it genuinely repeats once per physically
// paginated page, not once around the whole document.
//
// Every FormFieldNodeView registers its own filled/required state here (see
// ~/utils/formFieldRegistry.ts) - this is what the signature field's own
// lock/veil already reads from directly (no extra wiring needed beyond
// calling this), and what Submit's disabled state below reads too.
const fieldRegistry = provideFormFieldRegistry()
const hasUnfilledRequired = computed(() =>
  Object.values(fieldRegistry).some(entry => entry.required && !entry.filled)
)

const attemptedSubmit = provideFormSubmitAttempt()

// This is the "what happens when a team member actually receives and fills
// this out" view - always fillable, never editable (the builder's own edit
// view is the only place the form's structure changes). See
// ~/utils/formFieldsInteractive.ts.
provideFormFieldsInteractive(ref(true))

// A form link is single-use once actually submitted - the team member filled
// it out and signed it, so reopening the same link later shouldn't let them
// (or anyone else holding it) preview or refill it again. Keyed by form id +
// ticket ref (not just form id) since the same form template is reused
// across many different tickets/team members, each with their own link.
// There's no backend here, so "submitted" state and "emailed a copy" are both
// simulated the same way every other write in this prototype is - persisted
// to localStorage, and a toast standing in for the real email send.
const SUBMISSIONS_KEY = 'ams:formSubmissions:v1'
const submissionId = computed(() => `${formId.value}:${ticketRef.value}`)

function readSubmissions(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || '{}')
  } catch {
    return {}
  }
}

const alreadySubmitted = ref(!!readSubmissions()[submissionId.value])

function submitForm() {
  attemptedSubmit.value = true
  if (hasUnfilledRequired.value) return
  const submissions = readSubmissions()
  submissions[submissionId.value] = new Date().toISOString()
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions))
  alreadySubmitted.value = true
  toast.add({
    title: 'Form submitted',
    description: 'A signed copy has been emailed to you for your records.',
    icon: 'i-lucide-check',
    color: 'success'
  })
}

// Real print/PDF output is generated separately from the live, interactive
// fill-out view above - not by printing that view directly. Two different
// jobs were being asked of one thing before: `tiptap-pagination-plus` (what
// MasterDataFormDocumentEditor uses) turned out to have no real per-page
// document structure at all (see PAGINATION_TOOLKIT_STUDY.md) - its on-screen
// "pages" are a pure float illusion with nothing marking where a physical
// page boundary actually falls in the real content, which is exactly why
// print/PDF output kept breaking (missing footers, overlapping headers, a
// stray nested page) independently of whatever the canvas looked like.
//
// Paged.js (MIT, genuinely implements the CSS Paged Media spec - see the
// study) renders a *second*, completely separate, real paginated copy on
// demand: the document's resolved HTML (tokens resolved, fields turned into
// real static markup showing each field's actual live-captured answer - see
// ~/utils/formFieldStaticRender.ts, reading off the same fieldRegistry the
// interactive fields below write into) plus real `@page` CSS built from this
// form's own margins/page size (~/utils/formPrintStyles.ts). This never
// touches the live interactive view or the builder's editor - it only runs
// at the moment someone asks for a printable/PDF copy.
const printRoot = ref<HTMLElement>()
const printing = ref(false)
const printError = ref('')

async function printForm() {
  if (!form.value) return
  printError.value = ''
  try {
    const resolvedBody = renderFormFieldsAsStaticHtml(content.value, fieldRegistry)
    const themeColor = form.value.themeColor || '#386BE6'
    const css = buildPrintCss(pageSize.value, form.value.margins || DEFAULT_PAGE_MARGINS, themeColor, '.print-root')
    const printContent = `
      <div id="print-header-left">${letterhead.value.headerLeft}</div>
      <div id="print-header-right">${letterhead.value.headerRight}</div>
      <div id="print-footer-left">${letterhead.value.footerLeft}</div>
      ${resolvedBody}
    `
    const { Previewer } = await import('pagedjs')
    if (printRoot.value) printRoot.value.innerHTML = ''
    // Paged.js needs the render target actually laid out (not `display:
    // none`) while it measures/chunks content - it calls
    // `getBoundingClientRect()` on its own generated elements as part of
    // pagination, which returns nothing usable (and throws deeper in its own
    // code) against a subtree the browser never laid out at all. So this
    // reveals the (still-empty) print root *before* handing it to Paged.js,
    // not after - briefly showing a blank page while it renders, rather than
    // rendering into a hidden container and revealing it once done.
    printing.value = true
    await nextTick()
    const previewer = new Previewer()
    await previewer.preview(printContent, [{ _: css }], printRoot.value!)
    window.print()
  } catch (err) {
    printing.value = false
    printError.value = 'Could not prepare the printable copy. Please try again.'
    console.error('[form-preview] Paged.js render failed', err)
  }
}

function handleAfterPrint() {
  printing.value = false
}

onMounted(() => window.addEventListener('afterprint', handleAfterPrint))
onBeforeUnmount(() => window.removeEventListener('afterprint', handleAfterPrint))
</script>

<template>
  <div class="min-h-screen relative">
    <!-- A fixed, viewport-sized layer behind everything - not a background
         set directly on this ever-growing (multi-page, potentially very
         tall) scrollable container. `background-size: cover` sizes itself
         against whatever element it's painted on: on the tall scrollable
         container, "cover" meant scaling the image up to cover the *entire
         page height*, cropping most of its width and reading as badly
         zoomed-in - exactly the mismatch against the builder canvas, whose
         own background sits on a short, viewport-sized panel instead. Fixed
         positioning keeps this layer's own size pinned to the viewport
         regardless of how tall the document underneath grows, matching the
         canvas. -->
    <div class="no-print fixed inset-0 -z-10" :style="backgroundStyle(form?.background, '#EEEAE3')" />

    <!-- Fixed to the viewport's own right edge, not a row inside the centered
         document column below - it used to sit directly above the document
         as its own full-width row, which pushed the whole page down by that
         row's height (an empty-feeling gap above the letterhead on a page
         that's supposed to start right at the top of the "paper"). Fixed
         positioning keeps it out of that column's flow entirely, so the
         document always starts at the same place regardless of whether this
         button (or the "already submitted"/error states, which don't render
         it at all) is showing. -->
    <div v-if="form && !alreadySubmitted" class="no-print fixed top-6 right-6 z-20 flex items-center gap-2">
      <UButton type="button" color="neutral" variant="outline" size="sm" icon="i-lucide-printer" :loading="printing" @click="printForm">
        Print / Save as PDF
      </UButton>
      <p v-if="printError" class="text-xs text-error">{{ printError }}</p>
    </div>

    <div class="print-area py-10 px-4 flex flex-col items-center gap-6">
      <div v-if="form && alreadySubmitted" class="text-center py-16 max-w-sm">
        <UIcon name="i-lucide-circle-check-big" class="size-10 mx-auto mb-3 text-emerald-600" />
        <p class="text-base font-semibold text-[#111827]">This form has already been submitted</p>
        <p class="text-sm text-muted mt-1.5">
          A signed copy was emailed to you when it was submitted. This link can no longer be previewed or filled out again.
        </p>
      </div>

      <template v-else-if="form">
        <div v-show="!printing" class="flex flex-col items-center gap-4" :style="{ width: `${PAGE_SIZES[pageSize].widthPx}px` }">
          <!-- No document-name heading here - it sat directly on the page's
               own background (solid/gradient/image), so on some background
               choices (a busy photo, a color close to the text) it just
               wasn't reliably readable. The document itself already carries
               its own name/letterhead. Print/Save as PDF now lives in a
               fixed top-right button above, not a row here. -->

          <!-- Read-only (editable=false) - a team member fills in field
               values here but never edits the document's own structure;
               that's the builder's job. Same component the builder uses (and
               the same repeating per-page letterhead), so what's filled out
               here always matches what was designed. `natural-scroll` drops
               the component's own fixed-height scroll pane (right for the
               builder, which has its own surrounding chrome to scroll
               independently within) - this page has nothing else competing
               for scroll space, so the document should just flow inline and
               let the page itself scroll, instead of a second nested
               scrollbar appearing inside a box sized to an arbitrary
               viewport fraction. -->
          <div class="w-full">
            <MasterDataFormDocumentEditor
              :model-value="content"
              :editable="false"
              :page-size="pageSize"
              :margins="form.margins"
              :header-left="letterhead.headerLeft"
              :header-right="letterhead.headerRight"
              :footer-left="letterhead.footerLeft"
              natural-scroll
            >
              <template v-if="form.showSubmitButton" #actions>
                <UButton type="button" color="primary" variant="solid" size="lg" :disabled="hasUnfilledRequired" :style="{ background: form.themeColor, borderColor: form.themeColor }" @click="submitForm">
                  Submit
                </UButton>
              </template>
            </MasterDataFormDocumentEditor>
          </div>

          <p class="shrink-0 text-[11px] text-[#6B7280] text-center">
            Submit the completed form to the Asset Management Team at {{ SAMPLE_VALUES.ASSET_TEAM_EMAIL }} or {{ SAMPLE_VALUES.ASSET_TEAM_MOBILE }}.
          </p>
        </div>

        <!-- The real print/PDF target - a separate, Paged.js-rendered static
             copy (see printForm() above), only ever populated/shown at the
             moment "Print / Save as PDF" is clicked. Never the live
             interactive view above: Paged.js needs finalized, read-only HTML
             with real per-page structure, which the live Tiptap-based editor
             (built for continuous editing, not print) doesn't produce. -->
        <div v-show="printing" ref="printRoot" class="print-root" />
      </template>

      <div v-else class="text-center py-16 text-muted">
        <UIcon name="i-lucide-file-x" class="size-8 mx-auto mb-2" />
        <p class="text-sm">No form found for "{{ formId }}".</p>
      </div>
    </div>
  </div>
</template>

<style>
/* Only this page needs print rules, so this stays a plain (unscoped) style
   block rather than trying to express `@page` through Tailwind utilities -
   `@page` isn't something a scoped class can reach. The `@page size` rule
   itself is injected reactively via useHead above (see `PAGE_SIZE_INCHES`)
   since it needs to track the form's own picked page size. */
@media print {
  .no-print {
    display: none !important;
  }
  .print-area {
    padding: 0 !important;
    display: block !important;
    background: white !important;
  }
}

/* The real print/PDF target - see printForm() in the script above. Hidden
   (v-show) until Paged.js has actually finished rendering into it, then
   shown just before window.print() fires. Its own real per-page boxes come
   from Paged.js itself (see PAGINATION_TOOLKIT_STUDY.md) - nothing here
   needs to fake page height/gaps the way the old tiptap-pagination-plus
   integration did, because these page boxes are genuinely real. */
.print-root {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
