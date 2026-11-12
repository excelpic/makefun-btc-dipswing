// Dip-buy swing bot for the make.fun cbBTC bars-replay race.
//
// Strategy, tuned and backtested on the published dev window before this
// file was written:
//   - Watch the last 45 one-minute closes of CBBTC. When the latest close
//     has fallen at least 0.40% below the highest close of that window,
//     buy with 99% of the cash on hand: a sharp, fast dip in the tape.
//   - While holding, sell everything when the close reaches +0.80% over
//     the fill bar's open (take profit), falls to -0.50% under it (stop
//     loss), or 180 bars pass without either (time stop).
//   - At most 3 round trips per window, with a 30-bar cooldown after
//     each entry, so a grinding slide cannot bleed the account one dip
//     at a time.
// Every decision is a pure function of the bars seen so far: no clock,
// no randomness, no files, so the two graded executions agree exactly.

import { runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const WINDOW = 45; // bars of history behind the dip signal
const DIP = 0.004; // buy when close <= window high * (1 - DIP)
const TAKE_PROFIT = 0.008;
const STOP_LOSS = 0.005;
const TIME_STOP = 180; // bars
const MAX_ROUND_TRIPS = 3;
const COOLDOWN = 30; // flat bars to wait after each entry
const MAX_SLIPPAGE_BPS = 300;

const closes: number[] = [];
let entryPrice: number | null = null; // open of the bar that filled the position
let heldBars = 0;
let roundTrips = 0;
let cooldown = 0;

await runBars({
  onBatch(state, batch) {
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = Number(bar.c);
    closes.push(close);
    const held = state.positions.get(SYMBOL);

    if (held !== undefined && held.qty > 0n) {
      if (entryPrice === null) {
        entryPrice = Number(bar.o);
        heldBars = 0;
      }
      heldBars += 1;
      if (
        close >= entryPrice * (1 + TAKE_PROFIT) ||
        close <= entryPrice * (1 - STOP_LOSS) ||
        heldBars >= TIME_STOP
      ) {
        // entryPrice and heldBars are reset only once the account is seen
        // flat, so a sell the market refuses (a slippage rejection, say)
        // is retried against the original entry, not a fresh one.
        const sell: SellInput = {
          side: 'sell',
          symbol: SYMBOL,
          qty: held.qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        return [sell];
      }
      return [];
    }

    entryPrice = null;
    heldBars = 0;
    if (state.warmingUp || roundTrips >= MAX_ROUND_TRIPS) return [];
    if (cooldown > 0) {
      cooldown -= 1;
      return [];
    }
    if (closes.length < WINDOW) return [];
    let high = 0;
    for (let i = closes.length - WINDOW; i < closes.length; i++) {
      if (closes[i] > high) high = closes[i];
    }
    if (close <= high * (1 - DIP)) {
      const notional = (state.cash * 99n) / 100n;
      if (notional < 1_000_000n) return [];
      roundTrips += 1;
      cooldown = COOLDOWN;
      const buy: BuyInput = {
        side: 'buy',
        symbol: SYMBOL,
        notional_quote_units: notional,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      };
      return [buy];
    }
    return [];
  },
});
