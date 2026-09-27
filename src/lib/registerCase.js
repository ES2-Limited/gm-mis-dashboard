

import { useEffect, useState } from 'react'

let isOpen = false
const listeners = new Set()
const emit = () => listeners.forEach((l) => l(isOpen))

export function openRegisterCase() {
  isOpen = true
  emit()
}
export function closeRegisterCase() {
  isOpen = false
  emit()
}
export function useRegisterCaseOpen() {
  const [open, setOpen] = useState(isOpen)
  useEffect(() => {
    const l = (v) => setOpen(v)
    listeners.add(l)
    return () => listeners.delete(l)
  }, [])
  return open
}
