# Quarry — Business Plan & Assessment

_Prepared 2026-07-08. Grounded in a review of the actual codebase plus current Claude API pricing/limits._

---

## 1. What Quarry actually is (verified from the code)

Quarry is a **single-file, client-side "AI data analyst."** Everything runs in the browser/app — there is no backend.

**Confirmed architecture:**
- **Delivery today:** one standalone HTML file (~1.2 MB) + `support.js` runtime. No server, no database, no accounts.
- **Data engine:** `sql.js` (SQLite compiled to WASM). The user opens a local `.db`/`.sqlite` file; it loads into memory. Sample data is a small e-commerce SQLite dump (`customers`, `products`, `orders`, `order_items`).
- **The "analyst":** an LLM agent (system prompt: _"You are Quarry, a data analyst assistant…"_) with 5 tools:
  - `run_sql` — read-only SQLite queries
  - `show_table` — render results in the data panel
  - `create_chart` — Chart.js visualizations
  - `show_transformation` — **audit trail**: shows raw source rows + the aggregation query behind any SUM/COUNT/AVG (the best feature — see §4)
  - `export_charts` — export to **PNG, Word, and PowerPoint** (pptxgenjs)
- **Models:** built-in Claude only works inside Claude's own environment (`window.claude.complete`); for true standalone use it's **bring-your-own-API-key** (Anthropic, OpenAI, Groq, Ollama), stored in `localStorage`.
- **Version:** v0.1.

**One line:** _Open your business data, ask questions in plain English, get audited tables + charts you can drop straight into PowerPoint._

---

## 2. The honest verdict

| Question | Answer |
|---|---|
| Is it a working, polished tool? | **Yes.** UX, the audit feature, and PPT/Word export are genuinely above demo quality. |
| Is it a defensible SaaS *product* on its own? | **Not as generic text-to-SQL** — that category is saturated and the code has no moat. **But** the privacy-first packaging (below) gives it a real, defensible wedge. |
| Is it a viable side-income business? | **Yes** — as a **privacy-first, downloadable data-analysis app** sold to local/SMB businesses, with light services around it. |

**Do not** pitch this as "a generic AI-analytics SaaS." **Do** build it as **"the analytics app where your data never leaves your computer,"** sold to businesses that can't justify a full-time analyst.

---

## 3. Market reality

**Text-to-SQL / "chat with your data" is saturated** — ChatGPT/Claude file uploads, Julius, Hex, Vanna, plus every BI vendor (Power BI Copilot, Tableau Pulse, Snowflake Cortex) shipping native NL query. Competing there as generic SaaS needs a wedge and a war chest.

**Two things give Quarry a wedge the big players can't easily copy:**
1. **Privacy by architecture.** No backend means there is nothing on your side to breach. Cloud BI and ChatGPT literally cannot claim "your data never leaves your machine." This is the moat — not the code.
2. **The underserved SMB gap.** Clinics, agencies, studios, restaurants, small e-commerce have data but can't justify a $60k–$120k/yr analyst and find Power BI/Tableau too complex. They want *answers*, cheaply, without shipping sensitive data to a cloud.

---

## 4. Genuine strengths (assets to lean on)

1. **The audit feature (`show_transformation`) is a real trust differentiator.** Most AI-analytics tools hide the math; Quarry shows the raw rows *and* the query behind every number. For a business owner spending real money on a decision, "here's exactly how I got this" is the whole ballgame. **Centerpiece of the pitch.**
2. **Native PowerPoint / Word export.** The last mile of analytics is a deliverable someone can show their boss. Quarry produces that automatically.
3. **Privacy story = moat.** No backend, no data-hosting liability, and (with local-model mode) a genuine "nothing leaves the building" option for regulated clients.
4. **Fast per-client customization.** Because it's simple, you can brand it, wire it to a client's schema, and add canned questions in hours. That customizability *is* the product.

---

## 5. The operating model (chosen)

**A downloadable, privacy-first desktop app that the client runs on their own machine.**

- **Delivery:** ship as a desktop app (wrap the existing HTML/JS in Tauri or Electron). This escapes browser limits, lets you connect to a client's live database later (kills the SQLite-only ceiling), makes offline-LLM mode and licensing cleaner, and "feels like real software."
- **The brain:** you supply a **managed Claude API key** (marked up in the price) so the client has **no AI account to set up**. For sensitive/regulated clients, a **fully offline (local-LLM) backdoor** means nothing leaves the machine at all. Both are selling features.
- **Where the analysis happens:** on the client's computer. Their raw data file never touches you (you have no server). With the cloud brain, only the **schema + query results** reach the AI provider — never your servers; with offline mode, nothing leaves. _State this precisely; regulated buyers will ask._
- **Your involvement:** leveraged, not full-time. You set up/brand the app, deliver a monthly report, and answer ad-hoc questions. You are a vendor delivering answers, not headcount inside the client.

### Honest privacy wording (use verbatim)
> "We never see your data — there's no server on our side. With cloud AI, only your question and its results reach the AI provider, never us, and never used to train anything. For sensitive data, offline mode sends nothing at all."

---

## 6. Monetization & licensing

**Meter in "analyses," sold as a monthly quota** (maps to recurring revenue). One analysis = one plain-English question-and-answer session, however many SQL queries it runs underneath — the unit a non-technical client understands.

**Licensing mechanics (decided):**
- **No per-session email codes.** That was rejected: it creates client friction (they'd stop using it) and turns you into a human license server. On launch the app just opens and a session starts.
- **Signed license keys verified offline.** The app checks a cryptographically signed token (encodes plan, quota, expiry) with no backend call for data — keeps you genuinely backendless. Sold as a **credit pack** (e.g. 100 analyses) or a **monthly license** (unlimited-for-30-days or a monthly quota). Monthly license is the core, recurring product.

**Pricing tiers:**
1. **Insight Report** — one-off, **$300–$900.** A deep-dive report answering the client's top 5 questions. Easy first sale / portfolio builder.
2. **Monthly Partner** — **$300–$1,200/mo.** Ongoing monthly reporting + ask-me-anything. **The core of the business.**
3. **Custom Setup** — **from $1,500.** A branded Quarry configured on the client's data/schema and handed to their team.

---

## 7. Usage limiting & unit economics

**Nothing is "baked in" to protect you — the Claude API is pay-per-token.** You must set limits. Two layers:

- **Layer 1 — Anthropic guardrails (hard backstop):** automatic rate limits (protect against runaway loops/bursts) + a configurable **monthly spend cap** in the Console. If you issue a **per-client workspace key with its own cap**, a leaked/abused key can only burn *that client's* cap — bounded blast radius.
- **Layer 2 — your per-client meter:** Anthropic won't meter per customer; you count **analyses** and enforce the quota via the signed license.

**Current Claude pricing (per 1M tokens):**

| Model | Input | Output | Role |
|---|---|---|---|
| Haiku 4.5 (`claude-haiku-4-5`) | $1 | $5 | Cheap mode, simple questions |
| Sonnet 5 (`claude-sonnet-5`) | $3 ($2 intro) | $15 ($10 intro) | **Default brain** |
| Opus 4.8 (`claude-opus-4-8`) | $5 | $25 | Overkill here — skip |

**Cost per analysis ≈ 5¢–50¢ on Sonnet** (less on Haiku), and **prompt caching cuts the repeated schema/prompt cost ~90%** across a multi-step session. So a **100-analyses/month** client costs you roughly **$5–$50** in tokens against a $300–$1,200 price — margin can't invert even in a heavy month. Set a generous quota, cap the client's workspace at ~3× expected cost as the backstop, and the client never feels rationed.

**Housekeeping:** the app's model dropdown still references `claude-sonnet-4-5`; update to `claude-sonnet-5` (and keep `claude-haiku-4-5`) so you're on the latest, best-value tier, and turn prompt caching on.

---

## 8. Real gaps & risks (so nothing bites you)

| Gap | Why it matters | Fix path |
|---|---|---|
| **SQLite files only** | Real businesses run Postgres/MySQL/Shopify/QuickBooks — live, not static files. | The desktop move enables direct DB connections; near-term, do a per-client export → SQLite snapshot. |
| **In-browser/WASM SQLite size ceiling** | Fine for hundreds of MB; breaks on warehouse volumes. | Fine for SMB; know the ceiling, don't chase clients past it. |
| **"Data never leaves" is only fully true offline** | Cloud brain still sends schema + query results to the AI provider. | Use the precise wording in §5; offer offline mode for regulated clients. |
| **License enforcement without a backend** | Signed keys can in theory be shared/cracked. | Casual copy-protection is enough for SMB; per-client capped workspace keys bound the downside. |
| **No moat in the code** | Replicable in a weekend. | Moat = privacy positioning + client relationships + delivery speed, not the code. |
| **Desktop distribution overhead** | Code-signing, Mac notarization, auto-updates, cross-platform builds. | Budget for it; Tauri/Electron wrapping of the existing app is the easy part. |

---

## 9. Honest income expectation (no hype)

- **Months 1–3:** likely $0–$1,000 total. This is now a **sales** problem, not a product problem. First 2–3 clients are the hard part.
- **Months 4–9:** 3–5 retainer clients realistic with consistent outreach → **~$1.5k–$2.5k/mo**.
- **Solo side-gig ceiling:** ~$3k–$5k/mo before your time is the bottleneck. Past that: subcontract or lean harder on the self-serve product.

Won't buy the apartment next quarter; can become a real, compounding second income that changes the timeline — if the next 90 days are treated as sales, not build.

---

## 10. The single most important recommendation

**The product is good enough to earn. Stop building, start selling.** Every hour on features before a paying client is an hour avoiding the hard part: talking to businesses.

**Next 90 days:**
1. Pick **one vertical** you understand (recommended: **local service businesses** — clinics, agencies, studios, restaurants).
2. Do **3 free/cheap pilot reports** for real businesses in exchange for a testimonial + case study.
3. Turn those into a **1-page offer** and a repeatable pitch.
4. Convert pilots → paid monthly retainers. Repeat outreach.

**Build track (in parallel, only as far as sales require):** wrap in Tauri/Electron → add signed-key licensing (credit pack + monthly quota) → managed brain with per-client workspace cap → offline-LLM toggle for sensitive clients. Update model IDs and enable prompt caching along the way.

Deliverables so far: this plan (`business/BUSINESS-PLAN-ASSESSMENT.md`) and the client sales deck (`business/Quarry-Sales-Deck.pptx`).
