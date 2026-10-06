// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@formkit/nuxt'
  ],

  formkit: {
    autoImport: true,
    configFile: './formkit.config.ts'
  },

  devtools: {
    enabled: false
  },

  css: ['~/assets/css/main.css'],

  // the original AMS design has no dark mode — force light to match
  colorMode: {
    preference: 'light',
    fallback: 'light',
    forced: true
  },

  routeRules: {
    '/': { prerender: true },
    // `definePageMeta({ ssr: false })` on this page alone only stops SSR for
    // client-side navigations - a direct/typed request still gets a full
    // server render using the server's own in-memory (seed) form data, since
    // there's no localStorage on the server. That produced real content
    // (e.g. a section's boxed-vs-plain layout) that didn't match what the
    // client immediately re-renders after hydrating from localStorage -  a
    // genuine hydration mismatch, not just a cosmetic one: Vue's patch after
    // hydration left stale attributes (border/width classes, missing
    // colspan) on the DOM node instead of fully replacing it. This
    // `routeRules` entry is what actually disables SSR for the very first
    // request too.
    '/form-preview': { ssr: false }
  },

  compatibilityDate: '2026-06-30',

  // The form document canvas (Tiptap + its extensions) and the background
  // color picker are only ever reached by navigating to a form's edit page,
  // so Vite's dependency-discovery crawl (which walks from the app's own
  // entry points at dev-server startup) never finds them up front - it only
  // discovers them the first time that route is actually visited, which
  // triggers a full extra optimize pass (and a page reload) mid-navigation.
  // That's the multi-second stall on first opening the forms editor in a
  // fresh dev session; every other route stays fast because it doesn't pull
  // in this much. Listing them here pre-bundles them once at server start
  // instead, so the first real navigation to that route doesn't pay for it.
  vite: {
    optimizeDeps: {
      include: [
        '@tiptap/core',
        '@tiptap/vue-3',
        '@tiptap/starter-kit',
        '@tiptap/extension-color',
        '@tiptap/extension-highlight',
        '@tiptap/extension-table',
        '@tiptap/extension-table-cell',
        '@tiptap/extension-table-header',
        '@tiptap/extension-table-row',
        '@tiptap/extension-text-align',
        '@tiptap/extension-text-style',
        '@tiptap/extensions',
        'tiptap-pagination-plus',
        'vue3-colorpicker'
      ]
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
