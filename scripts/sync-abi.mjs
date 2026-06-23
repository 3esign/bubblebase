import fs from 'fs';
import path from 'path';

const artifactsPath = path.resolve('hardhat_project/artifacts/contracts/Bubbles.sol/Bubbles.json');
const outputPath = path.resolve('src/constants/contract.ts');

try {
  if (!fs.existsSync(artifactsPath)) {
    console.error(`Artifacts not found at ${artifactsPath}. Please run "npx hardhat compile" first in hardhat_project.`);
    process.exit(1);
  }

  const fileContents = fs.readFileSync(artifactsPath, 'utf8');
  const artifact = JSON.parse(fileContents);
  const abi = artifact.abi;

  if (!abi) {
    console.error('No ABI found in artifact.');
    process.exit(1);
  }

  const outputContent = `export const BUBBLES_CONTRACT_ADDRESS_LOCAL = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;
export const BUBBLES_CONTRACT_ADDRESS_MAINNET = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET || "0x0000000000000000000000000000000000000000") as \`0x\${string}\`;

export const BUBBLES_ABI = ${JSON.stringify(abi, null, 2)} as const;
`;

  fs.writeFileSync(outputPath, outputContent, 'utf8');
  console.log(`Successfully synced ABI from Hardhat artifact to ${outputPath}`);
} catch (error) {
  console.error('Error syncing ABI:', error);
  process.exit(1);
}
