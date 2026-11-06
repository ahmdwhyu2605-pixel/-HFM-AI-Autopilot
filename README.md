# HFM AI Autopilot

Mobile-first XAUUSD analysis, historical backtest, and manual demo journal.

## GitHub Pages deployment
1. Open repository **Settings → Pages**.
2. Choose **Deploy from a branch**.
3. Select branch `main`, folder `/(root)`, then Save.
4. Wait for GitHub Pages to publish.

## Backend (Supabase)
Project: `rjnghnfmjnqhlswxocoi` (Tokyo)

Edge Functions are version-controlled in `supabase/functions/`:
- `market-data`: requires a signed-in user JWT, retrieves XAU/USD OHLC from Twelve Data, removes the forming candle, and rejects stale or insufficient history.
- `ai-analysis`: authenticated AI research using completed Twelve Data candles, OpenAI, GDELT headlines, and FRED macro series.

Required Supabase Edge Function secrets:
- `TWELVE_DATA_API_KEY`
- `OPENAI_API_KEY`

Never place these secrets in GitHub, browser JavaScript, or chat. The frontend contains only the Supabase publishable key. The market-data endpoint also requires a valid signed-in user JWT to protect the provider quota.

## Current capabilities
- Supabase email signup/login.
- XAU/USD aggregate market candles and EMA20/50/200, RSI, ADX, ATR analysis.
- AI cloud research (requires login and both backend secrets).
- Manual demo journal stored per authenticated user.
- Historical strategy backtest on the loaded, verified candles; results can be saved to the user's account.
- Local-only demo simulator with risk settings, position history, SL/TP, and kill switch.
- Installable PWA shell and Android-responsive layout.

## Important limits
- Twelve Data XAU/USD is an external aggregate feed, **not HFM bid/ask or execution prices**.
- Backtests omit spread, commission, swap, slippage, and broker-specific contract rules; results are research only.
- Local simulation does not open orders at HFM and its displayed units are not broker lots.
- **Live MT5 autopilot is not connected yet.** It requires a secure MT5 Expert Advisor/bridge running in MT5 Desktop on Windows or a Windows VPS. MT5 Android cannot run Expert Advisors. Do not use this dashboard for live execution.
- Market chart access requires login; the public browser bundle does not contain the Twelve Data or OpenAI secrets.

## Deploy backend changes
Deploy the matching function from `supabase/functions/<function-name>/index.ts` to the Supabase project. Keep `verify_jwt` settings in `supabase/config.toml` aligned with the live function configuration.
