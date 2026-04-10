import { useParams } from 'react-router'
import { useVoteResult } from '../../hooks/user/useVoteResult'
import { VoteResultRankings } from '../user/VoteResultRankings'
import { VoteResultWinner } from '../user/VoteResultWinner'

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-[#E7E9ED] border-t-[#7140FF] animate-spin" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-5 mt-10 rounded-3xl border border-[#E7E9ED] bg-white px-6 py-10 text-center">
      <div className="text-[16px] font-semibold text-[#090A0B]">아직 표시할 결과가 없습니다.</div>
      <div className="mt-2 text-[13px] text-[#707070]">
        최종 결과는 finalize 이후에만 볼 수 있습니다.
      </div>
    </div>
  )
}

export function VoteResultPage() {
  const { id = '1' } = useParams()
  const { result, isLoading } = useVoteResult(id)

  if (isLoading) return <LoadingSkeleton />
  if (!result || result.rankedCandidates.length === 0) return <EmptyState />

  const winner = result.rankedCandidates.find((c) => c.rank === 1)
  if (!winner) return <EmptyState />

  return (
    <>
      <VoteResultWinner result={result} winner={winner} mode="finalized" />
      <VoteResultRankings rankedCandidates={result.rankedCandidates} mode="finalized" />
    </>
  )
}
