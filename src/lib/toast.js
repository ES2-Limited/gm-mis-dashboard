
export function toast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { id: Date.now() + Math.random(), message, type } }))
}
