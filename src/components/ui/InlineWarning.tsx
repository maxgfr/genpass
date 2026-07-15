import type { ReactNode } from 'react'

export function InlineWarning({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return (
    <p className={danger ? 'inline-warning inline-warning--danger' : 'inline-warning'} role="status">
      {children}
    </p>
  )
}
