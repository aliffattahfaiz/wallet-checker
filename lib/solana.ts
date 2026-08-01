import { Connection, PublicKey } from "@solana/web3.js";
import type { WalletResult, WalletTokenAmount } from "./types";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    const rpcUrl =
      process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    connection = new Connection(rpcUrl, "confirmed");
  }
  return connection;
}

export function isValidPublicKey(address: string): boolean {
  try {
    // Throws if not valid base58 / wrong length
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches native SOL balance plus every SPL (Token Program and Token-2022)
 * account balance for a single wallet.
 */
export async function fetchWalletBalances(
  address: string
): Promise<WalletResult> {
  if (!isValidPublicKey(address)) {
    return { address, ok: false, error: "Invalid Solana address" };
  }

  const conn = getConnection();
  const owner = new PublicKey(address);

  try {
    const [solLamports, tokenAccounts, token2022Accounts] = await Promise.all(
      [
        conn.getBalance(owner, "confirmed"),
        conn.getParsedTokenAccountsByOwner(owner, {
          programId: TOKEN_PROGRAM_ID,
        }),
        conn.getParsedTokenAccountsByOwner(owner, {
          programId: TOKEN_2022_PROGRAM_ID,
        }),
      ]
    );

    const tokens: WalletTokenAmount[] = [];

    for (const { account } of [
      ...tokenAccounts.value,
      ...token2022Accounts.value,
    ]) {
      const parsed = account.data.parsed?.info;
      const tokenAmount = parsed?.tokenAmount;
      if (!parsed || !tokenAmount) continue;

      const uiAmount: number = tokenAmount.uiAmount ?? 0;
      if (uiAmount <= 0) continue; // skip empty / closed-out accounts

      tokens.push({
        mint: parsed.mint,
        amount: uiAmount,
        decimals: tokenAmount.decimals,
      });
    }

    return { address, ok: true, solLamports, tokens };
  } catch (err) {
    return {
      address,
      ok: false,
      error: err instanceof Error ? err.message : "RPC request failed",
    };
  }
}

/** Runs async work over a list with a max concurrency, to stay polite to public RPC rate limits. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(runners);
  return results;
}
