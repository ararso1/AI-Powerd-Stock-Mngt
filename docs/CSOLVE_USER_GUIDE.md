# Csolve User Guide  
## AI-Powered Stock Management for Coffee

**Product:** Csolve  
**Audience:** Operators, stock keepers, purchasers, sales, and executives  
**Currency (default):** ETB (`Br`) — export contracts/sales may use USD  
**Purpose of this guide:** Explain every major screen and how coffee stock moves **in** and **out** with full lot traceability.

---

## 1. What Csolve tracks

Csolve follows coffee from **farm intake to local cup or export container**.

```
Farmer / supplier
    → Collection (cherry IN)
    → Transfer (location move)
    → Processing + QC (form change: cherry → parchment → green → roasted → packaged)
    → Warehouse / roastery / staging
         ├→ Local sales (OUT)
         └→ Export allocate → stage → ship (OUT)
```

### Core ideas

| Concept | Meaning |
|---------|---------|
| **Lot** | Traceability unit (origin, crop year, grade, moisture, form, quantity). |
| **Lot event** | Append-only step on the lot timeline (never edited). |
| **Stock level** | Quantity on hand at a **location**, for coffee always linked to a **lot**. |
| **Form** | Physical state: `CHERRY` → `PARCHMENT` → `GREEN` → `ROASTED` → `PACKAGED` (plus `REJECT`). |
| **Channel** | `LOCAL` (roasted market) or `EXPORT` (green/container). |

**Rule:** Coffee (`COF-*` items) cannot sit as anonymous warehouse qty. Stock in/out for coffee must reference a **lot**.

---

## 2. Getting started

### 2.1 Login

1. Open the Csolve web app.  
2. Sign in with email and password.  
3. The sidebar shows only modules allowed by your **role**.

### 2.2 Demo accounts (local seed)

Password for all demo users: **`Demo@123`**

| Email | Role | Typical use |
|-------|------|-------------|
| `admin@csolve.local` | Admin | Full access |
| `stock@csolve.local` | Stock Keeper | Lots, collection, process, transfers, inventory, exports |
| `purchase@csolve.local` | Purchaser | Collection, purchases, suppliers |
| `sales@csolve.local` | Sales Representative | Sales, customers, banks/credits, insights |

After permission changes, **log out and log in again** so the nav updates.

### 2.3 Navigation map

| Group | Screens |
|-------|---------|
| **Insights** | Command Center, AI Insights, Reports, Profit & Loss |
| **Operations** | Lots, Collection, Processing, Roast profiles, Exports, Inventory, BOMs, Production, Stock Transfers, Purchases, Sales |
| **Finance** | Credits, Expenses, Bank |
| **Master** | Locations, Suppliers, Customers |
| **Admin** | Users, Roles |

---

## 3. How stock IN and stock OUT work

### 3.1 Stock IN (quantity increases)

| Action | Module | What happens |
|--------|--------|----------------|
| Cherry intake | **Collection** | +cherry stock on lot; lot events `CREATED` + `COLLECTED`; creates a **Purchase** (money) |
| Process complete | **Processing** | −input lot stock; **+new output lot** stock (new form/SKU) |
| Transfer receive | **Stock Transfers** | −source location; **+destination** (same lot) |
| Manual increase | **Inventory → Adjust** | +qty on lot; event `ADJUSTED` (e.g. `FOUND`, `COUNT`, `OPENING`) |
| Generic purchase | **Purchases** | +stock for **non-lot** items (supplies). *Do not use for cherry coffee — use Collection.* |
| Production complete | **Production** | +finished goods (BOM path; mainly non-coffee / manufacturing) |

### 3.2 Stock OUT (quantity decreases)

| Action | Module | What happens |
|--------|--------|----------------|
| Process complete | **Processing** | −input lot (converted to output lot) |
| Local sale | **Sales** (`LOCAL`) | −lot stock; event `SOLD_LOCAL` |
| Export ship | **Exports** (or sale `EXPORT`) | −lot stock; event `SHIPPED` |
| Transfer send | **Stock Transfers** | −source location |
| Manual decrease | **Inventory → Adjust** | −qty; event `ADJUSTED` (`MOISTURE_LOSS`, `SHRINKAGE`, `QC_REJECT`, `DAMAGE`, …) |
| Export stage | **Exports → Stage** | Move to staging location (transfer out of warehouse, into staging) |

### 3.3 Lot timeline events (audit trail)

Every important step is recorded on the lot:

| Event | When |
|-------|------|
| `CREATED` | Lot opened |
| `COLLECTED` | Cherry collection ticket |
| `TRANSFERRED` | Stock transfer or export staging |
| `PROCESS_STARTED` / `PROCESS_COMPLETED` | Mill / roast / pack run |
| `QC_HELD` / `QC_RELEASED` | Quality hold / release |
| `ADJUSTED` | Manual qty / moisture / shrinkage / reject notes |
| `SPLIT` / `MERGED` | Lot genealogy |
| `ROASTED` / `PACKAGED` | Local market form change |
| `SOLD_LOCAL` | Local channel sale |
| `ALLOCATED_EXPORT` | Reserved on export contract (not yet physical OUT) |
| `SHIPPED` | Export shipment (physical OUT) |
| `VOIDED` | Lot cancelled |

Open any lot → **timeline** to answer: *Where did this coffee come from, and where did it go?*

---

## 4. Insights

### 4.1 Command Center (`/dashboard`)

**Who:** Executives / managers (`insights.read` or `dashboard.read`)

**What you see**

- Operational pulse: intake today, process WIP, green stock, roast output, local sales, export staged kg  
- Traceability: % of stock linked to lots  
- Contracts: open coverage, missing docs, ship windows  
- Recommended actions (rules-based) with drill-down links  
- Commercial / liquidity snapshot  

**Stock tracking:** Read-only. Does not move stock. Refreshes about every 45 seconds.

**How to use**

1. Set an optional date range for commercial KPIs.  
2. Click a KPI or recommendation to jump into Lots, Collections, Exports, or Sales.  
3. Use “Open AI Insights” for forecasts and accept/reject workflow.

---

### 4.2 AI Insights (`/insights`)

**Who:** `ai.read` / `insights.read` (feedback: `ai.feedback`)

**What you see**

1. **Stock operation trends** — 14-day intake vs outbound, stock by form, by location, forward demand  
2. **Recommendations** — forecast, intake advice, yield anomaly, blend, pricing, export readiness, quality risk  

**Stock tracking:** Advice only. Accepting a card does **not** move inventory or money — you still confirm the action in the linked module.

**How to use**

1. Review trend charts first (stock in/out pace).  
2. Filter recommendations by kind / status.  
3. **Accept / Reject / Dismiss** to log feedback.  
4. Click **Refresh** if the list is empty (reopens demo/rule cards).

---

### 4.3 Reports (`/reports`)

**Who:** `reports.read`

Tabs typically include: summary, sales, purchases, expenses, sales/purchases by item, **inventory aging**, customers, suppliers, commissions, credits, cash flow.

**Inventory aging:** Days since lot creation (or stock update if unlinked) — useful for green sitting too long.

**Stock tracking:** Read-only.

---

### 4.4 Profit & Loss (`/profit-loss`)

**Who:** `profit_loss.read`

Shows revenue, cost of goods sold, gross profit, expenses, and net for a date range (ETB).

**Stock tracking:** Uses sales/purchase/expense history; does not change stock.

---

## 5. Coffee operations

### 5.1 Lots (`/lots`, `/lots/[id]`)

**Who:** `lot.read` / `lot.write` / `lot.split`

**Purpose:** Identity and history of every coffee batch.

**Fields that matter**

- Code, item (coffee SKU), location, **form**, grade, crop year, variety, process method  
- Origin (region / woreda / kebele), moisture %, quantity, status  

**Statuses:** `ACTIVE` · `HOLD` · `VOIDED`

**Stock IN/OUT**

- Creating a lot **alone** does not always create warehouse stock.  
- Stock appears when Collection, Process complete, Transfer, Sale, Adjust, or Export ship runs.  
- Split / merge update lot quantities and genealogy events.

**Daily use**

1. Search by code, form, grade, crop year, location.  
2. Open a lot → read **timeline** before selling or allocating to export.  
3. Put QC issues on **HOLD**; void only when the lot should never move again.

---

### 5.2 Collection — cherry stock IN (`/collections`)

**Who:** `collection.read` / `collection.write`

**Purpose:** Record farmer / supplier cherry intake (primary **stock IN** for coffee).

**What happens when you save a ticket**

1. Creates a **cherry lot** (form `CHERRY`).  
2. Posts lot events `CREATED` + `COLLECTED`.  
3. **Increases stock** at the collection location (lot-linked).  
4. Creates a **Purchase** (cash/bank money out, or supplier credit).

**How to record intake**

1. **Collection → New**.  
2. Choose supplier (farmer), location (collection center), coffee item, weight kg, price/kg, payment method.  
3. Save → note the lot code on the ticket.  
4. Optionally transfer cherry to wet/dry mill.

**Tip:** Prefer Collection over generic Purchases for cherry so lots stay complete.

---

### 5.3 Processing & QC (`/process-runs`)

**Who:** `process.read` / `process.write`

**Purpose:** Convert coffee form and post yield (stock **OUT** of input lot, **IN** on new output lot).

**Seeded templates (examples)**

| Template idea | Input form | Output form |
|---------------|------------|-------------|
| Wet / washed | Cherry | Parchment |
| Dry mill | Parchment | Green |
| Natural | Cherry | Green |
| Roast | Green | Roasted |
| Pack | Roasted | Packaged |

**Statuses:** `DRAFT` → `IN_PROGRESS` → (`QC_HOLD`) → `READY` → `COMPLETED` (or `CANCELLED`)

**Stock IN/OUT on complete**

1. Reduce input lot quantity / stock.  
2. Create output lot with new form and quantity (after yield / reject).  
3. Events: `PROCESS_STARTED`, QC events if used, `PROCESS_COMPLETED`, plus `ROASTED` / `PACKAGED` when relevant.  
4. Reject / loss can appear as lower yield and related `ADJUSTED` notes.

**How to run a process**

1. **Processing → New** → pick template, input lot, location, expected output.  
2. Start the run; complete stages.  
3. Record QC (hold/release) if needed.  
4. Complete with actual output kg, moisture, reject — system posts stock and new lot.  
5. Open both lots’ timelines to verify the chain.

---

### 5.4 Roast profiles (`/roast-profiles`)

**Who:** Same process permissions

**Purpose:** Named roast curves (level, duration, shelf life, blend notes). Used when completing roast/pack runs to set roast date / best-before on lots.

**Stock IN/OUT:** None by itself.

---

### 5.5 Exports (`/exports`)

**Who:** `export.read` / `export.write`

**Purpose:** Dual-market export pipeline for green (and related) coffee.

**Contract lifecycle**

```
DRAFT → ALLOCATED → STAGED → SHIPPED → CLOSED
         (or CANCELLED)
```

**Stock / event impact**

| Step | Stock | Lot event |
|------|-------|-----------|
| Create contract | None | — |
| **Allocate** lots | None (reservation) | `ALLOCATED_EXPORT` |
| **Stage** | Transfer to export staging location | `TRANSFERRED` |
| **Ship** | **OUT** from staging | `SHIPPED` (+ optional export sale / bank IN) |
| Doc checklist | None | — |

**How to ship an export**

1. **Exports → New** — buyer, volume kg, grade, price, currency, incoterm, window, staging location.  
2. **Allocate** active green lots (enough kg, matching grade where required).  
3. Complete dossier checklist (COO, phyto, QC, packing list, invoice).  
4. **Stage** → physical move to staging warehouse.  
5. **Ship** → stock leaves; timeline shows `SHIPPED`.  
6. **Close** when paperwork and finance are done.

---

### 5.6 Inventory (`/inventory`)

**Who:** `inventory.read` / `inventory.write` / `inventory.adjust` / `inventory.import`

**Purpose:** See quantities by location, item, and **lot**; adjust; find low stock.

**Filters useful for coffee:** form, crop year, grade, lot code.

**Adjustments (manual stock IN/OUT)**

1. Open adjust on a stock line.  
2. Choose direction **in** or **out**, quantity, reason.  
3. Coffee lines need a **lot**.  
4. Coffee reasons include `MOISTURE_LOSS`, `SHRINKAGE`, `QC_REJECT` plus standard `DAMAGE`, `LOSS`, `FOUND`, `COUNT`, etc.  
5. System updates stock + lot qty and writes `ADJUSTED`.

**Note:** You cannot create unlinked coffee stock via plain “add inventory”; use Collection / Process / Transfers.

---

### 5.7 Stock Transfers (`/stock-transfers`)

**Who:** `stock_transfer.read` / `stock_transfer.write`

**Purpose:** Move coffee between locations (collection → mill → warehouse → roastery → staging).

**Stock IN/OUT**

- OUT at source location, IN at destination (same lot).  
- Lot’s current location updates.  
- Event: `TRANSFERRED`.  
- Void reverses the move.

**Coffee rule:** Each coffee line must pick a **lot** (stock-line picker).

---

### 5.8 Purchases (`/purchases`)

**Who:** `purchase.read` / `purchase.write`

**Purpose:** Buy goods from suppliers (bags, materials, non-lot items). Money OUT on cash/bank; credit increases supplier payable.

**Stock:** Increases **non-lot** stock for ordinary items.  
**For cherry coffee:** use **Collection** so the lot ledger stays correct.

---

### 5.9 Sales (`/sales`)

**Who:** `sales.read` / `sales.write`

**Purpose:** Sell coffee locally or record export-channel sales.

**Channels**

| Channel | Stock effect | Lot event |
|---------|--------------|-----------|
| `LOCAL` | OUT | `SOLD_LOCAL` |
| `EXPORT` | OUT | `SHIPPED` |

**How to sell coffee**

1. **Sales → New** → customer, location, channel, payment.  
2. Add lines from **lot-linked stock** (required for coffee).  
3. Save → stock and lot qty decrease; money IN (or customer credit).  

Prefer the **Exports** module for full contract → allocate → stage → ship workflow; use Sales for showroom / roasted retail and simple export sales.

---

### 5.10 BOMs & Production (`/boms`, `/production-orders`)

**Who:** `bom.*` / `production.*`

**Purpose:** Generic manufacturing (bill of materials → issue materials → receive finished goods).

**Stock:** Material **OUT** on issue; finished goods **IN** on complete.  
Use **Processing** for coffee form changes; use Production when you still need classic BOM manufacturing.

---

## 6. Finance

### 6.1 Bank (`/banks`)

Cash and bank accounts (ETB; seed may include USD for export). Transactions from sales, purchases, expenses, credit settlements.

**Stock:** None — money only.

### 6.2 Credits (`/credits`)

Customer receivables and supplier payables (`OPEN` / `PARTIAL` / `PAID`). Record payments and receipts.

**Stock:** None.

### 6.3 Expenses (`/expenses`)

Operating costs linked to categories and optionally a bank account (money OUT).

**Stock:** None.

---

## 7. Master data & admin

### 7.1 Locations (`/locations`)

Types you’ll use in coffee ops:

`COLLECTION_CENTER` · `WET_MILL` · `DRY_MILL` · `WAREHOUSE` · `ROASTERY` · `SHOWROOM` · `EXPORT_STAGING`

Seeded examples: Main Warehouse, collection center, wet mill, roastery, showroom, export staging.

### 7.2 Suppliers (`/suppliers`)

Farmers and vendors for collection and purchases.

### 7.3 Customers (`/customers`)

Local buyers and export buyers.

### 7.4 Users & Roles (`/users`, `/roles`)

Admin assigns roles and permissions. Nav and screens hide what you cannot access.

---

## 8. End-to-end examples

### 8.1 Local roast path (stock IN → OUT)

1. **Collection** — 1,000 kg cherry IN at collection center → lot `LOT-…`  
2. **Transfer** — move to wet mill  
3. **Process** (washed) — cherry OUT → parchment IN (new lot)  
4. **Process** (dry mill) — parchment OUT → green IN  
5. **Transfer** — green to roastery  
6. **Process** (roast + pack) — green OUT → roasted/packaged IN  
7. **Sale** (`LOCAL`) — packaged OUT → `SOLD_LOCAL`  
8. Open first and last lots’ timelines to prove farm → cup

### 8.2 Export path

1. Collection → process to **green** (as above)  
2. Green sits in **warehouse** (lot-linked inventory)  
3. **Export contract** → allocate green lots (`ALLOCATED_EXPORT`)  
4. Complete docs → **stage** (transfer to staging)  
5. **Ship** — stock OUT + `SHIPPED` (+ optional USD sale)  
6. Command Center / AI Insights show readiness and coverage

### 8.3 Shrinkage / moisture (stock OUT without sale)

1. Inventory → select lot stock line → **Adjust OUT**  
2. Reason `MOISTURE_LOSS` or `SHRINKAGE`  
3. Lot qty and timeline update (`ADJUSTED`)

---

## 9. Traceability checklist (operators)

Before you allocate to export or sell:

- [ ] Lot status is `ACTIVE` (not `HOLD` / `VOIDED`)  
- [ ] Form matches the sale/export (usually `GREEN` for export, `ROASTED`/`PACKAGED` for local)  
- [ ] Moisture and QC are acceptable  
- [ ] Stock quantity at the correct **location**  
- [ ] Timeline shows continuous chain (collection → process → transfer)  
- [ ] For export: contract allocated kg + docs checklist  

Executives: use **Command Center** + **AI Insights** weekly; drill into gaps instead of exporting spreadsheets by hand.

---

## 10. Permissions quick reference

| Need | Permission codes (examples) |
|------|-----------------------------|
| See Command Center | `insights.read` or `dashboard.read` |
| AI Insights | `ai.read`; feedback `ai.feedback` |
| Lots | `lot.read` / `lot.write` / `lot.split` |
| Collection | `collection.read` / `collection.write` |
| Processing | `process.read` / `process.write` |
| Exports | `export.read` / `export.write` |
| Inventory adjust | `inventory.adjust` |
| Transfers | `stock_transfer.read` / `stock_transfer.write` |
| Sales / Purchases | `sales.*` / `purchase.*` |
| Finance | `bank.*` / `credit.*` / `expense.*` |
| Admin | `users.*` / `roles.*` |

---

## 11. Troubleshooting

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| AI Insights empty | All cards accepted/rejected | Click **Refresh** |
| Cannot add coffee in Inventory | Coffee must be lot-linked | Use Collection / Process / Adjust with lot |
| Transfer rejects coffee line | Missing lot | Pick lot stock line |
| Sale fails on coffee | Missing `lotId` | Choose lot from stock picker |
| Nav item missing | Role lacks permission | Ask Admin; re-login |
| Export ship blocked | Incomplete docs / allocation / staging | Finish checklist and stage first |
| Numbers look wrong after void | Document voided | Check lot timeline and transfer/sale status |

---

## 12. Related docs

| Doc | Audience |
|-----|----------|
| `docs/COFFEE_AI_UPGRADE_PLAN.md` | Product / implementation roadmap |
| `docs/CSOLVE_BRAND_UI.md` | Design / brand tokens |
| `stock-api/docs/FRONTEND_API.md` | API reference for developers |
| `stock-frontend/docs/BACKEND_API_CONTRACT.md` | Frontend–API contract |

---

## 13. Summary — remember this

1. **Collection** = main coffee **stock IN** (cherry + lot + purchase).  
2. **Processing** = form change (**OUT** old lot, **IN** new lot).  
3. **Transfers** = location change (same lot).  
4. **Sales / Export ship** = commercial **stock OUT**.  
5. **Adjustments** = moisture, shrinkage, count corrections.  
6. **Lot timeline** = the legal/operational story of every kg.  
7. **Command Center + AI Insights** = watch the business; humans still confirm stock and money.

*Csolve — AI-Powered Stock Management for Coffee*
