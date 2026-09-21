// `pagedjs` ships no TypeScript types at all (confirmed: its package.json has
// no "types"/"typings" field) - a minimal ambient shim for the one surface
// this app actually calls (see ~/pages/form-preview.vue's printForm()),
// rather than leaving every `import('pagedjs')` as an untyped `any` module
// error under `nuxt typecheck`/`vue-tsc`.
declare module 'pagedjs' {
  export class Previewer {
    preview(
      content: string,
      stylesheets: Array<{ _: string } | string>,
      renderTo?: HTMLElement
    ): Promise<{ total: number, pages: unknown[] }>
  }
}
