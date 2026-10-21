# The Household of the Browns

A one-page household site, starting with our quarterly finance review. It answers two questions:
**what needs doing** (Open Items) and **what's out of policy** (Sleeves).

The rules come from [`policy/investment-policy.md`](policy/investment-policy.md).
The look follows the Claude Design handoff in [`design/HANDOFF.md`](design/HANDOFF.md).

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
```

To turn on **Ask the Policy**, copy `.env.example` to `.env.local` and set
`ANTHROPIC_API_KEY`. The key stays in the local dev/preview server and is never
sent to the browser.

If the site is opened without that server (a static host, or no key in
`.env.local`), Ask the Policy offers a field to paste a key instead. That key
is saved in the browser's local storage and sent directly to the Anthropic
API, so use it only on your own devices. **FORGET** under the input removes it.

## The PIN gate

The site opens behind a 4-digit code (set as `CODE` in `src/Gate.tsx`). It stays
unlocked until the browser tab is closed; the padlock in the header re-locks it.

This is a household gate, not real security: there is no login server, so the
code and the numbers both ship in the page's JavaScript. It keeps casual eyes
out on a shared screen. Don't rely on it to protect a copy hosted on the
public internet.

## Live prices

HYPE and ZEC prices come from CoinGecko (straight from the browser, every
minute); AAPL comes from Yahoo Finance through the site's own server
(`/api/stock`), so it is live only when the site runs with `npm run dev` or
`npm run preview`. The quantities you hold, cash and equities still come from
the latest entry in `reviews` (`src/data.ts`); only the prices are live. The
TOTAL chart values today's holdings at each day's prices since the first
review. Anything that can't be fetched falls back to the review price, and the
note under the chart says which.

## On your home screen

The site is set up as a home-screen app (icon: the iris from our wallpaper).
Open it in Safari on iPhone → Share → **Add to Home Screen**, or in Chrome on
Android → menu → **Add to Home screen** / **Install app**. It opens full-screen
without the browser bar.

Your phone has to be able to reach the site, so the computer running it must
be on the same Wi-Fi and started with `npm run dev -- --host`. The PIN gate
is the only thing between that address and your numbers, and Ask the Policy
answers using the key in `.env.local`. Only do this on your home network.

## Projects

The Projects tab reads the **Projects** tab of the "Home Projects & Vendors"
Google Sheet live each time you open it (through the local dev server, cached
for a minute). The sheet must stay shared as *Anyone with the link can view*.
If it can't be reached, the page shows a saved copy and says so; refresh that
copy by replacing `src/assets/projects-snapshot.csv`.

The page relies on these sheet conventions:

- Groups are separated by a blank row; a group starts with a heading row,
  `Area: condition note` (the note is optional).
- Column B is a moving / maintenance cost, column C a furnishing cost. Any cost,
  including `FREE`, means the item is done.
- Start an item with `Optional:` to mark it optional, or `Closed:` to drop it
  without deleting it.
- Hidden column D holds `=ARRAYFORMULA(ROW(A1:A300))`. Leave it there: Google's
  browser-readable export drops blank rows, and those row numbers are how the
  page still sees where one area ends and the next begins.
- Areas named Moving, Roof, Plumbing, Maintenance/testing, Walls…, Patio or Yard
  are listed under **The House**; everything else under **The Rooms**.

## The quarterly review

1. In `src/data.ts`, append one entry to `reviews` with the date and that day's
   amounts and prices (the latest entry is treated as "now").
2. Update `basis` after any buy or sell, and `hypeRungsSold` when a rung fills.
3. Open the site. The TOTAL view lists **what the policy calls for this
   review** (trims over the 45% crypto ceiling or the 10% ZEC line, the 30% tax
   set-aside, the Fortress refill to 30 months, the overflow to Diversified),
   and those steps appear as open items automatically.
4. Check off items as you do them. Checked-off items are remembered in this
   browser only.

Every percentage, status dot, gauge, ladder marker and trim amount is derived
from those numbers by `src/model.ts` using the rules in the policy. Change
rules there only at the annual review.

## Layout

| Path | What |
|---|---|
| `src/data.ts` | The numbers. Edit each quarter. |
| `src/model.ts` | Policy rules and everything derived from them |
| `src/App.tsx`, `Detail.tsx`, `Chart.tsx`, `Ask.tsx` | UI |
| `server/ask.ts` | `/api/ask` endpoint (Claude), mounted in Vite dev + preview |
| `policy/investment-policy.md` | The signed policy, which is also the context for Ask the Policy |

> This is private household data. Keep the repo private, and don't deploy it to a
> public host such as GitHub Pages.
