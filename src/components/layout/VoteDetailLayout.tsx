import { createContext, useState } from 'react'
import { Outlet } from 'react-router'
import { useScrollDirection } from '../../hooks/useScrollDirection'
import type { ScrollState } from '../../hooks/useScrollDirection'
import { Header } from './Header'
import { ProfilePanel } from './ProfilePanel'
import { SearchOverlay } from './SearchOverlay'

export const VoteDetailHeaderContext = createContext<{
  scrollState: ScrollState
}>({ scrollState: 'default' })

export function VoteDetailLayout() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { scrollState, onScroll } = useScrollDirection()

  return (
    <VoteDetailHeaderContext value={{ scrollState }}>
      <div className="relative mx-auto h-screen w-full max-w-[430px] overflow-hidden bg-[#1C1D22] shadow-[0_0_60px_rgba(0,0,0,0.12)]">
        {/* Hero-coloured fill: always covers the header zone so the area stays
            dark when the header slides up or transitions to the floating pill. */}
        <div
          data-testid="hero-bg-strip"
          className="fixed left-1/2 -translate-x-1/2 top-0 w-full max-w-[430px] h-[var(--header-h)] bg-[#1C1D22] z-[99] pointer-events-none"
        />
        <Header
          scrollState={scrollState}
          onOpenPanel={() => setPanelOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <main
          className="h-screen overflow-y-auto pt-[var(--header-h)] pb-[calc(7rem+var(--safe-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={onScroll}
        >
          <Outlet />
        </main>

        <ProfilePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
        <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </VoteDetailHeaderContext>
  )
}
