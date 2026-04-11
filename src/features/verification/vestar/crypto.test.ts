import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { getAddress, toHex } from 'viem'
import { vestarStatusTestnetChain } from '../../../contracts/vestar/chain'
import { encryptBallotWithPublicKey, randomNonceHex } from '../../../utils/privateBallot'
import { decryptCanonicalBallotPayload } from './crypto'

describe('decryptCanonicalBallotPayload', () => {
  it('accepts decrypted payloads even when the expected addresses are lowercased', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    })

    const electionId =
      '0x1111111111111111111111111111111111111111111111111111111111111111' as const
    const checksummedElectionAddress = getAddress('0x88297833b1b316272d182541337f87d7dab25f01')
    const checksummedVoterAddress = getAddress('0xafEdA9845D663bCdC295d98E798CB024f5B76ca1')
    const encryptedBallot = await encryptBallotWithPublicKey({
      publicKeyPem: publicKey.toString(),
      payload: {
        schemaVersion: 1,
        electionId,
        chainId: vestarStatusTestnetChain.id,
        electionAddress: checksummedElectionAddress,
        voterAddress: checksummedVoterAddress,
        candidateKeys: ['candidate-a'],
        nonce: randomNonceHex(),
      },
    })

    const decrypted = await decryptCanonicalBallotPayload(
      electionId,
      checksummedElectionAddress.toLowerCase() as `0x${string}`,
      checksummedVoterAddress.toLowerCase() as `0x${string}`,
      encryptedBallot,
      toHex(privateKey.toString()),
    )

    expect(decrypted).not.toBeNull()
    expect(decrypted?.candidateKeys).toEqual(['candidate-a'])
    expect(decrypted?.electionAddress).toBe(checksummedElectionAddress)
    expect(decrypted?.voterAddress).toBe(checksummedVoterAddress)
  })
})
