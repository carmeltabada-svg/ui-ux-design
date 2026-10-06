import type { FormBackground } from '~/data/retrievalForms'

/**
 * CSS for the canvas/webpage backdrop behind the form - solid color, gradient,
 * or image. This is the surrounding "wallpaper", not the paper/document
 * itself - the document stays a plain white sheet like a real printed form,
 * so `fallback` should be whatever that surface's own default backdrop is
 * (the beige builder canvas, or the standalone preview page's background).
 */
export function backgroundStyle(bg?: FormBackground, fallback = '#ffffff'): Record<string, string> {
  if (!bg || bg.type === 'solid') return { background: bg?.value ?? fallback }
  if (bg.type === 'gradient') return { backgroundImage: bg.value }
  return { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
}
