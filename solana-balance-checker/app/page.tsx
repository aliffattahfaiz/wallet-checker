"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import type { AggregatedToken, BalancesResponse, WalletResult } from "@/lib/types";

function parseWallets(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\s,]+/)
        .map((w) => w.trim())
        .filter(Boolean)
    )
  );
}

function formatAmount(amount: number): string {
  if (amount === 0) return "0";
  const decimals = amount < 1 ? 6 : amount < 1000 ? 4 : 2;
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function Home() {
  const [walletsText, setWalletsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BalancesResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wallets = useMemo(() => parseWallets(walletsText), [walletsText]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setWalletsText((prev) => (prev ? `${prev}\n${text}` : text));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    setError(null);
    setResult(null);

    if (wallets.length === 0) {
      setError("Add at least one wallet address first.");
      return;
    }
    if (wallets.length > 40) {
      setError(`Too many wallets (${wallets.length}). Limit is 40 per scan.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallets }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed.");
        return;
      }
      setResult(data as BalancesResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpanded(mint: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(mint)) next.delete(mint);
      else next.add(mint);
      return next;
    });
  }

  const failedWallets: WalletResult[] =
    result?.wallets.filter((w) => !w.ok) ?? [];
  const okWallets = result?.wallets.filter((w) => w.ok) ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Solana · Multi-Wallet</p>
        <h1 className={styles.title}>Ledger</h1>
        <div className={styles.titleRule} />
        <p className={styles.subtitle}>
          Paste or upload a list of Solana wallet addresses. Ledger reads
          native SOL and every SPL / Token-2022 balance for each one, then
          settles them into a single total per token.
        </p>
      </header>

      <section className={styles.card}>
        <div className={styles.fieldLabel}>
          <span>Wallet addresses</span>
          <span className={styles.walletCount}>
            {wallets.length} address{wallets.length === 1 ? "" : "es"}
          </span>
        </div>
        <textarea
          className={styles.textarea}
          placeholder={
            "One address per line (or comma-separated)\ne.g.\n5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1\nDs6...\n"
          }
          value={walletsText}
          onChange={(e) => setWalletsText(e.target.value)}
          spellCheck={false}
        />
        <div className={styles.controlsRow}>
          <button
            type="button"
            className={styles.fileButton}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload .txt / .csv
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            className={styles.hiddenInput}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Scanning…" : "Scan wallets"}
          </button>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
      </section>

      {result && (
        <section className={styles.card}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryText}>
              {result.aggregated.length} token
              {result.aggregated.length === 1 ? "" : "s"} across{" "}
              {okWallets.length} wallet{okWallets.length === 1 ? "" : "s"}
              {failedWallets.length > 0
                ? ` · ${failedWallets.length} failed`
                : ""}
            </span>
          </div>

          {failedWallets.length > 0 && (
            <div className={styles.walletStatusList}>
              {failedWallets.map((w) => (
                <span
                  key={w.address}
                  className={`${styles.walletChip} ${styles.walletChipFail}`}
                  title={w.error}
                >
                  {shortenAddress(w.address)} — {w.error}
                </span>
              ))}
            </div>
          )}

          {result.aggregated.length === 0 ? (
            <p className={styles.emptyState}>
              No balances found across these wallets.
            </p>
          ) : (
            <div className={styles.tokenList}>
              {result.aggregated.map((token: AggregatedToken) => {
                const isOpen = expanded.has(token.mint);
                return (
                  <div key={token.mint}>
                    <div
                      className={styles.tokenRow}
                      onClick={() => toggleExpanded(token.mint)}
                    >
                      {token.logoURI ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={token.logoURI}
                          alt=""
                          className={styles.tokenLogo}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <div className={styles.tokenLogoFallback}>
                          {token.symbol.slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <div className={styles.tokenIdentity}>
                        <p className={styles.tokenSymbol}>{token.symbol}</p>
                        <p className={styles.tokenName}>{token.name}</p>
                      </div>
                      <div className={styles.tokenTotal}>
                        {formatAmount(token.total)}
                      </div>
                      <span
                        className={`${styles.chevron} ${
                          isOpen ? styles.chevronOpen : ""
                        }`}
                      >
                        ▸
                      </span>
                    </div>
                    {isOpen && (
                      <div className={styles.walletBreakdown}>
                        {token.byWallet
                          .slice()
                          .sort((a, b) => b.amount - a.amount)
                          .map((w) => (
                            <div
                              key={w.address}
                              className={styles.walletBreakdownRow}
                            >
                              <span className={styles.walletBreakdownAddr}>
                                {w.address}
                              </span>
                              <span>{formatAmount(w.amount)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
