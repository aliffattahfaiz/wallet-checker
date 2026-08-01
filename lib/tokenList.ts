import type { TokenMeta } from "./types";
import { mapWithConcurrency } from "./solana";

export const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111111";

const NATIVE_SOL_META: TokenMeta = {
  mint: NATIVE_SOL_MINT,
  symbol: "SOL",
  name: "Solana",
  decimals: 9,
  logoURI:
    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
};

// Module-level cache. Persists for the lifetime of a warm serverless instance.
const metaCache = new Map<string, TokenMeta>();

async function fetchOne(mint: string): Promise<TokenMeta | null> {
  if (metaCache.has(mint)) return metaCache.get(mint)!;

  try {
    const res = await fetch(`https://tokens.jup.ag/token/${mint}`, {
      // Metadata doesn't change often; let the platform cache it briefly.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.address) return null;

    const meta: TokenMeta = {
      mint,
      symbol: data.symbol || mint.slice(0, 4).toUpperCase(),
      name: data.name || "Unknown token",
      decimals: typeof data.decimals === "number" ? data.decimals : 0,
      logoURI: data.logoURI || undefined,
    };
    metaCache.set(mint, meta);
    return meta;
  } catch {
    return null;
  }
}

/**
 * Resolves symbol/name/logo/decimals for a list of mints.
 * Falls back to a shortened mint address as the symbol when metadata
 * isn't available (unlisted / brand-new tokens).
 */
export async function fetchTokenMetadataMap(
  mints: string[]
): Promise<Map<string, TokenMeta>> {
  const map = new Map<string, TokenMeta>();
  map.set(NATIVE_SOL_MINT, NATIVE_SOL_META);
  metaCache.set(NATIVE_SOL_MINT, NATIVE_SOL_META);

  const uniqueMints = Array.from(new Set(mints)).filter(
    (m) => m !== NATIVE_SOL_MINT
  );

  const results = await mapWithConcurrency(uniqueMints, 8, fetchOne);

  uniqueMints.forEach((mint, i) => {
    const found = results[i];
    map.set(
      mint,
      found ?? {
        mint,
        symbol: `${mint.slice(0, 4)}…${mint.slice(-4)}`,
        name: "Unknown token",
        decimals: 0,
      }
    );
  });

  return map;
}
