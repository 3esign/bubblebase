import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, hardhat } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Bubbles",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "9fbc610111f185d2630a911e3b5641bb", // fallback mock project ID for dev
  chains: [hardhat, base],
  ssr: true,
});
