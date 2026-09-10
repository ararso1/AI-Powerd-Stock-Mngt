# Csolve — AI-Powered Stock Management  
## Coffee Industry Upgrade Plan

**Product name:** Csolve (AI-Powered Stock Management)  
**Status:** Implementation plan  
**Date:** 2026-09-09  
**Baseline:** NestJS API (`stock-api`) + Next.js UI (`stock-frontend`) — currently branded “Stock Manager”  
**Goal:** Specialize the platform for coffee exporters and the local roasted-coffee market: **track every step**, deliver **real-time insights & executive analytics**, and ship a **coffee-branded Csolve UI**.

---

## 0. Product identity

| Item | Value |
|------|--------|
| **Name** | **Csolve** |
| **Tagline** | AI-Powered Stock Management for Coffee |
| **Markets** | Green coffee export + local roasted coffee |
| **Promise** | End-to-end control and traceability — collection → process → store → roast/sale/export — with AI decision support for executives and operators |

### Brand color system (UI)

Coffee-forward palette (replace current Frappe blue `#2490ef` and generic “Stock Manager” chrome):

| Token | Hex (approx.) | Use |
|-------|----------------|-----|
| `--csolve-espresso` | `#3C2415` | Sidebar, headings, primary dark |
| `--csolve-roast` | `#6F4E37` | Primary actions, active nav |
| `--csolve-bean` | `#8B5E3C` | Accents, charts series 1 |
| `--csolve-caramel` | `#C4A484` | Soft accents, tags |
| `--csolve-cream` | `#F5F0E8` | App background / desk |
| `--csolve-parchment` | `#FFFBF5` | Cards / surfaces |
| `--csolve-leaf` | `#4A7C59` | Success, QC pass |
| `--csolve-cherry` | `#A63D2F` | Alerts, QC fail, destructive |

**UI principles for Csolve**

- Brand-first shell: logo wordmark **Csolve** + short subtitle “Coffee stock · AI”  
- Warm cream desk (not grey ERP desk); espresso sidebar  
- Expressive typography (keep Plus Jakarta or pair with a distinctive display for login/exec)  
- Executive Command Center as a first-class surface (not a dense dashboard of cards)  
- Motion: subtle page enter, KPI count-up, lot timeline reveal (2–3 intentional motions)  
- Avoid default purple AI look; coffee browns + cream only

---

## 1. Existing functionality (as-is)

What the system **already does today** — reuse, do not rebuild.

### 1.1 Access & platform

| Feature | Notes |
|---------|--------|
| JWT login + refresh tokens | Nest auth; Next.js auth context |
| Dynamic roles & permissions | Nav filtered by `/auth/me` |
| Users / roles admin UI | Create, edit, permission picker |
| Health endpoint | `/api/health` |
| Seeded admin + Cash/Bank accounts | `DB_SEED` |

### 1.2 Master data & inventory

| Feature | Notes |
|---------|--------|
| Locations | Types exist (warehouse/showroom-style); multi-location stock |
| Items | SKU, description, unit, `itemType` RAW / SEMI / FINISHED / OTHER |
| Inventory CRUD | Per location quantity, purchase price, reorder point |
| Excel bulk import | Inventory |
| Audited stock adjustments | Reason codes; quantity not via PATCH |
| Low-stock list + notifications | Reorder-point driven |
| Stock transfers | Between locations; void supported |
| BOM + production orders | `release → issue → complete`; material issue / FG receipt |

### 1.3 Commercial & finance

| Feature | Notes |
|---------|--------|
| Suppliers & customers | Soft delete; CRUD |
| Purchases | Cash / bank / credit; line items; PATCH reconcile; void |
| Sales | Same + commissions |
| Credits | Customer/supplier balances, payments, due dates |
| Expenses | Categories; bank link; reverse on delete |
| Bank accounts & transactions | Direction in/out; balances |
| Atomic DB transactions | Purchases, sales, transfers, expenses, credit payments |

### 1.4 Insights today (limited)

| Feature | Notes |
|---------|--------|
| Dashboard | Inventory value by location, daily sales/purchases, P&L slice, liquidity |
| Profit & Loss | Optional date range |
| Reports | Summary, sales-by-item, inventory aging, customer/supplier activity, cash flow |
| In-app notifications | Bell + list (incl. low stock) |

### 1.5 UI today (gap)

| Current | Gap for Csolve |
|---------|----------------|
| Brand: “Stock Manager” + Command icon | No coffee identity |
| Theme: Frappe blue + generic shadcn neutrals | Not coffee-branded |
| ERP-style desk forms | Functional but weak visual hierarchy |
| Dashboard = operational cards | Not an executive Command Center |
| No lot timeline / step tracker | Cannot show full coffee journey |
| Charts present (Recharts) but underused for exec story | Need real-time + decision-support framing |

### 1.6 What is **not** built yet (coffee / AI / exec)

- Lot / batch identity and merge-split  
- Cherry collection / farmer intake tickets  
- Coffee forms (cherry → parchment → green → roasted → packaged)  
- QC gates, moisture, cupping, certifications on lots  
- Export contracts, packing lists, document checklists  
- Roast profiles & lot-based blends beyond generic BOM  
- Step-by-step event timeline (append-only audit of every movement)  
- Real-time / near-real-time executive analytics hub  
- AI recommendations (forecast, blend, pricing, export readiness)  
- Csolve branding and coffee design system  

---

## 2. Target outcomes

1. **Every step tracked** — immutable lot events from farm intake to cup or container.  
2. **Real-time insights** — live KPIs, alerts, and operational pulse for managers.  
3. **Executive decision support** — board-ready analytics, scenarios, and AI recommendations with human confirm.  
4. **Dual market** — exporters and local roasted sales on one stack.  
5. **Csolve UI** — coffee brand, clearer IA, Command Center for executives.

---

## 3. Coffee domain (brief)

```
Cherry → Parchment → Green → Roasted → Packaged
              ↘ Reject / waste
```

**Lot** = atomic traceability unit (origin, crop year, process method, grade, moisture, certs, parent/child).  
**Rule:** Every stock movement that changes form or ownership creates/references a lot event.

Location types to add: `COLLECTION_CENTER`, `WET_MILL`, `DRY_MILL`, `WAREHOUSE`, `ROASTERY`, `SHOWROOM`, `EXPORT_STAGING`.

Full chain:

```
Farmers → Collection → Wet/Dry process + QC → Warehouse
              ├→ Roastery → Local sales
              └→ Export contract → Pack → Ship → Docs
```

---

## 4. Clear plan — numbered steps

Work in this order. Each step has **deliverables**, **tracking**, and **insights** impact.

---

### Step 1 — Brand & foundation (Csolve UI shell)  
**Status:** In progress (shell + tokens shipped in `stock-frontend`)  
**Duration:** ~1–2 weeks · **Depends on:** nothing  

**Why first:** Product identity and design tokens unlock every later screen; executives see Csolve immediately.

| Deliverable | Detail |
|-------------|--------|
| Rename product | “Stock Manager” → **Csolve** (sidebar, login, titles, emails, README) |
| Design tokens | Replace `--frappe-*` with `--csolve-*` coffee palette in `globals.css` |
| Login + shell | Espresso/cream composition; brand-first login; wordmark logo |
| Nav IA | Group: Operations · Coffee chain · Finance · **Insights** · Admin |
| Empty states & tables | Consistent density, coffee accent for primary CTAs |

**Tracking:** N/A (foundation).  
**Insights:** Visual shell for future Command Center.

**Exit criteria:** App looks and reads as Csolve; primary actions use roast brown; cream desk background.

---

### Step 2 — Lot model & step event ledger  
**Status:** Implemented (API + Lots UI + demo seed)  
**Duration:** ~2–3 weeks · **Depends on:** Step 1 (can parallel schema)  

**Why:** Without lots + events, “track every step” is impossible.

| Deliverable | Detail |
|-------------|--------|
| Entities | `Lot`, `LotEvent` (append-only), optional `LotDocument` |
| APIs | CRUD lots; split/merge; `GET /lots/:id/timeline` |
| Stock link | Inventory movements optionally/required lotId for coffee items |
| UI | Lot list + **Lot timeline** (vertical step tracker) |
| Permissions | `lot.read`, `lot.write`, `lot.split` |

**Event types (minimum):** `CREATED`, `COLLECTED`, `TRANSFERRED`, `PROCESS_STARTED`, `PROCESS_COMPLETED`, `QC_HELD`, `QC_RELEASED`, `ADJUSTED`, `SPLIT`, `MERGED`, `ROASTED`, `PACKAGED`, `SOLD_LOCAL`, `ALLOCATED_EXPORT`, `SHIPPED`, `VOIDED`.

**Tracking:** Every later module writes `LotEvent`.  
**Insights:** Timeline feeds traceability reports and AI quality risk.

**Exit criteria:** Create a lot, move stock, see ordered timeline; PDF/QR stub optional.

---

### Step 3 — Collection (cherry intake)  
**Status:** Implemented (API + UI + price table seed)  
**Duration:** ~2 weeks · **Depends on:** Step 2  

| Deliverable | Detail |
|-------------|--------|
| Collection ticket | Farmer/supplier, weight, grade, price/kg, location, payment |
| Transaction | One DB txn: ticket + purchase + lot + stock + `COLLECTED` event |
| UI | `/collections/new` Frappe-style form; receipt with lot code |
| Price tables | Optional seasonal grade price list |

**Tracking:** First real farm-side step on the timeline.  
**Insights:** Intake volume/day KPI; cost/kg foundation.

**Exit criteria:** Intake creates purchasable stock and a visible lot timeline entry.

---

### Step 4 — Processing, QC gates & yield  
**Status:** Implemented (templates, process runs, QC, yield + UI)  
**Duration:** ~3 weeks · **Depends on:** Steps 2–3  

| Deliverable | Detail |
|-------------|--------|
| Process templates | BOM-like: input form → expected yield % |
| Process run | Wraps/extends production order; stages checklist |
| QC | Moisture, defects, cupping score; hold until pass |
| Yield capture | Actual vs standard; rejects → adjustment events |
| Cost roll-up | Cherry + process cost → green cost/kg |

**Tracking:** `PROCESS_*` + `QC_*` events; cannot skip QC if policy enabled.  
**Insights:** Yield anomaly flags (rule-based precursor to AI).

**Exit criteria:** Cherry lot becomes green lot with QC history and yield recorded.

---

### Step 5 — Lot-aware warehouse & transfers  
**Duration:** ~2 weeks · **Depends on:** Step 2  

| Deliverable | Detail |
|-------------|--------|
| Inventory UI | Filter by lot, form, crop year, grade |
| Transfers | Must carry lot; emit `TRANSFERRED` |
| Adjustments | Coffee reasons: moisture loss, shrinkage, QC reject |
| Aging | Crop-year / days-in-warehouse on reports |

**Tracking:** Storage steps always lot-linked.  
**Insights:** Green cover days; aging risk list.

**Exit criteria:** 100% of coffee stock rows show lot; transfers refuse lot-less coffee.

---

### Step 6 — Dual market: roast/local + export  
**Duration:** ~4–6 weeks · **Depends on:** Steps 4–5  

**A — Local roasted market**

- Roast profiles; blend BOM from lots  
- Package SKUs + roast date / best-before  
- Local sales channels; freshness alerts  
- Events: `ROASTED`, `PACKAGED`, `SOLD_LOCAL`

**B — Export pipeline**

- Export contracts (volume, grade, price, window, Incoterms)  
- Lot allocation → packing list → doc checklist  
- Status: draft → allocated → staged → shipped → closed  
- Multi-currency (USD) sale path + bank receipt  
- Events: `ALLOCATED_EXPORT`, `SHIPPED`

**Tracking:** Full branch from warehouse to cup or container.  
**Insights:** Channel mix (local vs export); contract fill %; dossier completeness.

**Exit criteria:** Same green lot can go to roast sale or export shipment with unbroken timeline.

---

### Step 7 — Real-time Insights & Executive Command Center  
**Duration:** ~3–4 weeks · **Depends on:** Steps 2–6 (MVP after Step 5 possible)  

**Product:** Csolve **Command Center** (`/insights` or elevate `/dashboard`) for executives.

| Layer | Content |
|-------|---------|
| **Pulse (near real-time)** | Today’s intake kg, process WIP, green stock, roast output, local sales, export staged; open alerts |
| **Traceability health** | % movements lot-linked; lots on QC hold; unexplained shrinkage |
| **Commercial** | Revenue local vs export; margin; credit exposure; liquidity |
| **Contracts & risk** | Open contracts vs allocated kg; ship window risk; missing docs |
| **Decision support** | Recommended actions (rules first): “Allocate Lot X to Contract Y”, “Prioritize sale of Lot Z (moisture risk)” |
| **Drill-down** | Click KPI → filtered lots / sales / collections |

**Technical**

- Aggregates via SQL views / materialized views; refresh every N minutes or on transaction hooks  
- Optional WebSocket or short polling for Pulse strip  
- Permissions: `insights.read`, `insights.exec`  
- Export: PDF/Excel executive pack

**Tracking:** Command Center reads the event ledger + finance facts — single source of truth.  
**Insights:** This step **is** the executive analytics delivery.

**Exit criteria:** Executives see one screen answering: *Where is the coffee? Is quality OK? Are we covering contracts? Are we making money?*

---

### Step 8 — AI decision support  
**Duration:** ~6–10 weeks · **Depends on:** Step 7 + enough history  

AI **recommends only**; humans confirm stock/money actions.

| Module | Decision support |
|--------|------------------|
| Demand forecast | Roast calendar & intake planning |
| Intake / purchase advice | Volume & timing vs contracts |
| Yield & process anomaly | Flag mills/lots off pattern |
| Blend optimizer | Lot % for cost + cupping targets |
| Pricing assistant | Local & export bands from cost stack |
| Export readiness score | Docs + allocation + window |
| Quality risk | Spoilage / downgrade priority |
| NL ops (later) | “Show lots at risk this week” |

**Architecture:** Postgres → features/jobs → `stock-ai` or Nest `/api/ai/*` → UI insight cards + accept/reject feedback.

**Phased AI:** A rules → B forecast → C blend/pricing → D NL + anomalies.

**Exit criteria:** At least forecast + export readiness + quality risk live with feedback logging.

---

### Step 9 — Field scale & polish  
**Duration:** ongoing  

- Mobile / PWA collection  
- Scale CSV / weighbridge import  
- Lab CSV import  
- Offline intake (if required)  
- Multi-tenant cooperatives (if required)  
- Continuous UI polish & accessibility  

---

## 5. Step tracker (product capability)

How “track every step” shows up in the product:

| Surface | Purpose |
|---------|---------|
| **Lot timeline** | Vertical stepper of all `LotEvent`s with user, time, qty, from→to |
| **Process stage board** | Kanban or checklist per mill run |
| **Export pipeline board** | Contract stages with blockers |
| **Trace search** | Query by lot code, bag/QR, invoice, container → full chain |
| **Audit export** | PDF dossier for buyer / regulator |

Operators never lose the thread; executives see % complete and stuck steps on the Command Center.

---

## 6. Analytics & decision-support reports

### 6.1 Real-time / operational

- Intake today vs 7-day avg  
- WIP by process stage  
- QC hold count & aging  
- Green kg by grade / warehouse  
- Low stock & moisture risk lots  

### 6.2 Executive pack (scheduled + on-demand)

| Report | Questions answered |
|--------|-------------------|
| Coffee P&L by channel | Local roast vs export profitability |
| Lot P&L | Cost stack → margin per lot |
| Contract coverage | Committed vs allocated vs shipped |
| Traceability compliance | % lot-linked; gaps |
| Yield & shrinkage | Mill efficiency; unexplained loss |
| Working capital | Inventory value, credits, liquidity |
| AI action summary | Top recommendations accepted/rejected |

Extend existing `/reports/*`; add `/insights/exec-summary`.

---

## 7. Technical mapping (reuse current stack)

| Area | Approach |
|------|----------|
| Backend | New modules on Nest; migrations; keep transactional patterns |
| Frontend | Next.js app routes; new nav under Csolve shell |
| Events | Append-only `lot_events`; never edit history |
| Insights | Views + jobs; Recharts on Command Center |
| AI | Separate service later; Nest proxy `/api/ai` |
| Brand | CSS variables `--csolve-*`; replace frappe tokens |

**New entities (core):** `Lot`, `LotEvent`, `CollectionTicket`, `QcResult`, `ProcessRun`, `ExportContract`, `ExportShipment`, `RoastProfile`, `AiInsight`, `AiFeedback`.

**Extend:** Item, Location, Sale, Purchase, ProductionOrder, StockTransfer, StockAdjustment.

---

## 8. Suggested delivery sequence (summary)

```
Step 1  Csolve brand + UI shell
Step 2  Lots + event ledger + timeline UI
Step 3  Collection / farmer intake
Step 4  Processing + QC + yield
Step 5  Lot-aware warehouse & transfers
Step 6  Roast/local sales + export pipeline
Step 7  Executive Command Center + real-time insights
Step 8  AI decision support
Step 9  Field scale & integrations
```

**Parallelism:** Steps 1 and 2 can start together. Step 7 MVP (rules + KPIs) can begin after Step 5; full dual-market KPIs after Step 6.

---

## 9. Success metrics

| Metric | Target |
|--------|--------|
| Coffee stock movements with lot + event | → 100% |
| Time to answer “farm → container/cup” | Seconds via Trace search |
| Executives using Command Center weekly | Adoption tracked |
| Time to assemble export dossier | ↓ |
| Unexplained shrinkage | ↓ |
| Forecast / suggestion accept rate | Track & improve |
| Brand consistency (Csolve tokens on primary UI) | 100% of shell |

---

## 10. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| UI rewrite delays domain work | Step 1 is shell/tokens only — not a full redesign of every form |
| Over-building AI early | Steps 2–7 first; AI is Step 8 |
| Event spam / performance | Index lot_id + created_at; materialize balances |
| Farmer PII in AI | Local inference / redaction; no third-party without consent |
| Team capacity | Ship Steps 1–3 as first release (“Csolve Trace”) |

---

## 11. Open decisions (resolve before Step 2 build)

1. Lot vs bag granularity (recommend **lot-level** first).  
2. Single company vs multi-tenant.  
3. Export docs: upload checklist first vs generate PDFs.  
4. AI host: Nest jobs vs Python service.  
5. Offline collection: required in first year?  

---

## 12. Follow-up docs

| Doc | Purpose |
|-----|---------|
| `docs/CSOLVE_BRAND_UI.md` | Tokens, logo, component rules |
| `docs/COFFEE_DOMAIN_MODEL.md` | ERD, enums, event types |
| `docs/COFFEE_TRACEABILITY.md` | Event rules, QR, audit |
| `docs/EXPORT_WORKFLOW.md` | Contract → ship |
| `docs/EXEC_COMMAND_CENTER.md` | KPI definitions & refresh |
| `docs/AI_INSIGHTS_SPEC.md` | Models, APIs, feedback |
| Update API contracts | `stock-api/docs`, `stock-frontend/docs` |

---

## 13. Summary

**Today:** Solid generic multi-location ERP (inventory, BOM/production, purchases/sales, banks, basic dashboard/reports) with a functional but unbranded UI.

**Csolve path:**

1. **Rebrand & elevate UI** (coffee colors, Csolve shell).  
2. **Lot event ledger** so every step is tracked.  
3. **Coffee ops** — collection → process/QC → warehouse → roast/export.  
4. **Executive Command Center** — real-time pulse + decision-support reports.  
5. **AI layer** — forecasts, blend/pricing, quality & export readiness — human-confirmed.

Not a rewrite: specialize the existing Nest + Next stack into **Csolve — AI-Powered Stock Management** for coffee.
