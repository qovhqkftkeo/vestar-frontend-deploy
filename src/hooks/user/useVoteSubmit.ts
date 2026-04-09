import { useCallback, useState } from 'react'
import { useSwitchChain, useWalletClient } from 'wagmi'
import type { Address, Hash, WalletClient } from 'viem'
import {
  approveErc20Spending,
  getErc20Allowance,
  quoteElectionPayment,
  submitEncryptedVote,
  submitOpenVote,
  waitForVestarTransactionReceipt,
} from '../../contracts/vestar/actions'
import { vestarStatusTestnetChain } from '../../contracts/vestar/chain'
import { encryptPrivateBallot } from '../../contracts/vestar/privateBallot'
import type { VoteDetailData } from '../../types/vote'

export type SubmitState = 'idle' | 'loading' | 'success'

export interface VoteSubmitInput {
  vote: Pick<
    VoteDetailData,
    | 'electionAddress'
    | 'electionId'
    | 'visibilityMode'
    | 'paymentMode'
    | 'paymentToken'
    | 'electionPublicKey'
  >
  candidateKeys: string[]
}

export interface VoteSubmitResult {
  state: SubmitState
  txHash: string | null
  karmaEarned: number
  submit: (input: VoteSubmitInput) => Promise<void>
  reset: () => void
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function normalizeVoteSubmitError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()

  if (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('rejected the request')
  ) {
    return new Error('지갑 요청이 취소됐어요.')
  }

  if (message.includes('wallet not connected')) {
    return new Error('지갑을 연결한 뒤 다시 시도해주세요.')
  }

  if (message.includes('election not active')) {
    return new Error('지금은 투표할 수 없는 상태예요.')
  }

  if (message.includes('ballot unavailable')) {
    return new Error('현재 조건으로는 투표할 수 없어요. 지갑 자격과 남은 투표권을 확인해주세요.')
  }

  if (message.includes('candidate') || message.includes('selection')) {
    return new Error('후보 선택을 다시 확인해주세요.')
  }

  if (message.includes('allowance') || message.includes('insufficient')) {
    return new Error('결제 토큰 승인 상태를 확인한 뒤 다시 시도해주세요.')
  }

  if (message.includes('public key')) {
    return new Error('비공개 투표용 공개키를 아직 불러오지 못했어요.')
  }

  return new Error('투표 제출 중 문제가 생겼어요. 다시 시도해주세요.')
}

async function ensureElectionPaymentApproval(
  walletClient: WalletClient,
  vote: VoteSubmitInput['vote'],
) {
  if (vote.paymentMode !== 'PAID' || !vote.paymentToken || !vote.electionAddress) {
    return
  }

  const owner = walletClient.account?.address as Address | undefined
  if (!owner) {
    throw new Error('Wallet not connected')
  }

  const paymentAmount = await quoteElectionPayment(vote.electionAddress, 1)
  if (paymentAmount === 0n) {
    return
  }

  const currentAllowance = await getErc20Allowance(vote.paymentToken, owner, vote.electionAddress)
  if (currentAllowance >= paymentAmount) {
    return
  }

  // sungje : PAID 선거는 ballot 1개 기준으로 quote 후 allowance 부족분만 approve
  const approveHash = await approveErc20Spending(
    walletClient,
    vote.paymentToken,
    vote.electionAddress,
    paymentAmount,
  )
  await waitForVestarTransactionReceipt(approveHash)
}

export function useVoteSubmit(): VoteSubmitResult {
  const [state, setState] = useState<SubmitState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const karmaEarned = 20 // TODO: query KarmaRegistry delta after tx confirms

  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()

  const submit = useCallback(
    async ({ vote, candidateKeys }: VoteSubmitInput) => {
      setState('loading')

      try {
        if (!vote.electionAddress) {
          throw new Error('On-chain election is not ready')
        }

        if (!walletClient?.account?.address) {
          throw new Error('Wallet not connected')
        }

        if (!candidateKeys.length) {
          throw new Error('No candidate selection provided')
        }

        // sungje : 잘못된 체인에서 바로 revert 나지 않게 제출 전에 테스트넷 전환 선행
        if (!walletClient.chain || walletClient.chain.id !== vestarStatusTestnetChain.id) {
          await switchChainAsync({ chainId: vestarStatusTestnetChain.id })
        }

        await ensureElectionPaymentApproval(walletClient, vote)

        let hash: Hash

        if (vote.visibilityMode === 'PRIVATE') {
          if (!vote.electionId || !vote.electionPublicKey) {
            throw new Error('Private election public key is missing')
          }

          // sungje : PRIVATE 선거는 canonical payload를 프론트에서 암호화한 ciphertext만 컨트랙트에 전달
          const encryptedBallot = await encryptPrivateBallot({
            electionId: vote.electionId,
            electionAddress: vote.electionAddress,
            electionPublicKey: vote.electionPublicKey,
            voterAddress: walletClient.account.address as Address,
            candidateKeys,
          })
          hash = await submitEncryptedVote(walletClient, vote.electionAddress, encryptedBallot)
        } else {
          hash = await submitOpenVote(walletClient, vote.electionAddress, candidateKeys)
        }

        await waitForVestarTransactionReceipt(hash)

        // 백엔드
        // 코드 : 인덱서/영수증 동기화 API가 열리면 tx hash 기준 후처리를 이 지점에 연결

        setTxHash(hash)
        setState('success')
      } catch (error) {
        console.error('[useVoteSubmit] failed:', error)
        setState('idle')
        throw normalizeVoteSubmitError(error)
      }
    },
    [walletClient, switchChainAsync],
  )

  const reset = useCallback(() => {
    setState('idle')
    setTxHash(null)
  }, [])

  return { state, txHash, karmaEarned, submit, reset }
}
