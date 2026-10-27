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
    // The selected option in every select and dropdown is blue, with a blue check (the label and
    // the leading icon turn blue through the item's own checked state).
    // Every scrollable menu, select and drawer body fades its edges, but only
    // while it actually overflows (see plugins/fadeScroll.client.ts).
    select: { slots: { viewport: 'fade-scroll-y', placeholder: 'truncate text-placeholder', itemLabel: 'truncate group-data-[state=checked]:text-primary group-data-[state=checked]:font-medium', itemLeadingIcon: 'group-data-[state=checked]:text-primary', itemTrailingIcon: 'shrink-0 text-primary' } },
    selectMenu: { slots: { viewport: 'fade-scroll-y', placeholder: 'truncate text-placeholder', itemLabel: 'truncate group-data-[state=checked]:text-primary group-data-[state=checked]:font-medium', itemLeadingIcon: 'group-data-[state=checked]:text-primary', itemTrailingIcon: 'shrink-0 text-primary' } },
    inputMenu: { slots: { viewport: 'fade-scroll-y', itemLabel: 'truncate group-data-[state=checked]:text-primary group-data-[state=checked]:font-medium', itemLeadingIcon: 'group-data-[state=checked]:text-primary', itemTrailingIcon: 'shrink-0 text-primary' } },
    dropdownMenu: { slots: { viewport: 'fade-scroll-y', itemLabel: 'truncate group-data-[state=checked]:text-primary group-data-[state=checked]:font-medium', itemLeadingIcon: 'group-data-[state=checked]:text-primary', itemTrailingIcon: 'shrink-0 group-data-[state=checked]:text-primary' } },
    slideover: { slots: { body: 'fade-scroll-y' } }
  }
})
