import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiVerifiedOrganizer } from '../../api/verifiedOrganizers'
import type { Lang } from '../../i18n'
import { VerifiedAdminPage } from './VerifiedAdminPage'

let mockLang: Lang = 'en'

const mockFetchVerifiedOrganizerRequests = vi.fn<
  (status: ApiVerifiedOrganizer['status']) => Promise<ApiVerifiedOrganizer[]>
>()
const mockApproveVerifiedOrganizer = vi.fn()
const mockRejectVerifiedOrganizer = vi.fn()

vi.mock('../../providers/LanguageProvider', () => ({
  useLanguage: () => ({
    lang: mockLang,
  }),
}))

vi.mock('../../api/verifiedOrganizers', () => ({
  fetchVerifiedOrganizerRequests: (status: ApiVerifiedOrganizer['status']) =>
    mockFetchVerifiedOrganizerRequests(status),
  approveVerifiedOrganizer: (id: string) => mockApproveVerifiedOrganizer(id),
  rejectVerifiedOrganizer: (id: string, reason?: string) =>
    mockRejectVerifiedOrganizer(id, reason),
}))

describe('VerifiedAdminPage', () => {
  beforeEach(() => {
    mockLang = 'en'
    mockFetchVerifiedOrganizerRequests.mockReset()
    mockFetchVerifiedOrganizerRequests.mockResolvedValue([])
    mockApproveVerifiedOrganizer.mockReset()
    mockRejectVerifiedOrganizer.mockReset()
  })

  it('renders English admin review copy when the language is English', async () => {
    render(<VerifiedAdminPage />)

    expect(screen.getByText('Approve verified organizers')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockFetchVerifiedOrganizerRequests).toHaveBeenCalledWith('PENDING')
    })

    expect(screen.getByText('There are no pending requests.')).toBeInTheDocument()
  })

  it('keeps the admin review actions and status labels in Korean', async () => {
    mockLang = 'ko'
    mockFetchVerifiedOrganizerRequests.mockResolvedValue([
      {
        id: 'request-1',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        status: 'PENDING',
        organizationName: 'MAMA 2026',
        contactEmail: null,
        organizationLogoUrl: null,
        rejectionReason: null,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: '2026-04-15T00:00:00.000Z',
        updatedAt: '2026-04-15T00:00:00.000Z',
      },
    ])

    render(<VerifiedAdminPage />)

    expect(await screen.findByText('verified organizer 승인')).toBeInTheDocument()
    expect(screen.getByText('심사 중')).toBeInTheDocument()
    expect(screen.getByText('이메일 미입력')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('반려 사유를 입력할 수 있습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '승인' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '반려' })).toBeInTheDocument()
  })
})
