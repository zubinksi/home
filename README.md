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

## On Vercel

Vercel builds the site with `npm run build` and serves `dist/`. The
server routes live in `api/` as Vercel functions; the local dev server runs the
same code from `api/_lib/`.

| Route | What it does | Needs |
| --- | --- | --- |
| `/api/stock` | AAPL price and daily closes from Yahoo Finance | nothing |
| `/api/projects` | the live Projects sheet as CSV | the sheet shared by link |
| `/api/ask` | Ask the Policy | `ANTHROPIC_API_KEY` in the Vercel project |
| `/api/service-log` | reads the Servicing log tab; logs a job as done | the sheet shared by link; to log, `SERVICE_LOG_SCRIPT_URL` and `SERVICE_LOG_TOKEN` |

**Ask the Policy on Vercel.** Without `ANTHROPIC_API_KEY` set in Vercel, the
page asks for a key and keeps it in the browser (see above). If you set the key
in Vercel, anyone who finds the site's URL can send questions on your key: the
PIN only runs in the browser and doesn't protect `/api/ask`. Turn on Vercel's
deployment protection first, or leave the key in the browser.

**The PIN isn't a lock.** The portfolio numbers ship in the site's JavaScript,
so anyone with the URL can read them without the PIN. To keep the site
private, use Vercel's deployment protection (Settings → Deployment Protection).

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

## Servicing

The Servicing tab lists the house's recurring jobs (`src/servicing.ts`) in four
groups, with a summary of what's next and the year ahead. When each job was
last done comes from the **Servicing log** tab of the same "Home Projects &
Vendors" sheet: one row per job done (*Done on* as `YYYY-MM-DD`, *Job*,
*Job ID*, *Note*). The latest row for each job wins. You can add or fix rows by
hand; the *Job ID* must match an `id` in `src/servicing.ts`.

### Logging servicing jobs

Each job has a **Log as done** button. Only the sheet's owner can write to it,
so the site writes through a small Apps Script bound to the sheet. Set it up
once:

1. Open the sheet, then **Extensions → Apps Script**. Replace the code with
   `scripts/servicing-log.gs` and save.
2. **Project Settings (gear) → Script properties → Add script property**: name
   `TOKEN`, value a long random string (e.g. from a password manager).
3. **Deploy → New deployment → Web app**. Execute as **Me**; who has access
   **Anyone**. Deploy, authorize it, and copy the web app URL.
4. In Vercel (Settings → Environment Variables), add `SERVICE_LOG_SCRIPT_URL`
   (the URL) and `SERVICE_LOG_TOKEN` (the same token), then redeploy. For
   `npm run dev`, put them in `.env.local`.

The token stays on the server, so the script's URL alone can't write to the
sheet. `/api/service-log` itself is open like the site's other routes: anyone
who finds the site could add a row (the PIN runs only in the browser), so the
same advice applies: use Vercel's deployment protection to keep it private.
Until the script is connected, the button says logging isn't set up yet.

## The quarterly review

1. In `src/data.ts`, append one entry to `reviews` with the date and that day's
   amounts and prices (the latest entry is treated as "now").
2. Update `basis` after any buy or sell, and `hypeRungsSold` when a rung fills.
3. Open the site. The TOTAL view lists **what the policy calls for this
   review** (trims over HYPE's 45% ceiling or the 10% ZEC line, the 30% tax
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
