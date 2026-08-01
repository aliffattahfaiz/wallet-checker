# Ledger — Solana Multi-Wallet Balance Checker

Paste or upload a list of Solana wallet addresses. The app reads native SOL
plus every SPL / Token-2022 token balance for each wallet, then aggregates
everything into one total per token across all wallets — with symbol, name,
and logo pulled from Jupiter's token metadata API.

## Stack

- Next.js 14 (App Router, TypeScript)
- `@solana/web3.js` for RPC calls (SOL balance + parsed token accounts, both
  the classic Token Program and Token-2022)
- Jupiter Token API (`tokens.jup.ag`) for token symbol / name / logo lookups
- No database — everything runs per-request in an API route

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables (optional)

By default the app uses Solana's public RPC endpoint
(`https://api.mainnet-beta.solana.com`), which is rate-limited and can be
slow or flaky under load. For anything beyond casual use, set your own RPC
URL (Helius, QuickNode, Triton, etc.):

```
SOLANA_RPC_URL=https://your-rpc-provider.example.com
```

Add it locally in `.env.local`, and in Vercel under
**Project Settings → Environment Variables**.

## Deploying to Vercel

**Option A — Git**
1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. In Vercel: **Add New → Project**, import the repo. Framework preset
   `Next.js` is auto-detected — no config needed.
3. (Optional) add `SOLANA_RPC_URL` under Environment Variables.
4. Deploy.

**Option B — CLI**
```bash
npm i -g vercel
vercel
```

## Limits & notes

- **Batch size:** capped at 40 wallets per scan (`MAX_WALLETS` in
  `app/api/balances/route.ts`) to stay within serverless function limits and
  be polite to the public RPC. Raise it if you're using your own RPC.
- **Function timeout:** the API route requests `maxDuration = 60`. Vercel's
  **Hobby** plan caps functions at 10s regardless, so on Hobby, keep wallet
  lists small (or switch to a paid RPC to speed up each call) — **Pro/
  Enterprise** plans honor the 60s setting.
- **No USD pricing:** balances are shown in each token's native units, not
  dollar value — this app never fetches price data.
- **Unlisted tokens:** if a mint isn't in Jupiter's token list, it still
  shows up with its raw balance, labeled by a shortened mint address instead
  of a symbol.
- Only tokens with a non-zero balance are included; empty/closed token
  accounts are skipped.
