export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      secondary: 'green',
      success: 'green',
      info: 'cyan',
      warning: 'orange',
      error: 'red',
      neutral: 'slate'
    },
    // Every scrollable menu, select and drawer body fades its edges, but only
    // while it actually overflows (see plugins/fadeScroll.client.ts).
    select: { slots: { viewport: 'fade-scroll-y' } },
    selectMenu: { slots: { viewport: 'fade-scroll-y' } },
    inputMenu: { slots: { viewport: 'fade-scroll-y' } },
    dropdownMenu: { slots: { viewport: 'fade-scroll-y' } },
    slideover: { slots: { body: 'fade-scroll-y' } }
  }
})
