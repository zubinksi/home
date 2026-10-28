import irisWhite from './assets/iris-white.png';
import { equitiesAt, priceFmt, type LivePrices, type Quote } from './model';

/**
 * A ticker tape of today's moves for everything we price live, scrolling along
 * the foot of the Investments page, with an iris between each.
 */
export function TickerTape({ live }: { live: LivePrices }) {
  const quotes: [string, Quote | undefined][] = [
    ['HYPE', live.hype],
    ['ZEC', live.zec],
    ['AAPL', live.aapl],
    ...equitiesAt(live).positions.map((p): [string, Quote | undefined] => [p.ticker, live.stocks?.[p.ticker]]),
  ];
  const shown = quotes.filter((q): q is [string, Quote] => q[1] != null);
  if (!shown.length) return null;

  const run = (copy: number) =>
    shown.map(([name, q]) => (
      <span key={`${copy}-${name}`} className="tape-item" aria-hidden={copy > 0 || undefined}>
        <span className="tape-iris" style={{ maskImage: `url(${irisWhite})`, WebkitMaskImage: `url(${irisWhite})` }} />
        <b>{name}</b> {priceFmt(q.price)}
        {q.change != null && (
          <span className="tape-chg">
            {q.change >= 0 ? '+' : '−'}
            {Math.abs(q.change * 100).toFixed(1)}%
          </span>
        )}
      </span>
    ));

  // two copies end to end, so sliding one copy's width loops seamlessly
  return (
    <div className="ticker" role="marquee" aria-label="Today’s moves">
      <div className="ticker-track" style={{ animationDuration: `${shown.length * 6}s` }}>
        {run(0)}
        {run(1)}
      </div>
    </div>
  );
}
