# Quarry — Licensing & Client Ops — Design Spec

_Prepared 2026-07-08. Build-facing companion to `business/BUSINESS-PLAN-ASSESSMENT.md`._

---

## 0. The shape of it (why this stays simple)

You don't want live monitoring — you want two lightweight things:

1. **Last-month usage** per client.
2. **A nudge when a client needs something** — detected from **your email inbox**, not from the app.

The important consequence: **the app never phones home. Client-ops lives entirely outside the app.**

| Need | Where it comes from | Touches client data? |
|---|---|---|
| Monthly usage | **Anthropic Console** (per-workspace usage) | No — token counts only |
| "Client needs something / wants a call" | **Your own email inbox** | No — it's *your* mail |

Because the app has **no telemetry channel at all**, the privacy promise ("we never see your data") is airtight for free — there is nothing to leak, no allowlist to police, no backend to secure. The app stays **100% backendless.** This is the cleanest possible version.

---

## 1. Licensing (offline signed keys — the final design, not a phase)

Since nothing phones home, licensing is fully **offline** and that's the end state, not a v1.

### 1.1 License token

A compact, **signed** token the app verifies locally.

- **Signature:** Ed25519. You hold the private key; the app embeds the **public** key and verifies offline. (libsodium / tweetnacl.)
- **Claims:**

```json
{
  "client_id": "acme-dental",
  "key_id": "k_2026_07_a1",
  "plan": "monthly",              // "report" | "monthly" | "credits"
  "quota": 100,                   // analyses per period, or total credits
  "period": "monthly",            // "monthly" | "one_time"
  "features": ["offline_mode", "branding"],
  "issued_at": "2026-07-01T00:00:00Z",
  "expires_at": "2026-08-01T00:00:00Z"
}
```

- **Enforcement (per analysis):** verify signature → not expired → quota remaining → run → decrement a locally-persisted counter.
- **Tamper stance:** casual copy-protection is enough for SMB. Sign the local counter so it can't be trivially reset; don't over-engineer — the real financial backstop is the per-client spend cap (§1.4).
- **Issuing keys:** you generate a token per client by hand (a tiny CLI/script that signs the JSON). Renewal = issue a fresh token, emailed to the client, valid for the new period.

### 1.2 What counts as "one analysis"

- **1 analysis = one user-initiated natural-language question** — regardless of how many `run_sql`/tool calls it makes underneath. ("You asked 40 questions this month" is the sentence the client understands.)
- Each new user question = 1 analysis.
- **Does NOT consume a credit:** re-rendering a chart, exporting, browsing rows, retrying, or **a failed analysis** (auto-refund).
- **Cost guard:** cap tokens / tool-loop depth *per analysis* so one runaway question can't blow the economics.

### 1.3 Quota mechanics

- **Monthly quota** (core, recurring): counter resets each period. At zero → **soft cap + notify** ("you're over — let's talk"), never hard-block mid-decision.
- **Credit pack** (one-off / top-up): decrement a total; at zero → prompt to buy more.
- The soft cap is safe because the workspace spend cap (next) is the real money-stop.

### 1.4 Anthropic workspace spend cap

- Each client gets their own Anthropic **workspace** (or scoped key) with a hard **monthly USD cap** ≈ **3× expected token cost**.
- Worst case (leaked/abused key) is bounded to **that one client's cap** — not your whole account.
- **Bonus:** the same per-workspace split is exactly what gives you §2's monthly usage for free.

---

## 2. Client ops (the two lightweight pieces)

### 2.1 Monthly usage — from the Anthropic Console (≈$0)

If **one client = one workspace/key**, the Console already reports each client's monthly token usage. Once a month you read it. That's the whole feature at Stage 0.

Optional later: a small script hits the Anthropic usage/billing API, pulls per-workspace totals, and prints a one-line-per-client summary (analyses ≈ derived from your own counters or token totals, cost, margin). Nice-to-have, not needed to start.

### 2.2 The "client needs something" notifier — from your email

The client reaching out **is** the signal. Watch your inbox, match the sender against your client list, and surface what they need (a request, a question, a renewal, a **call/meeting** ask). Three effort tiers:

| Tier | What | Effort | Good for |
|---|---|---|---|
| **0 — Filters** | Gmail filters auto-label mail from known client addresses into a `Clients` label + star it. You scan the label. | Zero build | Right now |
| **1 — Scheduled digest** ✅ | A scheduled agent reads your inbox each morning, matches senders to your client list, and sends you a short digest: _"Needs attention: Acme asked for Q3 report (2d, unanswered); Beta wants a call Thu 2pm; Gamma renewal due Fri."_ Flags explicit call/meeting requests. | Small | The sweet spot — matches your vision |
| **2 — Instant** | Trigger on each new mail → classify → push a notification. | More infra | Overkill for a solo book |

**Recommended: Tier 1** — a once-a-day (or on-demand) agent that produces a "who needs what + upcoming calls + renewals due" digest, plus the monthly usage line pulled from §2.1. This reads *your* mail only, so it has zero bearing on the privacy promise.

Implementation options for Tier 1: a scheduled cloud agent / cron routine that has read access to your Gmail (via connector or an app password), cross-references a simple `clients.json` (name, email, plan, renewal date), and emails/DMs you the digest. Renewal reminders fall out of the same client list for free.

---

## 3. What to build first

1. **Now:** ship the app with **offline signed-key licensing** (§1) + **per-client capped workspaces** (§1.4). Run **Tier-0 email filters** and read Console usage monthly. Zero backend, first clients served safely.
2. **When the inbox gets busy:** stand up the **Tier-1 email digest** (§2.2) — the single highest-value ops piece, because it's what stops a client request from slipping through the cracks.
3. **Only if it ever pays off:** the small usage-summary script (§2.1). Most solo operators never need more than this.

No app telemetry, no control-plane backend, no CRM to build. The whole "client ops" layer is: **offline keys + Console usage + an email digest.**

---

## 4. Tech notes (light)

- **App wrapper:** Tauri (smaller, safer) or Electron — wraps the existing HTML/JS as-is. Stays fully offline.
- **Signing:** Ed25519 via libsodium / tweetnacl; public key embedded in the app; a tiny signing script on your side to mint tokens.
- **Email digest:** a scheduled agent with read access to your Gmail + a `clients.json` list. No database required — the inbox and the client file are the whole data model.
- **Off-the-shelf if you ever want more:** Stripe (billing), Cal.com (scheduling). Don't build these.
