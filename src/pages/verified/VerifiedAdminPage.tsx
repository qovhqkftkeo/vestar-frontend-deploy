import { useEffect, useState } from 'react'
import {
  type ApiVerifiedOrganizer,
  approveVerifiedOrganizer,
  fetchVerifiedOrganizerRequests,
  rejectVerifiedOrganizer,
} from '../../api/verifiedOrganizers'
import type { Lang } from '../../i18n'
import { useLanguage } from '../../providers/LanguageProvider'

const COPY: Record<
  Lang,
  {
    eyebrow: string
    title: string
    description: string
    loadingError: string
    approveSuccess: string
    approveError: string
    rejectSuccess: string
    rejectError: string
    loading: string
    empty: string
    missingEmail: string
    reasonPlaceholder: string
    approve: string
    reject: string
  }
> = {
  en: {
    eyebrow: 'Admin Review',
    title: 'Approve verified organizers',
    description: 'Review pending organizer requests and approve or reject them.',
    loadingError: 'Unable to load the requests.',
    approveSuccess: 'Request approved.',
    approveError: 'Failed to approve the request.',
    rejectSuccess: 'Request rejected.',
    rejectError: 'Failed to reject the request.',
    loading: 'Loading...',
    empty: 'There are no pending requests.',
    missingEmail: 'No email provided',
    reasonPlaceholder: 'Add a rejection reason if needed.',
    approve: 'Approve',
    reject: 'Reject',
  },
  ko: {
    eyebrow: '관리자 검토',
    title: 'verified organizer 승인',
    description: 'pending 상태의 organizer 요청을 확인하고 승인 또는 반려할 수 있습니다.',
    loadingError: '목록을 불러오지 못했습니다.',
    approveSuccess: '승인 처리했습니다.',
    approveError: '승인에 실패했습니다.',
    rejectSuccess: '반려 처리했습니다.',
    rejectError: '반려에 실패했습니다.',
    loading: '불러오는 중...',
    empty: 'pending 요청이 없습니다.',
    missingEmail: '이메일 미입력',
    reasonPlaceholder: '반려 사유를 입력할 수 있습니다.',
    approve: '승인',
    reject: '반려',
  },
}

const STATUS_LABELS: Record<Lang, Record<ApiVerifiedOrganizer['status'], string>> = {
  en: {
    VERIFIED: 'Approved',
    REJECTED: 'Rejected',
    PENDING: 'Pending',
  },
  ko: {
    VERIFIED: '승인됨',
    REJECTED: '반려됨',
    PENDING: '심사 중',
  },
}

function StatusBadge({
  status,
  lang,
}: {
  status: ApiVerifiedOrganizer['status']
  lang: Lang
}) {
  const style =
    status === 'VERIFIED'
      ? 'bg-[#E8FFF0] text-[#16a34a]'
      : status === 'REJECTED'
        ? 'bg-[#FEF2F2] text-[#dc2626]'
        : 'bg-[#F0EDFF] text-[#7140FF]'

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>
      {STATUS_LABELS[lang][status]}
    </span>
  )
}

export function VerifiedAdminPage() {
  const { lang } = useLanguage()
  const [items, setItems] = useState<ApiVerifiedOrganizer[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const copy = COPY[lang]

  const load = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const result = await fetchVerifiedOrganizerRequests('PENDING')
      setItems(result)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.loadingError)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [copy.loadingError])

  const handleApprove = async (id: string) => {
    try {
      await approveVerifiedOrganizer(id)
      setMessage(copy.approveSuccess)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.approveError)
    }
  }

  const handleReject = async (id: string) => {
    try {
      await rejectVerifiedOrganizer(id, reasons[id])
      setMessage(copy.rejectSuccess)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.rejectError)
    }
  }

  return (
    <div className="min-h-full bg-[#F7F8FA] px-5 py-6">
      <div className="rounded-[28px] bg-white p-5 shadow-[0_12px_32px_rgba(17,24,39,0.06)]">
        <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#7140FF]">
          {copy.eyebrow}
        </div>
        <h1 className="mt-2 text-[24px] font-semibold text-[#090A0B]">{copy.title}</h1>
        <p className="mt-2 text-[14px] leading-6 text-[#707070]">{copy.description}</p>

        {message ? <div className="mt-4 text-[13px] text-[#707070]">{message}</div> : null}

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="text-[14px] text-[#707070]">{copy.loading}</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E7E9ED] bg-[#F7F8FA] px-4 py-6 text-[14px] text-[#707070]">
              {copy.empty}
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[#E7E9ED] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold text-[#090A0B]">
                      {item.organizationName}
                    </div>
                    <div className="mt-1 text-[12px] text-[#707070]">
                      {item.contactEmail ?? copy.missingEmail}
                    </div>
                    <div className="mt-1 break-all font-mono text-[12px] text-[#707070]">
                      {item.walletAddress}
                    </div>
                  </div>
                  <StatusBadge status={item.status} lang={lang} />
                </div>
                <textarea
                  value={reasons[item.id] ?? ''}
                  onChange={(event) =>
                    setReasons((prev) => ({ ...prev, [item.id]: event.target.value }))
                  }
                  placeholder={copy.reasonPlaceholder}
                  className="mt-4 h-24 w-full rounded-2xl border border-[#E7E9ED] bg-[#F7F8FA] px-4 py-3 text-[13px] text-[#090A0B] outline-none focus:border-[#7140FF]"
                />

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void handleApprove(item.id)}
                    className="flex-1 rounded-2xl bg-[#16a34a] px-4 py-3 text-[14px] font-bold text-white"
                  >
                    {copy.approve}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReject(item.id)}
                    className="flex-1 rounded-2xl bg-[#090A0B] px-4 py-3 text-[14px] font-bold text-white"
                  >
                    {copy.reject}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
