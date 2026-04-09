import axios from 'axios'
import { keccak256, stringToHex, type Hex } from 'viem'

type PinataFileUploadResponse = {
  IpfsHash: string
}

type VerifyUploadArgs = {
  uri: string
  expectedJsonHash?: Hex
}

export type JsonArtifact<T> = {
  body: T
  file: File
  rawJson: string
  hash: Hex
}

export type PinataUploadArtifact = {
  cid: string
  uri: string
  gatewayUrl: string
}

export type PinataJsonUploadArtifact<T> = PinataUploadArtifact & {
  body: T
  rawJson: string
  hash: Hex
}

// sungje : verification-portal/src/vestar/constants.ts 와 같은 gateway를 기본값으로 고정해서 읽기/쓰기 경로가 엇갈리지 않게 맞춘다.
export const PINATA_GATEWAY_URL = 'https://chocolate-elegant-otter-530.mypinata.cloud'

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const VERIFY_RETRY_COUNT = 8
const VERIFY_RETRY_DELAY_MS = 1_500

function sleep(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

function normalizeGatewayUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, '')
  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  return `https://${trimmed}`
}

function getPinataJwt() {
  const value = __PINATA_JWT__.trim()
  if (!value) {
    throw new Error('PINATA_JWT 설정이 없어서 IPFS 업로드를 진행할 수 없습니다.')
  }

  return value
}

function getConfiguredPinataGateways() {
  const configured = __PINATA_GATEWAYS__.split(',')
    .map(normalizeGatewayUrl)
    .filter(Boolean)

  if (configured.length > 0) {
    return configured
  }

  return [PINATA_GATEWAY_URL]
}

function getGatewayBaseUrl() {
  return getConfiguredPinataGateways()[0]
}

function createBrowserFile(parts: BlobPart[], fileName: string, type: string) {
  return new File(parts, fileName, { type })
}

function buildNoStoreUrl(url: string, attempt: number) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}vestar_verify=${Date.now()}_${attempt}`
}

async function verifyUploadedIpfsArtifact({
  uri,
  expectedJsonHash,
}: VerifyUploadArgs): Promise<string> {
  const gatewayUrl = resolveIpfsUrl(uri)
  let lastError: unknown = null

  for (let attempt = 0; attempt < VERIFY_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch(buildNoStoreUrl(gatewayUrl, attempt), {
        cache: 'no-store',
      })

      if (response.ok) {
        if (expectedJsonHash) {
          const body = await response.text()
          if (keccak256(stringToHex(body)) === expectedJsonHash) {
            return gatewayUrl
          }
        } else {
          const blob = await response.blob()
          if (blob.size > 0) {
            return gatewayUrl
          }
        }
      }
    } catch (error) {
      lastError = error
    }

    await sleep(VERIFY_RETRY_DELAY_MS)
  }

  if (expectedJsonHash) {
    throw new Error('IPFS 메타데이터 업로드 확인에 실패했습니다.')
  }

  throw new Error(
    lastError instanceof Error
      ? `IPFS 이미지 업로드 확인에 실패했습니다. ${lastError.message}`
      : 'IPFS 이미지 업로드 확인에 실패했습니다.',
  )
}

async function uploadFileForm(file: File): Promise<PinataUploadArtifact> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await axios.post<PinataFileUploadResponse>(PINATA_API_URL, formData, {
    headers: {
      Authorization: `Bearer ${getPinataJwt()}`,
    },
  })

  const cid = response.data.IpfsHash

  return {
    cid,
    uri: `ipfs://${cid}`,
    gatewayUrl: `${getGatewayBaseUrl()}/ipfs/${cid}`,
  }
}

export function createJsonArtifact<T>(fileName: string, body: T): JsonArtifact<T> {
  const rawJson = JSON.stringify(body, null, 2)

  return {
    body,
    file: createBrowserFile([rawJson], fileName, 'application/json'),
    rawJson,
    hash: keccak256(stringToHex(rawJson)),
  }
}

export async function uploadJsonArtifactToPinata<T>(
  fileName: string,
  body: T,
): Promise<PinataJsonUploadArtifact<T>> {
  const artifact = createJsonArtifact(fileName, body)
  const uploaded = await uploadFileForm(artifact.file)

  await verifyUploadedIpfsArtifact({
    uri: uploaded.uri,
    expectedJsonHash: artifact.hash,
  })

  return {
    ...artifact,
    ...uploaded,
  }
}

export async function uploadFileToPinata(file: File): Promise<PinataUploadArtifact> {
  const uploaded = await uploadFileForm(file)

  await verifyUploadedIpfsArtifact({
    uri: uploaded.uri,
  })

  return uploaded
}

export function resolveIpfsUrl(uri: string): string {
  if (!uri) return uri
  if (uri.startsWith('ipfs://')) {
    return `${getGatewayBaseUrl()}/ipfs/${uri.replace('ipfs://', '')}`
  }
  return uri
}
