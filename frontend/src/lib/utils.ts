import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const normalizeHex = (addr: string): string => {
  if (!addr) return ''
  // Remove 0x prefix, normalize to lowercase, then add 0x back
  const cleanAddr = addr.toLowerCase().replace(/^0x/, '')
  return '0x' + cleanAddr
}