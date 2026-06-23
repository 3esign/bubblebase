import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, hardhat } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "dummy-wallet-connect-id";

export const config = getDefaultConfig({
  appName: "Bubbles",
  projectId,
  chains: [hardhat, base],
  ssr: true,
});
