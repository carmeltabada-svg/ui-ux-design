import { GOTEAM_ENTITY_ADDRESS } from '~/data/templates'
import type { RetrievalForm } from '~/data/retrievalForms'
import { escapeText as esc } from '~/utils/escapeHtml'

/**
 * The repeating per-page letterhead (logo + address left, ref+mode stamp
 * right in the header; doc name + "Internal Use Only" in the footer) from
 * the GoTeam reference mockup - shared between the builder's own edit canvas
 * and the standalone `/form-preview` link so both render the exact same
 * markup through `tiptap-pagination-plus`'s header/footer widgets (real,
 * repeating per physically paginated page - not once around the whole
 * document, which is what the earlier Umo-based approach was stuck with).
 */
export function buildFormLetterhead(form: Pick<RetrievalForm, 'name' | 'themeColor' | 'category'>, mode: 'onsite' | 'remote') {
  // Just the "goteam" mark, not the app's own "goteam | Assets Mngt" lockup
  // (that's this internal admin tool's own chrome, see AmsSidebar.vue - it
  // has no business appearing on an official printed/emailed document). No
  // accent-color divider line under the address either - just the mark and
  // the address, nothing else.
  const headerLeft = `
    <img src="/img/logo-goteam-only.svg" alt="GoTeam Logo" width="82" height="24" style="height:24px;width:82px;display:block;margin-bottom:4px">
    <div style="font-size:10.5px;color:#4B5563">${esc(GOTEAM_ENTITY_ADDRESS)}</div>
  `.trim()

  // No header-right stamp (used to be an auto-generated initials+mode code,
  // e.g. "ERA · Equipment Return") - removed: the form's own name already
  // appears in the footer (see footerLeft below), so a second name-derived
  // label at the top of every page was redundant.
  const headerRight = ''

  const footerLeft = `<span style="font-size:9.5px;color:#6B7280">${esc(form.name)} &middot; Internal Use Only</span>`

  return { headerLeft, headerRight, footerLeft }
}
