import { NextRequest, NextResponse } from "next/server";
import { fetchWalletBalances, mapWithConcurrency } from "@/lib/solana";
import { fetchTokenMetadataMap, NATIVE_SOL_MINT } from "@/lib/tokenList";
import type { AggregatedToken, BalancesResponse, WalletResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_WALLETS = 40;
const LAMPORTS_PER_SOL = 1_000_000_000;

export async function POST(req: NextRequest) {
  let body: { wallets?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body.wallets;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json(
      { error: "Provide a non-empty array of wallet addresses" },
      { status: 400 }
    );
  }

  const wallets = Array.from(
    new Set(
      raw
        .filter((w): w is string => typeof w === "string")
        .map((w) => w.trim())
        .filter(Boolean)
    )
  );

  if (wallets.length === 0) {
    return NextResponse.json(
      { error: "No usable wallet addresses found" },
      { status: 400 }
    );
  }

  if (wallets.length > MAX_WALLETS) {
    return NextResponse.json(
      {
        error: `Too many wallets in one request (${wallets.length}). Limit is ${MAX_WALLETS} — split the list and run again.`,
      },
      { status: 400 }
    );
  }

  // Public RPC is rate-limited, so fetch with bounded concurrency rather than all at once.
  const walletResults: WalletResult[] = await mapWithConcurrency(
    wallets,
    5,
    fetchWalletBalances
  );

  const allMints = new Set<string>();
  for (const w of walletResults) {
    if (!w.ok) continue;
    if ((w.solLamports ?? 0) > 0) allMints.add(NATIVE_SOL_MINT);
    for (const t of w.tokens ?? []) allMints.add(t.mint);
  }

  const metaMap = await fetchTokenMetadataMap(Array.from(allMints));

  const aggregatedMap = new Map<string, AggregatedToken>();

  function addAmount(mint: string, decimals: number, address: string, amount: number) {
    let entry = aggregatedMap.get(mint);
    if (!entry) {
      const meta = metaMap.get(mint);
      entry = {
        mint,
        symbol: meta?.symbol ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`,
        name: meta?.name ?? "Unknown token",
        logoURI: meta?.logoURI,
        decimals,
        total: 0,
        byWallet: [],
      };
      aggregatedMap.set(mint, entry);
    }
    entry.total += amount;
    entry.byWallet.push({ address, amount });
  }

  for (const w of walletResults) {
    if (!w.ok) continue;
    const sol = (w.solLamports ?? 0) / LAMPORTS_PER_SOL;
    if (sol > 0) addAmount(NATIVE_SOL_MINT, 9, w.address, sol);
    for (const t of w.tokens ?? []) {
      addAmount(t.mint, t.decimals, w.address, t.amount);
    }
  }

  const aggregated = Array.from(aggregatedMap.values()).sort((a, b) => {
    if (a.mint === NATIVE_SOL_MINT) return -1;
    if (b.mint === NATIVE_SOL_MINT) return 1;
    return b.total - a.total;
  });

  const response: BalancesResponse = { aggregated, wallets: walletResults };
  return NextResponse.json(response);
}
