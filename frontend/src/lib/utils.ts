import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const normalizeHex = (addr: string): string => {
  if (!addr) return ''
  let clean = addr.toLowerCase().replace(/^0x/, '').replace(/[^0-9a-f]/g, '')
  if (clean.length > 64) clean = clean.slice(-64)
  if (clean.length < 64) clean = clean.padStart(64, '0')
  return '0x' + clean
}