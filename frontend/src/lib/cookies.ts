// Cookie utility functions
const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'

export const cookies = {
  set: (name: string, value: string, days: number = 7) => {
    if (value == null || value === '' || value === 'undefined') {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      return
    }
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
    const encoded = encodeURIComponent(value)
    const secure = isHttps ? ';secure' : ''
    document.cookie = `${name}=${encoded};expires=${expires};path=/;samesite=strict${secure}`
  },

  get: (name: string): string | null => {
    const nameEQ = name + "="
    const ca = document.cookie.split(';')
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) === ' ') c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) === 0) {
        const raw = c.substring(nameEQ.length, c.length)
        try { return decodeURIComponent(raw) } catch { return raw }
      }
    }
    return null
  },

  remove: (name: string) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  },

  // Set multiple cookies at once
  setMultiple: (cookieData: Record<string, string>, days: number = 7) => {
    Object.entries(cookieData).forEach(([name, value]) => {
      cookies.set(name, value, days)
    })
  },

  // Remove multiple cookies at once
  removeMultiple: (names: string[]) => {
    names.forEach(name => cookies.remove(name))
  }
}
