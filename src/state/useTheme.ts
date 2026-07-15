import { useEffect } from 'react'

export type ThemeSetting = 'light' | 'dark' | 'auto'

/**
 * Stamps data-theme on <html>. 'auto' resolves from the OS preference and
 * follows it live; an explicit choice unsubscribes and always wins.
 */
export function useThemeEffect(theme: ThemeSetting): void {
  useEffect(() => {
    const root = document.documentElement
    if (theme !== 'auto') {
      root.dataset.theme = theme
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      root.dataset.theme = media.matches ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
