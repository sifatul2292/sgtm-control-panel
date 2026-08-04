# Tagioo — SaaS Monetization Spec

Status: **DRAFT for review** · Last updated: 2026-06-27 · Owner: Sifatul

This document specifies how Tagioo turns from a working tracking product into a viable
paid SaaS, given one hard constraint: **the company is not licensed, so no payment
gateway (SSLCommerz / aamarPay / ShurjoPay) can be used.** Payment is collected
**manually via bKash / Nagad** and confirmed by the owner in the admin dashboard.

---

## 1. Business model summary

Public tiers (PixelFly-aligned, set 2026-06-27 — issue #1 resolved):

| Tier        | Price (BDT/mo) | Event limit / 30-day cycle | Domains | sGTM containers |
|-------------|----------------|----------------------------|---------|-----------------|
| Free        | ৳0             | 15,000                     | 1       | 1               |
| Starter     | ৳1,200         | 500,000                    | 1       | 1               |
| Pro (popular)| ৳2,900        | 2,000,000                  | 2       | 3               |
| Enterprise  | ৳5,900         | 5,000,000                  | 10      | 10              |

(Growth ৳2,500 / Agency ৳7,500 remain as internal owner-only plans in `planResourceProfiles`, not shown publicly.)

- **Free is a permanent tier, not a time-limited trial.** Every account starts on Free:
  15,000 events per rolling 30-day cycle, renewing each cycle, forever.
- When a Free user needs more volume, they **upgrade** to a paid plan via the manual
  bKash/Nagad flow below.
- Paid plans run for **30 days from the date the owner confirms payment**, then must be
  renewed (same manual flow).

---

## 2. Subscription lifecycle states

`subscriptionStatus` on each tenant:

| State              | Meaning                                                        | Container |
|--------------------|----------------------------------------------------------------|-----------|
| `free`             | On Free tier, within 15K cycle limit                           | Running   |
| `free_capped`      | On Free tier, hit 15K this cycle                              | **Stopped** until cycle reset or upgrade |
| `pending_payment`  | Chose a paid plan, awaiting manual payment + owner confirm     | Running on Free limits until confirmed (see issue #2) |
| `active`           | Paid plan confirmed by owner, within 30-day paid window        | Running   |
| `overdue`          | Paid 30-day window ended, not yet renewed                      | Running (grace) |
| `expired`          | Overdue past grace → suspended                                 | **Stopped** |

`paymentStatus`: `free` · `pending` · `paid` · `rejected`.

---

## 3. Free-tier usage enforcement (the 15K trigger)

Decision (locked): **hard stop at 15K, nudge at 12K.**

- **Usage cycle:** rolling 30 days per tenant. Add `cycleStart` + `cycleEnd` fields.
  When `cycleEnd` passes, reset cycle usage to 0 and roll `cycleStart`/`cycleEnd` forward.
  (Current code computes calendar-month usage at [server.js:4951](../server.js); switch
  Free-tier counting to the rolling cycle window.)
- **At 12,000 events (80%):** send upgrade nudge — **email + WhatsApp** (see §6).
  Fire once per cycle (set `nudgedAt` so it doesn't repeat every tick).
- **At 15,000 events (100%):** `subscriptionStatus = free_capped` → **stop the tenant's
  container immediately** (reuse the existing owner stop-container control). Tracking
  halts until either the cycle resets or they upgrade and the owner confirms payment.
- A daily cron tick evaluates each Free tenant's usage against the cycle (see §7).

---

## 4. Manual payment flow (end to end)

```
Customer                          System                           Owner
   |                                |                                |
   | 1. Hit/near 15K  ------------> |  email + WhatsApp: "upgrade"    |
   | 2. Click Upgrade, pick plan -> |  status = pending_payment       |
   |                                |  show bKash/Nagad #, amount,    |
   |                                |  invoice ref (= tenantId-INV##) |
   | 3. Pay manually via bKash/Nagad app (off-platform)              |
   | 4. Enter TxnID + sender # ---> |  store payment claim            |
   |                                |  email Owner: "someone paid" -> | 5. receives email
   |                                |                                | 6. open Admin > Payments
   |                                |                                |    verify TxnID in bKash app
   |                                | <----------------------------- | 7. click Confirm
   |                                |  status = active                |
   |                                |  paymentStatus = paid           |
   |                                |  paidAt = now                   |
   |                                |  renewalDate = now + 30 days    |
   |                                |  start/resume container         |
   | 8. email customer: "active" <- |                                 |
```

Owner may also **Reject** a claim (wrong/duplicate TxnID) → `paymentStatus = rejected`,
customer emailed to resubmit.

### Renewal
- 30-day window ends → `overdue` (grace, container still running).
- Cron sends renewal reminders at T-7 / T-3 / T-1 before `renewalDate`, and on overday.
- Overdue + N days unpaid → `expired` → stop container.
- Renewal repeats the exact same claim→confirm loop.

---

## 5. Data model changes (`data/history.json`)

### New top-level array: `payments[]`
```jsonc
{
  "id": "pay_xxx",
  "invoiceNo": "test-user-2-INV001",
  "tenantId": "test-user-2",
  "plan": "Starter",
  "amount": 900,
  "method": "bkash",            // bkash | nagad
  "txnId": "8N7A1B2C3D",         // entered by customer
  "senderNumber": "017xxxxxxxx", // entered by customer
  "status": "pending",           // pending | confirmed | rejected
  "claimedAt": "2026-06-27T...",
  "confirmedBy": "admin",
  "confirmedAt": "2026-06-27T...",
  "note": ""
}
```

### New `settings` keys (editable in Admin dashboard, per decision)
```jsonc
"settings": {
  "payment": {
    "bkashNumber": "017xxxxxxxx",
    "nagadNumber": "018xxxxxxxx",
    "ownerNotifyEmail": "you@tagioo.com",
    "ownerWhatsApp": "+88017xxxxxxxx",
    "instructions": "Send Money (not Payment) to the number above..."
  }
}
```

### New tenant fields
`cycleStart`, `cycleEnd`, `nudgedAt`, `cappedAt`, `paidAt`, `lastInvoiceNo`.
(`renewalDate` already exists — change its computation from month-start to `paidAt + 30d`.)

---

## 6. Notifications

Email is the **automated** channel (Brevo integration, `sendEmail` in [server.js](../server.js);
Resend remains as a fallback when `BREVO_API_KEY` is unset).
Generalize `sendPasswordResetEmail` → `sendEmail(to, template, vars)`.

| Trigger                         | To       | Channel        |
|---------------------------------|----------|----------------|
| Welcome (on signup)             | Customer | Email          |
| Usage 80% (12K) upgrade nudge   | Customer | Email + WhatsApp |
| Usage 100% (15K) capped         | Customer | Email + WhatsApp |
| Payment claim submitted         | **Owner**| Email          |
| Payment confirmed (plan active) | Customer | Email          |
| Payment rejected                | Customer | Email          |
| Renewal reminder T-7/T-3/T-1    | Customer | Email + WhatsApp |
| Overdue / suspended             | Customer | Email + WhatsApp |

**WhatsApp note:** automated WhatsApp needs the WhatsApp Business / Meta Cloud API
(requires a verified business + approved templates) — blocked while unlicensed. Until
then, WhatsApp is **manual**: dashboard shows a `wa.me/<number>?text=...` click-to-chat
link the owner/customer taps. Treat automated WhatsApp as a later phase (see open issue #3).

---

## 7. Cron / scheduled jobs

Add a daily tick (reuse the `setInterval(...).unref()` pattern at [server.js:8216](../server.js),
or the existing `tagioo-watchdog.sh` cron host). Each tick, per tenant:

1. If `cycleEnd` passed → reset cycle usage, roll cycle window, clear `nudgedAt`/`cappedAt`,
   if `free_capped` → restart container back to `free`.
2. Free tenant usage ≥ 12K and not yet nudged this cycle → send nudge, set `nudgedAt`.
3. Free tenant usage ≥ 15K → `free_capped`, stop container, set `cappedAt`, email/WhatsApp.
4. Paid tenant `renewalDate` within 7/3/1 days → reminder.
5. Paid tenant past `renewalDate` → `overdue`; past grace (e.g. +7d) → `expired`, stop container.

---

## 8. New / changed API endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/customer/subscription` | customer | **CHANGE:** paid plan → `pending_payment`, NOT `active`. Returns invoice + payment instructions. |
| POST | `/api/customer/payment-claim` | customer | Submit TxnID + senderNumber + method. Creates `payments[]` record, emails owner. |
| GET  | `/api/customer/payment-claim` | customer | Customer sees their claim status. |
| GET  | `/api/owner/payments` | owner | List pending/confirmed/rejected claims. |
| POST | `/api/owner/payments/:id/confirm` | owner | Confirm → tenant `active`, `paidAt=now`, `renewalDate=+30d`, start container, email customer. |
| POST | `/api/owner/payments/:id/reject` | owner | Reject → `rejected`, email customer. |
| GET/PUT | `/api/owner/settings/payment` | owner | Read/update bKash/Nagad numbers + owner notify email + WhatsApp. |

---

## 9. Critical fixes (must land first)

1. **Revenue leak.** Today `selectCustomerPlan` sets `subscriptionStatus: "active"` the
   instant a customer picks a paid plan ([server.js:4273](../server.js)), with
   `paymentStatus: "pending"` — service goes live before any payment. Verified live.
   Fix: paid plan → `pending_payment`; only owner-confirm flips to `active`.
2. **Renewal date.** `selectCustomerPlan` sets `renewalDate` to next month-start
   ([server.js:4264](../server.js)). Change to `paidAt + 30 days`, set at confirm time.
3. **Latent auth.** `config.customerPassword` referenced ([server.js:390](../server.js))
   but never defined in `config`; customer login only works because owner `AUTH_PASSWORD`
   is set. Define it or rewrite the guard to "customer accounts exist".

---

## 10. Build phases

- **Phase 1 — Manual payment loop + leak fix. ✅ DONE 2026-06-27.** Leak fixed
  (`selectCustomerPlan` paid → `pending_payment`, never `active`); signup now starts Free
  (15K); `payments[]` model + `settings.payment`; generic `sendEmail` + owner-notify +
  activation + rejection emails; customer billing view payment panel + claim form
  (`GET /api/customer/billing`, `POST /api/customer/payment-claim`); owner Payments queue
  + confirm/reject + payment-settings form (`/api/admin/payments`, `/api/admin/payments/:id/{confirm,reject}`,
  `/api/admin/settings/payment`). Confirm → active + paid limits + renewal `paidAt+30d` +
  container start + customer email. Duplicate txn blocked (409). Verified end-to-end (UI + API).
  Asset bump app.js?v=30, styles.css?v=18.
- **Phase 2 — Free-tier cycle + enforcement. ✅ DONE 2026-06-27.** Rolling 30-day cycle
  per Free tenant (`cycleStart`/`cycleEnd`/`cycleBaseline`/`cycleNudge`/`cappedAt`);
  escalating nudges at 10K/12K/13K/14K (one per threshold per cycle, deduped via
  `cycleNudge`), each email shows events used/limit + purchases & revenue this cycle;
  hard cap at 15K → `free_capped` + container stop + "paused" email; cycle rollover
  resumes container + flips to `free`. Runs in `enforceFreeTierUsage(data)` from the
  `persistDailySummary` tick (every 10 min). Verified: nudge tiers, cap+stop, rollover.
- **Phase 3 — Full email system.** Generalize `sendEmail`; all templates in §6.
- **Phase 4 — Renewal + dunning. ✅ DONE 2026-06-27.** `enforcePaidRenewals(data)` in the
  `persistDailySummary` tick: T-7/T-3/T-1 reminders (deduped via `renewalReminder`, show
  plan+amount+bKash/Nagad numbers); past `renewalDate` → `overdue` (grace, container runs)
  + email; overdue + `RENEWAL_GRACE_DAYS` (7) → `expired` + stop container + email.
  `confirmPayment` resets reminder/overdue/expired flags so a renewal resumes service.
  Verified: T-3 reminder, overdue, expiry+suspend.
- **Phase 5 — Landing polish. ~PARTLY DONE 2026-06-27.** Hero rewritten signal-recovery /
  Brave-bypass moat-forward; badge "Brave & ad-blocker proof"; pricing footer = manual
  bKash/Nagad reality (no card). Welcome email on signup added (Phase 3 remainder).
  STILL TODO (needs owner-supplied real content): replace fabricated testimonial
  ("Rafiqul Islam") + "A/B/C/D" social-proof avatars + unverified +31%/+58% stats with
  real customer quotes/logos (Shobaz, amolbooks); guided signup→onboarding handoff.
- **Later — WhatsApp automation.** Needs license + WhatsApp Business API (issue #3).

---

## Open issues (decide before / during Phase 1)

1. ~~**Pricing mismatch.**~~ **RESOLVED 2026-06-27.** Public tiers now Free/Starter ৳1,200/
   Pro ৳2,900/Enterprise ৳5,900 (PixelFly-aligned) across landing pricing cards, comparison
   "starting price" row, meta description, and owner plan dropdowns. Server `planMonthlyAmounts`
   already matched; `planResourceProfiles` container limits fixed (Pro→3, Enterprise→10).
2. **`pending_payment` container behavior.** While a Free user has submitted a claim but
   owner hasn't confirmed: keep them on Free limits (15K) so they can't get paid volume
   for free, OR temporarily lift the cap on good faith? Recommend: stay on Free limits.
3. **WhatsApp:** manual `wa.me` links now; automated only after licensing.
