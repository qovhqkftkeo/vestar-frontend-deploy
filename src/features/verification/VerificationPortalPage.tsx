import { startTransition, useEffect, useMemo, useState } from 'react'
import { ProofItem } from './components/cards/ProofItem'
import { ResultCard } from './components/cards/ResultCard'
import { ValueCard } from './components/cards/ValueCard'
import { OpenReceiptCard } from './components/receipts/OpenReceiptCard'
import { PrivateReceiptCard } from './components/receipts/PrivateReceiptCard'
import { HeroMetric, StatCard } from './components/ui/MetricCard'
import { PortalButton } from './components/ui/PortalButton'
import { PortalPanel } from './components/ui/PortalPanel'
import { PortalPill } from './components/ui/PortalPill'
import { cn } from './components/ui/cn'
import { KEY_REVEALED_STATE } from './vestar/constants'
import { withKoreanParticle } from './vestar/korean'
import {
  getVerificationElectionDetail,
  readCachedVerificationElectionDetail,
  readCachedVerificationElectionSummaries,
  syncVerificationElectionSummaries,
} from './vestar'
import type { VerificationElectionDetail, VerificationElectionSummary } from './vestar'

type ViewTab = 'finished' | 'current'
type PortalTab = 'receipts' | 'results' | 'proof'

type SelectedStats = {
  validVotes: number
  totalSubmissions: number
  invalidVotes: number
  winner: VerificationElectionDetail['candidates'][0] | VerificationElectionSummary['topCandidate'] | null
  receiptMatch: boolean
  completionRate: number
}

const TAB_ITEMS: Array<{ id: PortalTab; label: string }> = [
  { id: 'receipts', label: '투표 기록' },
  { id: 'results', label: '투표 결과' },
  { id: 'proof', label: '검증 근거' },
]

const VIEW_ITEMS: Array<{ id: ViewTab; label: string }> = [
  { id: 'finished', label: '종료된 투표만 보기' },
  { id: 'current', label: '현재 진행중인 투표' },
]

function hasRevealedPrivateKey(
  election: Pick<VerificationElectionSummary, 'mode' | 'state' | 'revealedPrivateKey'>,
) {
  return (
    election.mode === 'PRIVATE' &&
    election.state >= KEY_REVEALED_STATE &&
    election.revealedPrivateKey !== null
  )
}

function getPrivateKeyStatusLabel(
  election: Pick<VerificationElectionSummary, 'mode' | 'state' | 'revealedPrivateKey'>,
) {
  return hasRevealedPrivateKey(election) ? '키 공개 완료' : '개인키 미공개'
}

function App() {
  const initialCache = readCachedVerificationElectionSummaries()
  const [elections, setElections] = useState<VerificationElectionSummary[]>(initialCache.elections)
  const [viewTab, setViewTab] = useState<ViewTab>('current')
  const [selectedId, setSelectedId] = useState<string | null>(initialCache.elections[0]?.id ?? null)
  const [tab, setTab] = useState<PortalTab>('receipts')
  const [selectedElectionDetail, setSelectedElectionDetail] = useState<VerificationElectionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(initialCache.elections.length === 0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(initialCache.lastSyncedAt)

  useEffect(() => {
    let ignore = false

    async function load() {
      try {
        if (elections.length === 0) {
          setIsLoading(true)
        } else {
          setIsRefreshing(true)
        }
        setError(null)

        const { elections: next, lastSyncedAt: syncedAt } = await syncVerificationElectionSummaries()
        if (ignore) return

        setElections(next)
        setSelectedId((current) => {
          if (!current) return next[0]?.id ?? null
          return next.some((entry) => entry.id === current) ? current : (next[0]?.id ?? null)
        })
        setLastSyncedAt(syncedAt)
      } catch (loadError) {
        if (ignore) return
        setError(loadError instanceof Error ? loadError.message : '검증 목록을 불러오지 못했어요.')
      } finally {
        if (!ignore) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    }

    void load()

    return () => {
      ignore = true
    }
  }, [refreshKey])

  const visibleElections = useMemo(
    () =>
      viewTab === 'finished'
        ? elections.filter((election) => election.isFinalized)
        : elections.filter((election) => !election.isFinalized && election.state !== 6),
    [elections, viewTab],
  )

  const selectedElection =
    visibleElections.find((election) => election.id === selectedId) ?? visibleElections[0] ?? null

  useEffect(() => {
    let ignore = false

    async function loadDetail() {
      if (!selectedElection) {
        setSelectedElectionDetail(null)
        setDetailError(null)
        return
      }

      const cached = readCachedVerificationElectionDetail(selectedElection.address)
      if (cached && cached.id === selectedElection.id) {
        setSelectedElectionDetail(cached)
      } else {
        setSelectedElectionDetail(null)
      }

      const shouldForceRefresh =
        !cached ||
        cached.id !== selectedElection.id ||
        cached.receiptCount !== selectedElection.receiptCount ||
        cached.state !== selectedElection.state ||
        cached.finalizeTransactionHash !== selectedElection.finalizeTransactionHash ||
        cached.resultManifestURI !== selectedElection.resultManifestURI ||
        cached.resultManifestHash !== selectedElection.resultManifestHash ||
        cached.publicKey !== selectedElection.publicKey ||
        cached.revealedPrivateKey !== selectedElection.revealedPrivateKey ||
        cached.keySchemeVersion !== selectedElection.keySchemeVersion

      if (!shouldForceRefresh) {
        setDetailError(null)
        return
      }

      try {
        setIsDetailLoading(true)
        setDetailError(null)

        const detail = await getVerificationElectionDetail(selectedElection, { force: true })
        if (ignore) return

        setSelectedElectionDetail(detail)
        setElections((current) =>
          current.map((entry) =>
            entry.id === detail.id
              ? {
                  ...entry,
                  topCandidate: detail.candidates[0] ?? entry.topCandidate,
                  totalSubmissions: detail.totalSubmissions,
                  receiptCount: detail.receipts.length,
                  validVotes: detail.validVotes,
                  canDecrypt: detail.canDecrypt,
                }
              : entry,
          ),
        )
      } catch (loadError) {
        if (ignore) return
        setDetailError(loadError instanceof Error ? loadError.message : '상세 기록을 불러오지 못했어요.')
      } finally {
        if (!ignore) {
          setIsDetailLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      ignore = true
    }
  }, [selectedElection])

  const totalVotes = useMemo(
    () => visibleElections.reduce((sum, election) => sum + election.validVotes, 0),
    [visibleElections],
  )

  const totalReceipts = useMemo(
    () => visibleElections.reduce((sum, election) => sum + election.receiptCount, 0),
    [visibleElections],
  )

  const selectedStats = useMemo(() => {
    if (!selectedElection) return null

    const detailMatchesSelection =
      selectedElectionDetail?.id === selectedElection.id ? selectedElectionDetail : null
    const receiptCount = detailMatchesSelection?.receipts.length ?? selectedElection.receiptCount
    const totalSubmissions = selectedElection.isFinalized
      ? selectedElection.totalSubmissions
      : Math.max(selectedElection.totalSubmissions, receiptCount)
    const validVotes = selectedElection.isFinalized
      ? selectedElection.validVotes
      : Math.max(selectedElection.validVotes, receiptCount)
    const invalidVotes = selectedElection.isFinalized ? selectedElection.invalidVotes : 0
    const winner = detailMatchesSelection?.candidates[0] ?? selectedElection.topCandidate ?? null
    const receiptMatch = selectedElection.isFinalized ? receiptCount === totalSubmissions : true

    return {
      validVotes,
      totalSubmissions,
      invalidVotes,
      winner,
      receiptMatch,
      completionRate: totalSubmissions > 0 ? (validVotes / totalSubmissions) * 100 : 0,
    } satisfies SelectedStats
  }, [selectedElection, selectedElectionDetail])

  const syncedLabel = useMemo(() => {
    if (!lastSyncedAt) return null

    return new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(lastSyncedAt)
  }, [lastSyncedAt])

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-[#F7F8FA] shadow-[0_0_60px_rgba(0,0,0,0.12)]">
      <div className="relative overflow-hidden bg-[#13141A] px-5 pb-6 pt-6">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7140FF] to-transparent" />

        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-base font-medium tracking-[1.5px] text-white uppercase">
            VEST<span className="text-[#7140FF]">A</span>r
          </span>
          <PortalButton
            variant="header"
            disabled={isLoading || isRefreshing}
            onClick={() => setRefreshKey((current) => current + 1)}
          >
            {isLoading || isRefreshing ? '불러오는 중' : '새로고침'}
          </PortalButton>
        </div>

        <div className="mt-5 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#7140FF] font-mono">
          Verification Portal
        </div>
        <div className="mt-1 text-[24px] font-semibold leading-tight text-white">
          투표 결과에 조작이 없는지 검증해요
        </div>

        <PortalPanel tone="dark" className="mt-5 rounded-[28px] bg-white/[0.06] p-4 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[1px] text-[#A996FF]">
                현재 기준
              </div>
              <div className="mt-1 text-[15px] font-semibold text-white">
                {viewTab === 'finished' ? '종료된 투표' : '현재 진행중인 투표'}
              </div>
            </div>
            <PortalPill tone="dark" size="md">
              {visibleElections.length}건 확인 가능
            </PortalPill>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <HeroMetric
              label={viewTab === 'finished' ? '종료된 투표' : '진행 중인 투표'}
              value={`${visibleElections.length}건`}
            />
            <HeroMetric
              label={viewTab === 'finished' ? '확인 가능한 표' : '현재 제출된 표'}
              value={`${totalVotes.toLocaleString()}표`}
            />
            <HeroMetric label="투표 기록" value={`${totalReceipts.toLocaleString()}건`} />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-white/55">
            <span>투표 기록에서 결과까지 같은 흐름으로 다시 읽고 있어요</span>
            <span className="shrink-0 font-mono">{syncedLabel ? `${syncedLabel} 기준` : '준비 중'}</span>
          </div>
        </PortalPanel>
      </div>

      <main className="px-4 pb-10 pt-4">
        <section className="mb-4">
          <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-[#E7E9ED] bg-white p-2 shadow-[0_12px_30px_rgba(9,10,11,0.04)]">
            {VIEW_ITEMS.map((item) => {
              const isSelected = viewTab === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setViewTab(item.id)
                    setSelectedId(null)
                  }}
                  className={cn(
                    'rounded-[18px] px-3 py-3 text-[14px] font-semibold transition-colors',
                    isSelected
                      ? 'bg-[#13141A] text-white'
                      : 'bg-[#F7F8FA] text-[#707070]',
                  )}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </section>

        {isLoading ? (
          <LoadingView />
        ) : error ? (
          <ErrorView message={error} />
        ) : visibleElections.length === 0 ? (
          <EmptyView viewTab={viewTab} />
        ) : selectedElection && selectedStats ? (
          <>
            <section className="rounded-[28px] border border-[#E7E9ED] bg-white p-5 shadow-[0_12px_30px_rgba(9,10,11,0.04)] [animation:softRise_0.45s_ease-out]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono uppercase tracking-[1px] text-[#7140FF]">
                    지금 보고 있는 투표
                  </div>
                  <h1 className="mt-1 text-[22px] font-semibold leading-[1.3] text-[#090A0B]">
                    {selectedElection.title}
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PortalPill size="sm">{selectedElection.hostName}</PortalPill>
                    <PortalPill size="sm">{selectedElection.hostBadge}</PortalPill>
                    <PortalPill size="sm">{selectedElection.modeLabel}</PortalPill>
                    <PortalPill size="sm">{selectedElection.endedAtLabel}</PortalPill>
                  </div>
                </div>
                <PortalPill tone={selectedElection.isFinalized ? 'success' : 'accent'}>
                  {selectedElection.isFinalized ? '검증 완료' : selectedElection.stateLabel}
                </PortalPill>
              </div>

              {selectedElection.mode === 'OPEN' ? (
                <PortalPanel tone="dark" className="mt-4 rounded-[24px] px-4 py-4">
                  <div className="text-[11px] font-mono uppercase tracking-[1px] text-[#A996FF]">
                    가장 많은 표를 받은 후보
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.10] text-[22px]">
                      {selectedStats.winner?.emoji ?? '🗳️'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[18px] font-semibold leading-[1.3]">
                        {selectedStats.winner?.name ?? '집계 정보 없음'}
                      </div>
                      <div className="mt-1 text-[13px] text-white/60">
                        {selectedStats.winner
                          ? `${selectedStats.winner.votes.toLocaleString()}표 · ${selectedStats.winner.percentage.toFixed(1)}%`
                          : '표 수를 확인할 수 없어요'}
                      </div>
                    </div>
                  </div>
                </PortalPanel>
              ) : (
                <PortalPanel tone="dark" className="mt-4 rounded-[24px] px-4 py-4">
                  <div className="text-[11px] font-mono uppercase tracking-[1px] text-[#A996FF]">
                    비공개 투표 검증
                  </div>
                  <div className="mt-2 text-[18px] font-semibold leading-[1.35]">
                    {hasRevealedPrivateKey(selectedElection)
                      ? '공개된 키로 암호문을 다시 풀어볼 수 있어요'
                      : '개인키 공개 전이라 투표 기록만 먼저 확인할 수 있어요'}
                  </div>
                  <div className="mt-2 text-[13px] leading-[1.6] text-white/60">
                    {hasRevealedPrivateKey(selectedElection)
                      ? '제출된 암호문과 공개된 키를 함께 보면, 각 표가 누구에게 향했는지 뒤에서 다시 확인할 수 있어요.'
                      : '컨트랙트 기준으로 아직 개인키 공개 단계 전이라서, 결과 재현과 개별 복호화는 잠겨 있어요.'}
                  </div>
                </PortalPanel>
              )}

              <div className="mt-4 grid grid-cols-3 gap-3">
                <StatCard label="유효 표" value={`${selectedStats.validVotes.toLocaleString()}표`} />
                <StatCard label="투표 기록" value={`${selectedElection.receiptCount}건`} />
                <StatCard label="무효 처리" value={`${selectedStats.invalidVotes}건`} />
              </div>

              <PortalPanel tone="muted" className="mt-4 rounded-[22px] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-[#090A0B]">
                      {selectedStats.receiptMatch
                        ? '투표 수와 최종 집계 수가 자연스럽게 이어져요'
                        : '투표 수와 최종 집계 수를 한 번 더 확인해볼 필요가 있어요'}
                    </div>
                    <div className="mt-1 text-[13px] leading-[1.6] text-[#707070]">
                      총 {selectedStats.totalSubmissions.toLocaleString()}건이 제출됐고, 그중{' '}
                      {selectedStats.validVotes.toLocaleString()}건이 최종 집계에 반영됐어요.
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-mono uppercase tracking-[1px] text-[#7140FF]">
                      반영률
                    </div>
                    <div className="mt-1 text-[18px] font-semibold text-[#090A0B]">
                      {selectedStats.completionRate.toFixed(0)}%
                    </div>
                  </div>
                </div>
              </PortalPanel>

              {selectedElection.mode === 'PRIVATE' ? (
                <div className="mt-3">
                  <PortalPill size="sm">비공개 투표는 복호화 해보세요!</PortalPill>
                </div>
              ) : null}

              <div className="mt-4">
                <PortalButton href={selectedElection.addressExplorerUrl} size="sm">
                  블록체인에서 보기
                </PortalButton>
              </div>
            </section>

            <section className="mt-5">
              <SectionTitle
                eyebrow="검증 대상"
                title={viewTab === 'finished' ? '끝난 투표를 골라 확인해보세요!' : '현재 체인 투표를 둘러보세요!'}
              />
              {isDetailLoading && selectedElectionDetail?.id === selectedElection?.id ? (
                <div className="mt-2 text-[12px] text-[#707070]">
                  선택한 투표의 최신 기록을 뒤에서 다시 맞추고 있어요
                </div>
              ) : null}
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleElections.map((election) => {
                  const winner = election.topCandidate
                  const isSelected = selectedElection.id === election.id

                  return (
                    <button
                      key={`${election.address}-${election.id}`}
                      type="button"
                      onClick={() =>
                        startTransition(() => {
                          setSelectedId(election.id)
                          setTab('receipts')
                        })
                      }
                      className={cn(
                        'w-[292px] shrink-0 rounded-[24px] border p-4 text-left transition',
                        isSelected
                          ? 'border-[#13141A] bg-[#13141A] text-white shadow-[0_16px_40px_rgba(17,20,30,0.20)]'
                          : 'border-[#E7E9ED] bg-white text-[#090A0B]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <PortalPill
                            tone={isSelected ? 'dark' : 'accent'}
                            size="sm"
                          >
                            {election.modeLabel}
                          </PortalPill>
                          <div className="mt-1 text-[16px] font-semibold leading-[1.35]">
                            {election.title}
                          </div>
                        </div>
                        <PortalPill tone={isSelected ? 'dark' : 'accent'} size="sm">
                          {election.isFinalized ? election.hostBadge : election.stateLabel}
                        </PortalPill>
                      </div>

                      <p
                        className={cn(
                          'mt-3 text-[13px] leading-[1.6]',
                          isSelected ? 'text-white/65' : 'text-[#707070]',
                        )}
                      >
                        {election.description}
                      </p>

                      <PortalPanel
                        tone={isSelected ? 'dark' : 'muted'}
                        className={cn(
                          'mt-4 rounded-[20px] px-3 py-3',
                          isSelected && 'bg-white/[0.06] text-white',
                        )}
                      >
                        {election.mode === 'OPEN' ? (
                          <>
                            <div
                              className={cn(
                                'text-[11px] font-mono uppercase tracking-[1px]',
                                isSelected ? 'text-white/45' : 'text-[#707070]',
                              )}
                            >
                              최다 득표
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3">
                              {winner ? (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[18px]">{winner.emoji}</span>
                                    <span className="text-[14px] font-semibold">
                                      {winner.name}
                                    </span>
                                  </div>
                                  <span className="font-mono text-[12px]">
                                    {winner.votes.toLocaleString()}표
                                  </span>
                                </>
                              ) : (
                                <div className="text-[13px] font-medium">
                                  {election.receiptCount.toLocaleString()}건 제출
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className={cn(
                                'text-[11px] font-mono uppercase tracking-[1px]',
                                isSelected ? 'text-white/45' : 'text-[#707070]',
                              )}
                            >
                              복호화 준비 상태
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3">
                              <div className="text-[14px] font-semibold">
                                {getPrivateKeyStatusLabel(election)}
                              </div>
                              <span className="font-mono text-[12px]">
                                {election.receiptCount}건 제출
                              </span>
                            </div>
                          </>
                        )}
                      </PortalPanel>

                      <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
                        <span className={isSelected ? 'text-white/55' : 'text-[#707070]'}>
                          {election.hostName}
                        </span>
                        <span className="shrink-0 font-mono">{election.endedAtLabel}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="mt-5 overflow-hidden rounded-[28px] border border-[#E7E9ED] bg-white shadow-[0_12px_30px_rgba(9,10,11,0.04)]">
              <div className="flex border-b border-[#E7E9ED] bg-white">
                {TAB_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                      'flex-1 border-b-2 py-3 text-[14px] font-semibold transition-colors',
                      tab === item.id
                        ? 'border-[#7140FF] text-[#7140FF]'
                        : 'border-transparent text-[#707070]',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div key={`${selectedElection.id}-${tab}`} className="bg-[#F7F8FA] p-4">
                {detailError ? (
                  <DetailErrorView message={detailError} />
                ) : !selectedElectionDetail || selectedElectionDetail.id !== selectedElection.id ? (
                  <DetailLoadingView />
                ) : tab === 'results' ? (
                  <ResultsTab election={selectedElectionDetail} stats={selectedStats} />
                ) : tab === 'receipts' ? (
                  <ReceiptsTab election={selectedElectionDetail} stats={selectedStats} />
                ) : (
                  <ProofTab election={selectedElectionDetail} stats={selectedStats} />
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}

function ResultsTab({
  election,
  stats,
}: {
  election: VerificationElectionDetail
  stats: SelectedStats
}) {
  const privateKeyRevealed = hasRevealedPrivateKey(election)
  const canDecryptResults = election.canDecrypt
  const [showPublicKey, setShowPublicKey] = useState(false)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [showDecryptedResults, setShowDecryptedResults] = useState(election.mode === 'OPEN')

  useEffect(() => {
    setShowPublicKey(false)
    setShowPrivateKey(false)
    setShowDecryptedResults(election.mode === 'OPEN')
  }, [election.id, election.mode])

  useEffect(() => {
    if (!privateKeyRevealed) {
      setShowPrivateKey(false)
    }
  }, [privateKeyRevealed])

  useEffect(() => {
    if (election.mode === 'PRIVATE' && !canDecryptResults) {
      setShowDecryptedResults(false)
    }
  }, [canDecryptResults, election.mode])

  if (election.mode === 'OPEN') {
    return (
      <div className="flex flex-col gap-4 [animation:softRise_0.35s_ease-out]">
        <PortalPanel>
          <div className="text-[11px] font-mono uppercase tracking-[1px] text-[#7140FF]">
            결과 한눈에 보기
          </div>
          <div className="mt-2 text-[18px] font-semibold leading-[1.35] text-[#090A0B]">
            {withKoreanParticle(stats.winner?.name ?? '집계 결과 없음', '이/가')} 가장 많은 표를 받고 있어요
          </div>
          <div className="mt-2 text-[13px] leading-[1.65] text-[#707070]">
            {election.isFinalized
              ? '투표 기록에서 본 표들이 마지막에 어떻게 합쳐졌는지 이 탭에서 이어서 볼 수 있어요.'
              : '공개 투표는 진행 중에도 현재까지 제출된 표 흐름을 그대로 볼 수 있어요.'}
          </div>
        </PortalPanel>

        <div className="flex flex-col gap-3">
          {election.candidates.map((candidate, index) => (
            <ResultCard
              key={candidate.key}
              rank={index + 1}
              name={candidate.name}
              emoji={candidate.emoji}
              subtitle={candidate.subtitle}
              votes={candidate.votes}
              percentage={candidate.percentage}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 [animation:softRise_0.35s_ease-out]">
      <PortalPanel>
        <div className="text-[11px] font-mono uppercase tracking-[1px] text-[#7140FF]">
          {privateKeyRevealed ? '비공개 투표 결과 열어보기' : '비공개 투표 준비 상태'}
        </div>
        <div className="mt-2 text-[18px] font-semibold leading-[1.35] text-[#090A0B]">
          {privateKeyRevealed
            ? '공개된 키와 암호문을 함께 보면 최종 결과를 직접 다시 만들 수 있어요'
            : '개인키가 공개되기 전에는 투표 수와 암호문만 확인할 수 있어요'}
        </div>
        <div className="mt-2 text-[13px] leading-[1.65] text-[#707070]">
          {privateKeyRevealed
            ? '먼저 공개키와 공개된 개인키를 확인한 뒤, 아래 버튼으로 암호문을 다시 풀어보면 후보별 표 수가 어떻게 나왔는지 바로 이어서 볼 수 있어요.'
            : '컨트랙트에서 개인키 공개 단계에 들어가기 전까지는, 비공개 투표 결과를 다시 만들거나 개별 표를 복호화할 수 없어요.'}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniStep step="1" label="공개키 보기" />
          <MiniStep step="2" label={privateKeyRevealed ? '개인키 보기' : '개인키 미공개'} />
          <MiniStep step="3" label={canDecryptResults ? '결과 다시 만들기' : '복호화 대기'} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <PortalButton fullWidth size="sm" onClick={() => setShowPublicKey((current) => !current)}>
            {showPublicKey ? '공개키 접기' : '공개키 보기'}
          </PortalButton>
          <PortalButton
            fullWidth
            size="sm"
            disabled={!privateKeyRevealed}
            onClick={() => {
              if (!privateKeyRevealed) return
              setShowPrivateKey((current) => !current)
            }}
          >
            {showPrivateKey ? '개인키 접기' : privateKeyRevealed ? '공개된 개인키 보기' : '개인키 미공개'}
          </PortalButton>
          <div className="col-span-2">
            <PortalButton
              fullWidth
              size="sm"
              disabled={!canDecryptResults}
              onClick={() => {
                if (!canDecryptResults) return
                setShowDecryptedResults((current) => !current)
              }}
            >
              {showDecryptedResults ? '결과 접기' : canDecryptResults ? '암호문 풀어 결과 보기' : '복호화 대기'}
            </PortalButton>
          </div>
        </div>
      </PortalPanel>

      {showPublicKey && election.publicKey ? (
        <ValueCard label="암호화에 사용된 공개키" value={election.publicKey} />
      ) : null}

      {showPrivateKey && election.revealedPrivateKey ? (
        <ValueCard label="검증을 위해 공개된 개인키" value={election.revealedPrivateKey} />
      ) : null}

      {showDecryptedResults ? (
        election.candidates.length > 0 ? (
          <div className="flex flex-col gap-3">
            {election.candidates.map((candidate, index) => (
              <ResultCard
                key={candidate.key}
                rank={index + 1}
                name={candidate.name}
                emoji={candidate.emoji}
                subtitle={candidate.subtitle}
                votes={candidate.votes}
                percentage={candidate.percentage}
              />
            ))}
          </div>
        ) : (
          <PortalPanel>
            <div className="text-[15px] font-semibold text-[#090A0B]">복호화 결과를 아직 만들 수 없어요</div>
            <div className="mt-2 text-[13px] leading-[1.65] text-[#707070]">
              이 비공개 투표는 공개된 키가 아직 없거나, 현재 포털이 자동으로 다시 풀 수 있는 형식이 아니에요.
            </div>
          </PortalPanel>
        )
      ) : (
        <PortalPanel>
          <div className="text-[15px] font-semibold text-[#090A0B]">복호화 결과는 아직 접어뒀어요</div>
          <div className="mt-2 text-[13px] leading-[1.65] text-[#707070]">
            {canDecryptResults
              ? '비공개 투표는 암호문을 풀어본 뒤에야 후보별 표 수를 눈으로 확인할 수 있어요. 위 버튼을 누르면 공개된 키 기준으로 다시 만든 결과를 볼 수 있습니다.'
              : '개인키가 아직 공개되지 않아 복호화 결과를 열 수 없어요. 공개 단계에 들어가면 위 버튼이 자동으로 활성화됩니다.'}
          </div>
        </PortalPanel>
      )}
    </div>
  )
}

function ReceiptsTab({
  election,
  stats,
}: {
  election: VerificationElectionDetail
  stats: SelectedStats
}) {
  const [showTransactionAnalogy, setShowTransactionAnalogy] = useState(false)

  useEffect(() => {
    setShowTransactionAnalogy(false)
  }, [election.id])

  return (
    <div className="flex flex-col gap-4 [animation:softRise_0.35s_ease-out]">
      <PortalPanel>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-mono uppercase tracking-[1px] text-[#7140FF]">
              투표 기록 요약
            </div>
            <div className="mt-2 text-[18px] font-semibold leading-[1.35] text-[#090A0B]">
              {election.receipts.length}건의 투표 기록이 남아 있어요
            </div>
            <div className="mt-2 text-[13px] leading-[1.65] text-[#707070]">
              {election.mode === 'OPEN'
                ? '공개 투표는 각 주소 아래에서 어떤 후보를 골랐는지 바로 확인할 수 있어요.'
                : election.canDecrypt
                  ? '비공개 투표는 체인에 남은 암호문을 먼저 보고, 원하면 그 표를 하나씩 다시 풀어볼 수 있어요.'
                  : '비공개 투표는 지금은 암호문만 확인할 수 있어요. 개인키가 공개되면 각 표도 다시 풀어볼 수 있어요.'}
            </div>
          </div>
          <PortalPill tone="accent">유효 {stats.validVotes.toLocaleString()}표</PortalPill>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowTransactionAnalogy((current) => !current)}
            className="rounded-full border border-[#D8DCEF] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#5C4FE5] transition-colors duration-200 hover:border-[#7140FF] hover:text-[#7140FF]"
          >
            {showTransactionAnalogy ? '설명 접기' : '트랜잭션이 뭐예요?'}
          </button>

              {showTransactionAnalogy ? (
                <PortalPanel tone="muted" className="mt-2 rounded-[18px] px-3 py-3">
                  <div className="text-[12px] leading-[1.7] text-[#707070]">
                    트랜잭션은 블록체인에 기록이 제출됐다는 뜻의 제출증 같은 거예요. 누가 언제 어떤 요청을 올렸는지 한 건씩 남기기 때문에, 나중에 같은 기록을 다시 찾아보거나 진짜 체인에 올라갔는지 확인할 수 있어요.
                    <br />
                    <br />
                    비유하면 투표가 들어올 때마다 모두가 같이 보는 조작 불가능한 메모장에 한 줄씩 적어 두는 느낌이에요. 한 번 적히면 지우거나 바꿀 수 없어서, 나중에 다시 봐도 같은 내용이 그대로 남아 있어요.
                  </div>
                </PortalPanel>
              ) : null}
        </div>
      </PortalPanel>

      <div className="flex flex-col gap-3">
        {election.receipts.map((receipt, index) =>
          election.mode === 'OPEN' ? (
            <OpenReceiptCard key={receipt.id} order={index + 1} receipt={receipt} />
          ) : (
            <PrivateReceiptCard
              key={receipt.id}
              order={index + 1}
              receipt={receipt}
              canDecrypt={election.canDecrypt}
            />
          ),
        )}
      </div>
    </div>
  )
}

function ProofTab({
  election,
  stats,
}: {
  election: VerificationElectionDetail
  stats: SelectedStats
}) {
  const privateKeyRevealed = hasRevealedPrivateKey(election)
  const [showKeyAnalogy, setShowKeyAnalogy] = useState(false)
  const [showHashAnalogy, setShowHashAnalogy] = useState(false)

  useEffect(() => {
    setShowKeyAnalogy(false)
    setShowHashAnalogy(false)
  }, [election.id])

  const finalizationProof = (() => {
    if (election.isFinalized) {
      return {
        title: '투표가 끝난 뒤 결과가 확정됐어요',
        description: `${election.endedAtLabel} 이후 이 투표는 최종 결과가 고정된 상태예요.`,
        tone: 'success' as const,
      }
    }

    if (election.state === 1) {
      return {
        title: '투표가 끝난 뒤 결과가 확정될 거예요',
        description: `${election.endedAtLabel} 이후 결과 확정 단계로 넘어갈 수 있어요. 지금은 아직 진행 중이에요.`,
        tone: 'warning' as const,
      }
    }

    if (election.state === 0) {
      return {
        title: '투표가 시작된 뒤 투표 기록이 쌓일 거예요',
        description: `${election.endedAtLabel} 전에 투표가 시작되면, 그때부터 제출된 기록과 결과 흐름을 확인할 수 있어요.`,
        tone: 'warning' as const,
      }
    }

    return {
      title: '투표는 끝났고 결과 확정을 기다리고 있어요',
      description:
        election.mode === 'PRIVATE'
          ? '비공개 투표는 키 공개와 결과 확정이 이어져야 최종 결과가 고정돼요.'
          : '공개 투표는 종료 뒤 결과 확정 단계가 한 번 더 남아 있어요.',
      tone: 'warning' as const,
    }
  })()

  return (
    <div className="flex flex-col gap-4 [animation:softRise_0.35s_ease-out]">
      <PortalPanel>
        <div className="text-[11px] font-mono uppercase tracking-[1px] text-[#7140FF]">
          검증 체크리스트
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <ProofItem
            title={finalizationProof.title}
            description={finalizationProof.description}
            tone={finalizationProof.tone}
          />
          <ProofItem
            title="투표 기록 수와 집계 흐름을 다시 볼 수 있어요"
            description={`총 ${stats.totalSubmissions.toLocaleString()}건 제출, ${stats.validVotes.toLocaleString()}건 유효 처리, ${stats.invalidVotes.toLocaleString()}건 무효 처리예요.`}
            tone={stats.receiptMatch ? 'success' : 'warning'}
          />
          <ProofItem
            title={
              election.mode === 'OPEN'
                ? '지갑별 선택과 최종 집계를 바로 연결할 수 있어요'
                : privateKeyRevealed
                  ? '공개된 키로 암호문을 다시 풀어볼 수 있어요'
                  : '개인키 공개 뒤에 암호문을 다시 풀 수 있어요'
            }
            description={
              election.mode === 'OPEN'
                ? '투표 기록에서 각 지갑의 선택을 보고, 결과 카드에서 같은 숫자가 어떻게 집계됐는지 이어서 볼 수 있어요.'
                : privateKeyRevealed
                  ? '비공개 투표는 공개키와 공개된 개인키를 함께 읽어, 결과가 왜 이렇게 나왔는지 다시 확인할 수 있어요.'
                  : '지금은 공개키와 암호문까지만 확인할 수 있어요. 개인키가 공개되면 같은 기록으로 결과를 다시 검증할 수 있어요.'
            }
            tone={election.mode === 'OPEN' || privateKeyRevealed ? 'success' : 'warning'}
          >
            {election.mode === 'PRIVATE' ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowKeyAnalogy((current) => !current)}
                  className="rounded-full border border-[#D8DCEF] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#5C4FE5] transition-colors duration-200 hover:border-[#7140FF] hover:text-[#7140FF]"
                >
                  {showKeyAnalogy ? '설명 접기' : '공개키와 개인키가 뭐예요?'}
                </button>

                {showKeyAnalogy ? (
                  <div className="mt-3 rounded-[16px] border border-[#E7E9ED] bg-white px-3 py-3 text-[12px] leading-[1.7] text-[#707070]">
                    공개키는 누구나 볼 수 있는 자물쇠라고 생각하면 돼요. 투표할 때는 이 자물쇠로 표를 잠가서 블록체인에 올리기 때문에, 중간에 누가 봐도 내용은 바로 읽을 수 없어요.
                    <br />
                    <br />
                    개인키는 그 자물쇠를 열 수 있는 열쇠예요. 투표가 진행되는 동안에는 숨겨 두었다가, 끝난 뒤 공개되면 그때부터 모두가 같은 암호문을 다시 열어 보면서 결과가 맞는지 함께 검산할 수 있어요.
                  </div>
                ) : null}
              </div>
            ) : null}
          </ProofItem>
        </div>
      </PortalPanel>

      <ValueCard label="투표 주소" value={election.address} actionHref={election.addressExplorerUrl} />

      {election.mode === 'PRIVATE' ? (
        <>
          <ValueCard label="암호화에 사용된 공개키" value={election.publicKey ?? '아직 없음'} />
          <div className="flex flex-col gap-2">
            <ValueCard
              label="공개 전부터 약속된 개인키 해시"
              value={election.privateKeyCommitmentHash ?? '아직 없음'}
            />
            <div>
              <button
                type="button"
                onClick={() => setShowHashAnalogy((current) => !current)}
                className="rounded-full border border-[#D8DCEF] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#5C4FE5] transition-colors duration-200 hover:border-[#7140FF] hover:text-[#7140FF]"
              >
                {showHashAnalogy ? '설명 접기' : '해시가 뭐예요?'}
              </button>

              {showHashAnalogy ? (
                <PortalPanel tone="muted" className="mt-2 rounded-[18px] px-3 py-3">
                  <div className="text-[12px] leading-[1.7] text-[#707070]">
                    해시는 원본을 짧은 지문처럼 바꿔 놓은 값이라고 보면 돼요. 실제 개인키를 미리 공개하지 않아도, 나중에 공개된 개인키가 처음에 약속했던 그 키가 맞는지 이 지문으로 대조할 수 있어요.
                    <br />
                    <br />
                    비유하면 편지 봉투를 닫아 두고, 입구에 특수 스티커를 붙여 놓는 느낌이에요. 중간에 누가 열어보면 스티커가 찢어지거나 자국이 남고, 그대로 붙어 있으면 안에 내용이 중간에 바뀌지 않았다고 믿을 수 있어요.
                  </div>
                </PortalPanel>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function MiniStep({ step, label }: { step: string; label: string }) {
  return (
    <PortalPanel tone="muted" className="rounded-[18px] px-3 py-3">
      <div className="text-[10px] font-mono uppercase tracking-[1px] text-[#7140FF]">{step}</div>
      <div className="mt-1 text-[12px] font-semibold leading-[1.4] text-[#090A0B]">{label}</div>
    </PortalPanel>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[#7140FF]">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-[22px] font-semibold leading-[1.28] text-[#090A0B]">{title}</h2>
    </div>
  )
}

function LoadingView() {
  return (
    <PortalPanel className="mt-2 rounded-[28px] p-5">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 shrink-0 rounded-full border-2 border-[#E7E9ED] border-t-[#7140FF] animate-spin" />
        <div>
          <div className="text-[17px] font-semibold text-[#090A0B]">
            체인에서 조작 불가능한 데이터를 가져오고 있어요...
          </div>
        </div>
      </div>
    </PortalPanel>
  )
}

function DetailLoadingView() {
  return (
    <PortalPanel className="rounded-[24px] p-5">
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 shrink-0 rounded-full border-2 border-[#E7E9ED] border-t-[#7140FF] animate-spin" />
        <div>
          <div className="text-[16px] font-semibold text-[#090A0B]">
            선택한 투표의 상세 기록을 불러오고 있어요
          </div>
          <div className="mt-1 text-[13px] leading-[1.6] text-[#707070]">
            
          </div>
        </div>
      </div>
    </PortalPanel>
  )
}

function DetailErrorView({ message }: { message: string }) {
  return (
    <PortalPanel className="rounded-[24px] p-5">
      <div className="text-[16px] font-semibold text-[#090A0B]">상세 기록을 아직 열지 못했어요</div>
      <p className="mt-2 text-[13px] leading-[1.65] text-[#707070]">{message}</p>
    </PortalPanel>
  )
}

function ErrorView({ message }: { message: string }) {
  return (
    <PortalPanel className="rounded-[28px] p-5">
      <div className="text-[18px] font-semibold text-[#090A0B]">검증 화면을 열지 못했어요</div>
      <p className="mt-2 text-[14px] leading-[1.7] text-[#707070]">{message}</p>
    </PortalPanel>
  )
}

function EmptyView({ viewTab }: { viewTab: ViewTab }) {
  return (
    <PortalPanel className="rounded-[28px] p-5">
      <div className="text-[18px] font-semibold text-[#090A0B]">
        {viewTab === 'finished' ? '아직 종료된 투표가 없어요' : '아직 진행 중인 투표가 없어요'}
      </div>
      <p className="mt-2 text-[14px] leading-[1.7] text-[#707070]">
        {viewTab === 'finished'
          ? '투표가 종료되면 투표 기록과 결과 흐름을 이 포털에서 이어서 확인할 수 있어요.'
          : '체인에서 Active 상태가 된 투표만 여기에 보여줘요. 시작 전이거나 이미 종료된 투표는 다른 탭에서 볼 수 있어요.'}
      </p>
    </PortalPanel>
  )
}

export default App
