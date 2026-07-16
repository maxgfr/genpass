// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { AppShell, type AppTab } from './AppShell'

function Harness() {
  const [tab, setTab] = useState<AppTab>('generator')
  return (
    <AppShell tab={tab} onTabChange={setTab}>
      <p>content: {tab}</p>
    </AppShell>
  )
}

describe('AppShell', () => {
  it('switches panels on tab click with correct aria wiring', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText('content: generator')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Vault' }))
    expect(screen.getByText('content: vault')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Vault' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Generator' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('tab-vault')
  })

  it('shows the trust footer with the GitHub link on every tab', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    for (const name of ['Vault', 'Share & QR', 'Settings']) {
      await user.click(screen.getByRole('tab', { name }))
      expect(screen.getByText(/100% offline · open source/i)).toBeTruthy()
      const link = screen.getByRole('link', { name: /verify the code on github/i })
      expect(link.getAttribute('href')).toBe('https://github.com/maxgfr/genpass')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link.getAttribute('target')).toBe('_blank')
    }
  })

  it('supports arrow-key navigation with wrap-around and roving focus', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('tab', { name: 'Generator' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('content: vault')).toBeTruthy()
    expect(document.activeElement?.id).toBe('tab-vault')
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('content: generator')).toBeTruthy()
    await user.keyboard('{ArrowLeft}') // wraps to the last tab
    expect(screen.getByText('content: settings')).toBeTruthy()
    expect(document.activeElement?.id).toBe('tab-settings')
  })
})
