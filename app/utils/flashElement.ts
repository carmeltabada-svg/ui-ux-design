/**
 * Pulses an element with the `.case-field-flash` ring (main.css): used to show the
 * operator where a jump landed. Restarts the animation if it is already running.
 * The timeout covers the CSS animation (1s x 3 loops plus its 0.3s delay).
 */
const FLASH_MS = 3500
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()

export function flashElement(el: HTMLElement) {
  clearTimeout(timers.get(el))
  el.classList.remove('case-field-flash')
  void el.offsetWidth
  el.classList.add('case-field-flash')
  timers.set(el, setTimeout(() => el.classList.remove('case-field-flash'), FLASH_MS))
}
