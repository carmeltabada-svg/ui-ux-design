import { defineFormKitConfig } from '@formkit/vue'
import { createAutoAnimatePlugin } from '@formkit/addons'

// createAutoAnimatePlugin is the only @formkit/addons plugin wired in by
// default - it just animates inputs being added/removed/reordered (e.g. in a
// FormKit `list`/`repeater`) and doesn't change any input's markup or
// behavior. @formkit/addons also ships createFloatingLabelsPlugin and
// createMultiStepPlugin - both actively reshape input markup/layout, so pull
// those in explicitly (and register them here) only when a form actually
// wants that look.
export default defineFormKitConfig({
  plugins: [
    createAutoAnimatePlugin()
  ]
})
