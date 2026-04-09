import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { vestarStatusTestnetChain } from '../contracts/vestar/chain'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined
const dappOrigin =
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'

if (!projectId) {
  console.warn('VITE_WALLETCONNECT_PROJECT_ID is not configured — WalletConnect will be disabled')
}

export const wagmiConfig = createConfig({
  chains: [vestarStatusTestnetChain, mainnet, sepolia],
  connectors: projectId
    ? [
        injected(),
        walletConnect({
          projectId,
          showQrModal: true,
          metadata: {
            name: 'VESTAr',
            description: 'VESTAr voting dapp',
            url: dappOrigin,
            icons: [`${dappOrigin}/favicon.svg`],
          },
        }),
      ]
    : [injected()],
  transports: {
    [vestarStatusTestnetChain.id]: http(vestarStatusTestnetChain.rpcUrls.default.http[0]),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})
