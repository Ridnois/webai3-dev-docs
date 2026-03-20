import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "viem/chains";
import type { Chain, Transport } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "1");
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim();

export const defaultChain: Chain = chainId === 11155111 ? sepolia : mainnet;

export const wagmiConfig = createConfig({
  chains: [defaultChain],
  transports: {
    [defaultChain.id]: http(rpcUrl || undefined),
  } as Record<(typeof defaultChain)["id"], Transport>,
  ssr: true,
});
