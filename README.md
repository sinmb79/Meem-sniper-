# SafeSniper

Telegram-first Solana memecoin sniper scaffold built from the planning documents in this repository.

## Included

- TypeScript + Node.js project structure
- Telegram bot handlers and inline keyboards
- SQLite-backed storage for wallets, trades, positions, subscriptions, and referral data
- Safety filter pipeline with Stage 1 to Stage 5 modules
- Fee, referral, and Pro-tier service layer
- DRY_RUN-first trading flow to keep the initial implementation safe

## Notes

- `DRY_RUN=true` is the default and recommended initial mode.
- Live Pump.fun buy/sell transaction building is intentionally left guarded behind runtime checks.
- `stage3_social` prefers Twikit via Python subprocess when credentials are present, with a REST fallback using `twitterapi.io`.

## Commands

```bash
npm install
npm run build
npm run dev
```

## Environment

Copy `.env.example` to `.env` and fill in the required values before running the bot.
