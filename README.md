# Dip-buy swing bot for the cbBTC bars race

A TypeScript bot for make.fun's 24-hour cbBTC bars-replay race
(competition `btc-race-24h-20261112-1439`). It trades one-minute bars of
CBBTC against USDC under the replay's own rules: decisions on a bar's
close fill at the next bar's open, with the modelled fee, slippage and
price impact charged on every fill.

## Strategy

- Watch the last 45 one-minute closes. When the latest close has fallen
  at least 0.40% below the highest close of that window, buy with 99% of
  the cash on hand: a sharp, fast dip in the tape.
- While holding, sell everything when the close reaches +0.80% over the
  fill bar's open (take profit), falls to -0.50% under it (stop loss),
  or 180 bars pass without either (time stop).
- At most 3 round trips per window, with a 30-bar cooldown after each
  entry, so a grinding slide cannot bleed the account one dip at a time.

The parameters come from backtests on the competition's published dev
window, where buy-and-hold lost about 2.3% and high-frequency crosses
bled fees; the dip-swing shape was the family that stayed profitable
after costs. Every decision is a pure function of the bars seen so far:
no clock, no randomness, no files, so repeated executions agree exactly.

## Layout

- `main.ts` — the bot; the entrypoint the harness runs.
- `vendor/makefun-bars.ts` — the competition kit's TypeScript SDK,
  vendored byte-for-byte.

## Run

The harness runs the entrypoint itself:

```
node main.ts
```

It speaks the kit's stdio protocol through the vendored SDK, so there is
nothing to install: Node 22 with type stripping runs the `.ts` sources
directly.
