import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MyPage } from './MyPage'

const {
  languageState,
  translations,
  mockNavigateBack,
  mockUseMyVotes,
  mockUseMyKarma,
} = vi.hoisted(() => ({
  languageState: { lang: 'en' as 'en' | 'ko' },
  translations: {
    en: {
      btn_back: 'Back',
      filter_all: 'All',
      mp_filter_active: 'Active',
      mp_filter_ended: 'Ended',
      mp_tab_votes: 'Vote History',
      mp_tab_karma: 'Karma History',
      common_loading: 'Loading...',
      mp_no_votes: 'No votes yet',
      mp_no_karma: 'No Karma earned yet',
      mp_total_karma_stat: 'Total Karma',
      mp_voted_label: 'Voted:',
      pp_not_connected: 'Not connected',
    },
    ko: {
      btn_back: '뒤로',
      filter_all: '전체',
      mp_filter_active: '진행중',
      mp_filter_ended: '종료된 투표',
      mp_tab_votes: '투표 내역',
      mp_tab_karma: '카르마 내역',
      common_loading: '불러오는 중...',
      mp_no_votes: '아직 참여한 투표가 없어요',
      mp_no_karma: '아직 획득한 Karma가 없어요',
      mp_total_karma_stat: '총 보유 Karma',
      mp_voted_label: '선택:',
      pp_not_connected: '지갑을 연결해주세요',
    },
  },
  mockNavigateBack: vi.fn(),
  mockUseMyVotes: vi.fn(),
  mockUseMyKarma: vi.fn(),
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x2207000000000000000000000000000000003738',
    isConnected: true,
  }),
}))

vi.mock('../../hooks/user/useMyVotes', () => ({
  useMyVotes: () => mockUseMyVotes(),
}))

vi.mock('../../hooks/user/useMyKarma', () => ({
  useMyKarma: () => mockUseMyKarma(),
}))

vi.mock('../../hooks/useSmartBackNavigation', () => ({
  useSmartBackNavigation: () => mockNavigateBack,
}))

vi.mock('../../providers/LanguageProvider', () => ({
  useLanguage: () => ({
    lang: languageState.lang,
    t: (key: string) =>
      translations[languageState.lang][key as keyof (typeof translations)['en']] ?? key,
  }),
}))

describe('MyPage', () => {
  beforeEach(() => {
    languageState.lang = 'en'
    mockNavigateBack.mockReset()
    mockUseMyVotes.mockReset()
    mockUseMyKarma.mockReset()
    mockUseMyVotes.mockReturnValue({
      votes: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      loadMore: vi.fn(),
    })
    mockUseMyKarma.mockReturnValue({
      events: [],
      total: 0,
      tier: { id: 0, label: 'Tier 0' },
    })
  })

  it('renders vote filter chips in English', () => {
    render(
      <MemoryRouter initialEntries={['/mypage?tab=votes']}>
        <MyPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /All 0/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Active 0/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ended 0/ })).toBeInTheDocument()
    expect(screen.getByText('No votes yet')).toBeInTheDocument()
  })

  it('keeps the Korean vote filter chips in Korean', () => {
    languageState.lang = 'ko'

    render(
      <MemoryRouter initialEntries={['/mypage?tab=votes']}>
        <MyPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /진행중 0/ }))

    expect(screen.getByRole('button', { name: /전체 0/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /진행중 0/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /종료된 투표 0/ })).toBeInTheDocument()
  })
})
