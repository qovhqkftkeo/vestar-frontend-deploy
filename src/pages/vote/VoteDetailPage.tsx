import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useAccount, useChainId, useConnect, useSwitchChain } from 'wagmi'
import completeVoteIcon from '../../assets/complete_vote.svg'
import reportProblemIcon from '../../assets/report_problem.svg'
import { VoteDetailHeaderContext } from '../../components/layout/VoteDetailLayout'
import { BottomSheet } from '../../components/shared/BottomSheet'
import { vestarStatusTestnetChain } from '../../contracts/vestar/chain'
import { VESTAR_ELECTION_STATE } from '../../contracts/vestar/types'
import { useCandidateSelection } from '../../hooks/user/useCandidateSelection'
import { useSectionVoteSelection } from '../../hooks/user/useSectionVoteSelection'
import { useVoteDetail } from '../../hooks/user/useVoteDetail'
import { useVoteSubmit } from '../../hooks/user/useVoteSubmit'
import { useVotedVotes } from '../../hooks/useVotedVotes'
import { useToast } from '../../providers/ToastProvider'
import { useLanguage } from '../../providers/LanguageProvider'
import { CandidateSection, GroupedCandidateSection } from '../user/CandidateSection'
import { VoteBottomSheetContent } from '../user/VoteBottomSheetContent'
import { VoteHero } from '../user/VoteHero'
import { VoteInfoSection } from '../user/VoteInfoSection'
import type { Candidate, VoteDetailData } from '../../types/vote'

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-[#E7E9ED] border-t-[#7140FF] animate-spin" />
    </div>
  )
}

function collectVoteCandidates(vote: VoteDetailData): Candidate[] {
  return vote.sections?.flatMap((section) => section.candidates) ?? vote.candidates
}

function resolveSelectedCandidateKeys(vote: VoteDetailData, candidateIds: string[]) {
  const candidateKeyMap = new Map(
    collectVoteCandidates(vote).map((candidate) => [
      candidate.id,
      candidate.candidateKey ?? candidate.name,
    ]),
  )

  // sungje : 화면 선택 id를 컨트랙트 submitOpenVote/private payload의 candidateKey preimage로 역매핑
  return candidateIds
    .map((candidateId) => candidateKeyMap.get(candidateId))
    .filter((candidateKey): candidateKey is string => Boolean(candidateKey))
}

// ── Centered danger confirmation modal ──────────────────────────────────────
interface DangerConfirmModalProps {
  open: boolean
  target: string
  onConfirm: () => void
  onCancel: () => void
}

function DangerConfirmModal({ open, target, onConfirm, onCancel }: DangerConfirmModalProps) {
  const { t } = useLanguage()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center px-5">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t('btn_cancel')}
        onClick={onCancel}
        className="absolute inset-0 bg-[rgba(9,10,11,0.65)]"
      />

      {/* Card */}
      <div className="relative z-[501] w-full max-w-[340px] bg-white rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.30)] animate-[slideUp_0.22s_ease-out]">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FEF5E7] flex items-center justify-center">
            <img
              src={reportProblemIcon}
              alt=""
              aria-hidden="true"
              className="w-8 h-8"
              style={{
                filter:
                  'brightness(0) saturate(100%) invert(55%) sepia(90%) saturate(600%) hue-rotate(5deg) brightness(100%) contrast(95%)',
              }}
            />
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-[18px] font-bold text-[#090A0B] text-center mb-2 leading-snug">
          {t('dm_title')}
        </h2>

        {/* Target */}
        <p className="text-[14px] text-[#090A0B] text-center mb-3 font-semibold">{target}</p>

        {/* Warning */}
        <div className="bg-[#FEF5E7] border border-[#FDE68A] rounded-2xl px-4 py-3 mb-5">
          <p className="text-[12px] text-[#92400E] text-center leading-snug">
            {t('dm_irreversible')}
          </p>
        </div>

        {/* Vote fee */}
        <div className="flex justify-between items-center bg-[#F7F8FA] rounded-xl px-4 py-3 mb-5 text-[13px]">
          <span className="text-[#707070]">{t('dm_vote_fee')}</span>
          <span className="font-bold text-[#090A0B]">₩100</span>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl bg-[#F7F8FA] text-[14px] font-semibold text-[#707070] hover:bg-[#E7E9ED] transition-colors active:scale-[0.99]"
          >
            {t('btn_cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl bg-[#7140FF] text-white text-[14px] font-bold hover:opacity-85 transition-opacity active:scale-[0.99]"
          >
            {t('btn_vote_now')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export function VoteDetailPage() {
  const { id = '1' } = useParams()
  const {
    vote,
    isLoading,
    voterSnapshot,
    voteAccessReason,
    voterKarmaTier,
    isVoteAccessLoading,
    refreshVoteAccess,
  } = useVoteDetail(id)

  const isGrouped = (vote?.sections?.length ?? 0) > 0

  const { isSelected, toggle, canSubmit, selectedIds, reset: resetCandidateSelection } =
    useCandidateSelection(vote?.maxChoices ?? 1)
  const sectionSelection = useSectionVoteSelection(vote?.sections ?? [])

  const { markVoted, getVotedCandidates } = useVotedVotes()
  const { state, txHash, karmaEarned, submit, reset } = useVoteSubmit()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dangerModalOpen, setDangerModalOpen] = useState(false)
  const [lastSubmittedCandidateIds, setLastSubmittedCandidateIds] = useState<string[]>(() =>
    getVotedCandidates(id),
  )
  const handledSuccessTxRef = useRef<string | null>(null)

  const { setConfig, scrollState } = useContext(VoteDetailHeaderContext)
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { isConnected } = useAccount()
  const { connect, connectors, isPending: isConnectPending } = useConnect()
  const { addToast } = useToast()
  const { t, lang } = useLanguage()

  // sungje : 종료/예정/진행중을 badge 문자열이 아니라 컨트랙트 state + 종료 시각으로 같이 판정
  const isWrongNetwork = isConnected && !!vote?.electionAddress && chainId !== vestarStatusTestnetChain.id
  const isTimeClosed = vote ? new Date(vote.endDateISO).getTime() <= Date.now() : false
  const isVoteActive = vote
    ? vote.electionState !== undefined
      ? vote.electionState === VESTAR_ELECTION_STATE.ACTIVE
      : vote.badge === 'live' && !isTimeClosed
    : false
  const isVoteEnded = vote
    ? vote.electionState !== undefined
      ? vote.electionState >= VESTAR_ELECTION_STATE.CLOSED
      : vote.badge === 'end' || isTimeClosed
    : false
  const isVoteScheduled = vote
    ? vote.electionState !== undefined
      ? vote.electionState === VESTAR_ELECTION_STATE.SCHEDULED
      : vote.badge === 'new' && !isTimeClosed
    : false
  const hasOnchainElection = Boolean(vote?.electionAddress)
  const isVoteAccessPending =
    isConnected && hasOnchainElection && isVoteActive && isVoteAccessLoading && !voterSnapshot
  const isVoteAccessBlocked =
    isConnected &&
    hasOnchainElection &&
    !isVoteAccessLoading &&
    voterSnapshot !== null &&
    !voterSnapshot.canSubmitBallot
  const showStoredVoteSelections = isVoteAccessBlocked && lastSubmittedCandidateIds.length > 0
  const selectedCandidateIds = useMemo(
    () =>
      isGrouped
        ? sectionSelection.selectedSections.map((section) => section.candidateId)
        : Array.from(selectedIds),
    [isGrouped, sectionSelection.selectedSections, selectedIds],
  )
  const displayedCandidateIds = showStoredVoteSelections
    ? lastSubmittedCandidateIds
    : selectedCandidateIds
  const displayedCandidateIdSet = useMemo(
    () => new Set(displayedCandidateIds),
    [displayedCandidateIds],
  )
  const displayedCandidates = useMemo(
    () =>
      vote ? collectVoteCandidates(vote).filter((candidate) => displayedCandidateIdSet.has(candidate.id)) : [],
    [vote, displayedCandidateIdSet],
  )
  const displayedCandidateCount = displayedCandidates.length

  const effectiveIsSelected = useCallback(
    (candidateId: string) =>
      showStoredVoteSelections
        ? displayedCandidateIdSet.has(candidateId)
        : isSelected(candidateId),
    [showStoredVoteSelections, displayedCandidateIdSet, isSelected],
  )
  const effectiveSectionIsSelected = useCallback(
    (sectionId: string, candidateId: string) =>
      showStoredVoteSelections
        ? displayedCandidateIdSet.has(candidateId)
        : sectionSelection.isSelected(sectionId, candidateId),
    [showStoredVoteSelections, displayedCandidateIdSet, sectionSelection],
  )

  const selectedCandidate = displayedCandidates[0] ?? null
  const activeCanSubmit = isGrouped ? sectionSelection.canSubmit : canSubmit
  const isSelectionDisabled = !isVoteActive || isVoteAccessBlocked
  const minKarmaTier = vote?.minKarmaTier ?? 0
  const voteBlockedLabel = isVoteScheduled
    ? lang === 'ko'
      ? '아직 투표 시작 전이에요'
      : 'Voting has not started yet'
    : voteAccessReason === 'karma' && minKarmaTier > 0
      ? lang === 'ko'
        ? `Karma ${minKarmaTier} 이상이 필요해요${voterKarmaTier !== null ? ` · 현재 ${voterKarmaTier}` : ''}`
        : `Karma tier ${minKarmaTier}+ required${voterKarmaTier !== null ? ` · current ${voterKarmaTier}` : ''}`
      : vote?.ballotPolicy === 'ONE_PER_INTERVAL'
        ? lang === 'ko'
          ? '이번 회차의 투표권을 이미 사용했어요'
          : 'You already used this round’s ballot'
        : lang === 'ko'
          ? '이미 이 투표의 투표권을 사용했어요'
          : 'You already used your ballot for this vote'

  useEffect(() => {
    setLastSubmittedCandidateIds(getVotedCandidates(id))
    handledSuccessTxRef.current = null
  }, [id, getVotedCandidates])

  useEffect(() => {
    if (!vote) return
    setConfig({
      title: vote.title,
      onShare: () => {
        if (navigator.share) {
          navigator.share({ title: vote.title, url: window.location.href }).catch(() => {})
        }
      },
    })
  }, [vote, setConfig])

  useEffect(() => {
    if (state !== 'success' || !vote || !txHash || handledSuccessTxRef.current === txHash) return

    handledSuccessTxRef.current = txHash
    markVoted(vote.id, selectedCandidateIds)
    setLastSubmittedCandidateIds(selectedCandidateIds)

    if (isGrouped || displayedCandidateCount > 1) {
      addToast({
        type: 'success',
        message:
          lang === 'ko'
            ? `${displayedCandidateCount}명 선택 투표 완료! ⚡`
            : `${displayedCandidateCount} selections submitted! ⚡`,
      })
    } else {
      addToast({
        type: 'success',
        message:
          lang === 'ko'
            ? `"${selectedCandidate?.name}" 투표 완료! ⚡`
            : `Voted for "${selectedCandidate?.name}"! ⚡`,
      })
    }

    resetCandidateSelection()
    sectionSelection.reset()
    refreshVoteAccess().catch(() => {})
  }, [
    state,
    vote,
    txHash,
    isGrouped,
    displayedCandidateCount,
    selectedCandidateIds,
    selectedCandidate,
    markVoted,
    resetCandidateSelection,
    sectionSelection,
    refreshVoteAccess,
    addToast,
    lang,
  ])

  const handleConnectWallet = useCallback(() => {
    const injectedConnector =
      connectors.find((connector) => connector.id === 'injected') ?? connectors[0]
    if (injectedConnector) {
      connect({ connector: injectedConnector })
    }
  }, [connect, connectors])

  // Open danger modal when user taps the vote button
  const handleVoteClick = useCallback(() => {
    if (!isConnected) {
      handleConnectWallet()
      return
    }

    if (
      !vote ||
      !hasOnchainElection ||
      !isVoteActive ||
      isVoteAccessPending ||
      isVoteAccessBlocked ||
      !activeCanSubmit
    ) {
      return
    }

    setDangerModalOpen(true)
  }, [
    isConnected,
    handleConnectWallet,
    vote,
    hasOnchainElection,
    isVoteActive,
    isVoteAccessPending,
    isVoteAccessBlocked,
    activeCanSubmit,
  ])

  // Called when user confirms in the danger modal
  const handleDangerConfirm = useCallback(() => {
    if (!vote) return

    const candidateKeys = resolveSelectedCandidateKeys(vote, selectedCandidateIds)
    if (!candidateKeys.length || candidateKeys.length !== selectedCandidateIds.length) {
      addToast({
        type: 'error',
        message: lang === 'ko' ? '후보 정보를 다시 불러와주세요.' : 'Please refresh candidate data.',
      })
      return
    }

    setDangerModalOpen(false)
    setSheetOpen(true)
    // sungje : confirm 이후에는 UI id 배열이 아니라 컨트랙트/PRIVATE payload용 candidateKey 배열로 제출
    submit({ vote, candidateKeys }).catch((error) => {
      setSheetOpen(false)
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : t('vd_ballot_unavailable'),
      })
    })
  }, [vote, selectedCandidateIds, submit, addToast, lang, t])

  const handleClose = useCallback(() => {
    if (state === 'loading') return
    setSheetOpen(false)
    if (state === 'success') reset()
  }, [state, reset])

  if (isLoading || !vote) return <LoadingSkeleton />

  // ── Action bar label ──────────────────────────────────────────────────────
  const submitLabel = !isConnected
    ? isConnectPending
      ? lang === 'ko'
        ? '지갑 연결 중…'
        : 'Connecting wallet…'
      : t('vd_connect_wallet')
    : !hasOnchainElection
      ? t('vd_onchain_pending')
      : isVoteAccessPending
        ? t('vd_checking_eligibility')
        : showStoredVoteSelections
          ? displayedCandidateCount > 1
            ? `✓ ${displayedCandidateCount} ${lang === 'ko' ? '명 선택 제출 완료' : 'choices submitted'}`
            : `✓ ${lang === 'ko' ? `"${selectedCandidate?.name ?? ''}" 투표 완료` : `Voted for "${selectedCandidate?.name ?? ''}"`}`
          : isVoteEnded
            ? t('vd_voting_ended')
            : !isVoteActive || isVoteAccessBlocked
              ? voteBlockedLabel
              : isGrouped
                ? activeCanSubmit
                  ? `${sectionSelection.selectedCount} ${lang === 'ko' ? `섹션 선택됨 · ₩${sectionSelection.selectedCount * 100}` : `sections selected · ₩${sectionSelection.selectedCount * 100}`}`
                  : t('vd_select_section')
                : activeCanSubmit
                  ? displayedCandidateCount > 1
                    ? `${displayedCandidateCount} ${lang === 'ko' ? '명 선택하고 투표하기' : 'choices ready to vote'}`
                    : `${lang === 'ko' ? `"${selectedCandidate?.name}" 투표` : `Vote for "${selectedCandidate?.name}"`}`
                  : t('vd_select_candidate')

  // Danger modal target label
  const dangerTarget = isGrouped
    ? `${sectionSelection.selectedCount} ${lang === 'ko' ? '섹션' : `section${sectionSelection.selectedCount !== 1 ? 's' : ''}`}`
    : displayedCandidateCount > 1
      ? `${displayedCandidateCount} ${lang === 'ko' ? '명의 후보' : 'candidates'}`
      : selectedCandidate
      ? `"${selectedCandidate.name}"`
      : lang === 'ko'
        ? '선택된 후보'
        : 'selected candidate'

  return (
    <>
      <VoteHero vote={vote} />

      <div className="bg-[#FFFFFF]">
        <VoteInfoSection vote={vote} />

        <div className="h-2 bg-[#F7F8FA] my-3" />

        {isGrouped ? (
          <GroupedCandidateSection
            sections={vote.sections!}
            resultPublic={vote.resultPublic}
            isSelected={effectiveSectionIsSelected}
            onToggle={isSelectionDisabled ? () => {} : sectionSelection.toggle}
            isEnded={isSelectionDisabled}
            votedCandidateIds={showStoredVoteSelections ? displayedCandidateIdSet : undefined}
          />
        ) : (
          <CandidateSection
            candidates={vote.candidates}
            maxChoices={vote.maxChoices}
            resultPublic={vote.resultPublic}
            isSelected={effectiveIsSelected}
            onToggle={isSelectionDisabled ? () => {} : toggle}
            isEnded={isSelectionDisabled}
            votedCandidateIds={showStoredVoteSelections ? displayedCandidateIdSet : undefined}
          />
        )}
      </div>

      {/* Vote action bar */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[90] px-5 pt-4 pb-6 bg-[#F7F8FA] border-t border-[#E7E9ED] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          scrollState === 'hidden' ? 'translate-y-full bottom-0' : 'translate-y-0 bottom-0'
        }`}
      >
        {isWrongNetwork ? (
          <button
            type="button"
            onClick={() => switchChainAsync({ chainId: vestarStatusTestnetChain.id })}
            className="w-full bg-[#FEF5E7] border border-[#FDE68A] text-[#92400E] rounded-2xl py-4 text-[14px] font-bold hover:bg-[#FDE68A] transition-colors"
          >
            {t('vd_switch_network')}
          </button>
        ) : !isConnected ? (
          <button
            type="button"
            onClick={handleConnectWallet}
            disabled={isConnectPending}
            className="w-full bg-[#7140FF] text-white rounded-2xl py-4 text-[15px] font-bold disabled:bg-[#E7E9ED] disabled:text-[#707070] disabled:cursor-default hover:enabled:opacity-85 transition-opacity active:enabled:scale-[0.99]"
          >
            {submitLabel}
          </button>
        ) : showStoredVoteSelections ? (
          <div className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] text-[14px] font-semibold text-[#16a34a]">
            <img
              src={completeVoteIcon}
              alt=""
              aria-hidden="true"
              className="w-5 h-5"
              style={{
                filter:
                  'brightness(0) saturate(100%) invert(33%) sepia(98%) saturate(400%) hue-rotate(93deg) brightness(95%) contrast(97%)',
              }}
            />
            {submitLabel}
          </div>
        ) : isVoteEnded ? (
          <div className="w-full py-4 rounded-2xl bg-[#F7F8FA] border border-[#E7E9ED] text-[14px] font-semibold text-[#707070] text-center cursor-default flex items-center justify-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            {t('vd_voting_ended')}
          </div>
        ) : !hasOnchainElection || !isVoteActive || isVoteAccessPending || isVoteAccessBlocked ? (
          <div className="w-full py-4 rounded-2xl bg-[#F7F8FA] border border-[#E7E9ED] text-[14px] font-semibold text-[#707070] text-center cursor-default">
            {submitLabel}
          </div>
        ) : (
          <button
            type="button"
            disabled={!activeCanSubmit}
            onClick={handleVoteClick}
            className="w-full bg-[#7140FF] text-white rounded-2xl py-4 text-[15px] font-bold disabled:bg-[#E7E9ED] disabled:text-[#707070] disabled:cursor-default hover:enabled:opacity-85 transition-opacity active:enabled:scale-[0.99]"
          >
            {submitLabel}
          </button>
        )}
      </div>

      {/* Centered danger confirmation modal */}
      <DangerConfirmModal
        open={dangerModalOpen}
        target={dangerTarget}
        onConfirm={handleDangerConfirm}
        onCancel={() => setDangerModalOpen(false)}
      />

      <BottomSheet open={sheetOpen} onClose={handleClose} title={t('bs_title')}>
        <VoteBottomSheetContent
          state={state}
          txHash={txHash}
          karmaEarned={karmaEarned}
          onClose={handleClose}
        />
      </BottomSheet>
    </>
  )
}
