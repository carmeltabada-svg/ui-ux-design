import { api } from '~/api'
import { createRecordSync } from './recordSync'
import { RETRIEVAL_FORMS, RETRIEVAL_FORM_CONTENT, RETRIEVAL_FORM_SECTIONS, FORM_VERSIONS } from './retrievalForms'
import { TEMPLATE_RUNTIME, TEMPLATE_HISTORY, CUSTOM_TEMPLATE_IDS, DELETED_TEMPLATE_KEYS } from './templateRuntime'

// The editors change these stores in place. These two send what changed to the server, one record at a time.

export const formSync = createRecordSync({
  records: () => new Map(RETRIEVAL_FORMS.map(form => [form.id, {
    ...form,
    content: RETRIEVAL_FORM_CONTENT[form.id] ?? '',
    sections: RETRIEVAL_FORM_SECTIONS[form.id] ?? [],
    versions: FORM_VERSIONS[form.id] ?? []
  }])),
  sources: [RETRIEVAL_FORMS, RETRIEVAL_FORM_CONTENT, RETRIEVAL_FORM_SECTIONS, FORM_VERSIONS],
  save: (_id, record) => api().retrievalForms.save(record),
  remove: id => api().retrievalForms.remove(id)
})

export const templateSync = createRecordSync({
  records: () => new Map(Object.keys(TEMPLATE_RUNTIME)
    .filter(key => !DELETED_TEMPLATE_KEYS.has(key))
    .map(key => [key, { key, runtime: TEMPLATE_RUNTIME[key]!, history: TEMPLATE_HISTORY[key] ?? [] }])),
  sources: [TEMPLATE_RUNTIME, TEMPLATE_HISTORY, CUSTOM_TEMPLATE_IDS, DELETED_TEMPLATE_KEYS],
  save: (_id, record) => api().emailTemplates.save(record),
  remove: key => api().emailTemplates.remove(key)
})
