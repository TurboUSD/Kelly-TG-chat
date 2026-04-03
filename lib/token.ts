import { ethers } from "ethers";
import { config } from "./config";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

let provider: ethers.JsonRpcProvider | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }
  return provider;
}

function getTokenContract(): ethers.Contract {
  return new ethers.Contract(config.tokenAddress, ERC20_ABI, getProvider());
}

/**
 * Get the raw balance (in wei) for a wallet address
 */
export async function getBalance(walletAddress: string): Promise<bigint> {
  const contract = getTokenContract();
  const balance = await contract.balanceOf(walletAddress);
  return BigInt(balance.toString());
}

/**
 * Get the human-readable balance (e.g., "52340000.123")
 */
export async function getFormattedBalance(walletAddress: string): Promise<string> {
  const balance = await getBalance(walletAddress);
  return ethers.formatUnits(balance, config.tokenDecimals);
}

/**
 * Check if a wallet holds enough KELLY tokens
 */
export async function hasMinBalance(walletAddress: string): Promise<boolean> {
  const balance = await getBalance(walletAddress);
  return balance >= config.minBalance;
}

/**
 * Get balance and check minimum in one call
 */
export async function checkBalance(walletAddress: string): Promise<{
  balance: bigint;
  formatted: string;
  sufficient: boolean;
}> {
  const balance = await getBalance(walletAddress);
  return {
    balance,
    formatted: ethers.formatUnits(balance, config.tokenDecimals),
    sufficient: balance >= config.minBalance,
  };
}
