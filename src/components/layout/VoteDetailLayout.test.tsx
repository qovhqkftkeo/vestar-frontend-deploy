import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { VoteDetailLayout } from './VoteDetailLayout'

vi.mock('../../hooks/useScrollDirection', () => ({
  useScrollDirection: () => ({ scrollState: 'default', onScroll: vi.fn() }),
}))

vi.mock('./Header', () => ({
  Header: () => <div data-testid="mock-header" />,
}))

vi.mock('./ProfilePanel', () => ({
  ProfilePanel: () => null,
}))

vi.mock('./SearchOverlay', () => ({
  SearchOverlay: () => null,
}))

describe('VoteDetailLayout – hero background filler', () => {
  it('renders a hero-coloured background strip behind the header area', () => {
    const { getByTestId } = render(
      <MemoryRouter>
        <VoteDetailLayout />
      </MemoryRouter>,
    )
    const strip = getByTestId('hero-bg-strip')
    expect(strip).toBeInTheDocument()
    expect(strip.className).toContain('bg-[#1C1D22]')
    expect(strip.className).toContain('h-[var(--header-h)]')
    expect(strip.className).toContain('z-[99]')
  })
})
