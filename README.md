# Investment Policy · The Browns

A one-page site for our quarterly finance review. It answers two questions:
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
