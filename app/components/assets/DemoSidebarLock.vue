<script setup lang="ts">
// Demo only: greys out and blocks every sidebar entry except the ones this demo is about, so a visitor cannot wander
// into screens that belong to other parts of the system. It works on the rendered sidebar and edits no shared component.
// Delete this file and its tag in SimulatorBar.vue to get the whole sidebar back.
const ALLOWED = ['Assets', 'Move Asset']
const MARK = 'demo-locked'
let observer: MutationObserver | undefined

function apply() {
  document.querySelectorAll<HTMLElement>('aside nav a, aside nav button').forEach((el) => {
    // The entry's name is the truncating span; the first span in it is only the icon.
    const label = (el.querySelector('span.truncate')?.textContent ?? '').trim()
    const locked = !ALLOWED.includes(label)
    el.classList.toggle(MARK, locked)
    if (locked) {
      el.setAttribute('aria-disabled', 'true')
      el.setAttribute('tabindex', '-1')
      el.setAttribute('title', 'Not part of this demo')
    } else {
      el.removeAttribute('aria-disabled')
      el.removeAttribute('tabindex')
      el.removeAttribute('title')
    }
  })
}

function block(e: Event) {
  const t = e.target as Element | null
  if (t?.closest(`.${MARK}`)) { e.preventDefault(); e.stopPropagation() }
}

onMounted(() => {
  apply()
  // The sidebar is drawn again when the layout changes; keep the lock on the new entries.
  observer = new MutationObserver(() => apply())
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('click', block, true)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('click', block, true)
})
</script>

<template>
  <span hidden />
</template>

<style>
aside nav .demo-locked { opacity: 0.45; cursor: not-allowed; }
aside nav .demo-locked:hover { background: transparent !important; color: inherit !important; }
</style>
