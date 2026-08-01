export interface WalletTokenAmount {
  mint: string;
  amount: number; // UI amount (already divided by decimals)
  decimals: number;
}

export interface WalletResult {
  address: string;
  ok: boolean;
  error?: string;
  solLamports?: number;
  tokens?: WalletTokenAmount[];
}

export interface TokenMeta {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  decimals: number;
}

export interface AggregatedToken {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  decimals: number;
  total: number;
  byWallet: { address: string; amount: number }[];
}

export interface BalancesResponse {
  aggregated: AggregatedToken[];
  wallets: WalletResult[];
}
