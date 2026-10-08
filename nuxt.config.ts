// https://nuxt.com/docs/api/configuration/nuxt-config

// Static prototype build for sharing (AMS_STATIC_DEMO=1 nuxt generate): a
// client-only app with relative asset paths and hash routes, so it runs from
// any static folder or sub-path with no server. Off by default; normal dev and
// production builds are unaffected.
const STATIC_DEMO = process.env.AMS_STATIC_DEMO === '1'
const PAGES_BASE = process.env.AMS_PAGES_BASE || '/'

export default defineNuxtConfig({
  ...(STATIC_DEMO
    ? { ssr: false, app: { baseURL: PAGES_BASE }, router: { options: { hashMode: true } } }
    : {}),

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

  // Without an explicit host, the dev server's "localhost" binding landed on
  // this machine's IPv6 loopback only (`::1`, confirmed via `netstat` - no
  // `127.0.0.1` listener existed at all) - real Chrome (not this session's
  // own browser pane, which happened to still reach it) resolves
  // "localhost" to `127.0.0.1` first and got a flat connection refused
  // ("This site can't be reached") with nothing wrong on Chrome's end.
  // `0.0.0.0` binds every interface, IPv4 and IPv6 alike, so `localhost`
  // resolves to a real listener either way.
  devServer: {
    host: '0.0.0.0'
  },

  css: ['~/assets/css/main.css'],

  // the original AMS design has no dark mode — force light to match
  colorMode: {
    preference: 'light',
    fallback: 'light'
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
    '/form-preview': { ssr: false },
    // Same exact hydration-mismatch reasoning as /form-preview above, just
    // for the ticket module: TICKETS only ever really lives in localStorage
    // (no backend), so a server render always shows fresh seed data first,
    // and the client then swaps it out a moment after hydrating - visible
    // live as a real flash of the wrong ticket count/content on every
    // refresh, reproduced and reported against this exact section.
    // Disabling SSR here means the very first paint already waits for the
    // client to read localStorage, so there's nothing wrong to flash.
    '/ticket-tracker': { ssr: false },
    '/ticket-tracker/**': { ssr: false },
    // Same reasoning as /form-preview above - reads a ticket's gate pass
    // straight from the TICKETS store, which only really exists in
    // localStorage.
    '/gate-pass-preview': { ssr: false }
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
