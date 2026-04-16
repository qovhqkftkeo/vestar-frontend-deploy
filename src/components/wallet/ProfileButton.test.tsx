import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lang } from '../../i18n'
import { ProfileButton } from './ProfileButton'

let mockLang: Lang = 'en'

const mockDisconnect = vi.fn()

vi.mock('../../providers/LanguageProvider', () => ({
  useLanguage: () => ({
    lang: mockLang,
  }),
}))

vi.mock('wagmi', () => ({
  useDisconnect: () => ({
    disconnect: mockDisconnect,
  }),
}))

vi.mock('../../hooks/useWalletRole', () => ({
  useWalletRole: () => ({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    role: 'host',
  }),
}))

describe('ProfileButton', () => {
  beforeEach(() => {
    mockLang = 'en'
    mockDisconnect.mockReset()
  })

  it('renders the profile dropdown copy in English', () => {
    render(<ProfileButton />)

    fireEvent.click(screen.getByAltText('Profile').closest('button')!)

    expect(screen.getByText('Connected as')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('renders the profile dropdown copy in Korean', () => {
    mockLang = 'ko'

    render(<ProfileButton />)

    fireEvent.click(screen.getByAltText('프로필').closest('button')!)

    expect(screen.getByText('연결 지갑')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '연결 해제' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument()
  })
})
