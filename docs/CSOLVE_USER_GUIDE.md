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
Farmer / supplier / cooperative / collector
    → Collection (receiving inspection: accept / partial / reject)
    → Grading & quality (Received → Sample tested → Graded → Accepted/Rejected → Processed → Final grade)
    → Transfer (location move)
    → Processing (flour/hull/roast/pack — form change)
    → Warehouse / roastery / staging
         ├→ Local sales (OUT)
         └→ Export allocate → stage → ship (OUT)
    → Payment / credit → financial & analytical reporting
```

### Core ideas

| Concept | Meaning |
|---------|---------|
| **Lot** | Traceability unit (origin, crop year, grade, moisture, form, quantity, QC phase). |
| **Lot event** | Append-only step on the lot timeline (never edited). |
| **Stock level** | Quantity on hand at a **location**, for coffee always linked to a **lot**. |
| **Form** | Physical state: `CHERRY` → `PARCHMENT` → `GREEN` → `ROASTED` → `PACKAGED` (plus `REJECT`). |
| **QC phase** | Grade lifecycle on the lot (orthogonal to Active/Hold/Voided). |
| **Channel** | `LOCAL` (roasted market) or `EXPORT` (green/container). |

**Rule:** Coffee (`COF-*` items) cannot sit as anonymous warehouse qty. Stock in/out for coffee must reference a **lot**.

**Rule:** Rejected coffee **stays in inventory** as form `REJECT` (SKU `COF-REJECT`). Do not erase reject kg with a silent write-off — record reason, %, inspector, batch, and action/destination.

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

With `DB_SEED=true`, the API also loads an **executive demo pack**: multi-origin green lots, 14-day cherry collections, process WIP/QC hold, warehouse→staging transfer, local roast sales, Nordic + Tokyo export contracts, bank balances (ETB/USD), expenses, and notifications — so Dashboard and AI advice look like a live coffee season.

Re-run anytime: `npm run seed` in `stock-api` (idempotent; skips pack if already present).

### 2.3 Navigation map

| Group | Screens |
|-------|---------|
| **Overview** | Dashboard, AI advice, Market prices, Reports, Profit & loss |
| **Coffee & stock** | Coffee lots, Cherry intake, Processing, Roast recipes, Exports, Stock, Product recipes, Production, Move stock, Purchases, Sales |
| **Money** | Outstanding, Expenses, Cash & bank |
| **Partners** | Locations, Suppliers, Customers |
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

### 4.1 Dashboard (`/dashboard`)

**Who:** Executives / managers (`insights.read` or `dashboard.read`)

**What you see**

1. **AI Executive Insights** (top strip) — live cards such as:
   - Stock days of cover from green inventory vs recent demand  
   - Overdue customer credit exposure  
   - Supplier rejection-rate spikes  
   - Export demand trend vs last month  
   - Export share of gross profit  
2. **Analytical dashboard** with KPI tiles and charts:
   - **Inventory** — total stock, value, available, reserved, export stock, low-stock items  
   - **Trading** — purchases, local/export sales, volume & value (channel chart)  
   - **Quality** — accepted/rejected qty, rejection %, grade distribution, supplier quality ranking  
   - **Finance** — receivables, payables, outstanding, overdue, paid vs unpaid  
   - **Production** — processing / roasting volume, yield, loss / wastage  
   - **Export** — volume, value, active contracts, pending shipments, shipped qty, outstanding export payments  
3. Operational **pulse**, traceability, contract risk, recommended actions, commercial / liquidity  

**Stock tracking:** Read-only. Does not move stock. Refreshes about every 45 seconds.

**How to use**

1. Set an optional date range for period KPIs (trading, quality, production, export value).  
2. Scan AI Executive Insights first — click a card to jump into Inventory, Credits, Collections, Exports, or P&amp;L.  
3. Use analytical section tiles/charts for the full management picture.  
4. Use **AI advice** for forecasts, assistant Q&amp;A, and accept/reject workflow.

---

### 4.1b Market prices (`/market-prices`)

**Who:** `market_prices.read` (sync: `market_prices.write`)

**What you see**

- Live **ICE Arabica (KC)** and **Robusta (RC)** spot with 7d / 30d % change  
- Converted **USD and ETB** per kg, quintal (100 kg), and ton  
- Historical chart, **grade differentials** (e.g. G1 vs KC), inventory market vs book valuation, and export contract spreads  
- Prices sync on a schedule (and via **Sync prices**); Arabica from Yahoo Finance (`KC=F`); Robusta from Commodities-API when `COMMODITIES_API_KEY` is set, otherwise a documented KC-ratio proxy  

**Stock tracking:** Read-only. Does not move stock or change contract prices automatically.

---

### 4.2 AI advice (`/insights`)

**Who:** `ai.read` / `insights.read` (feedback: `ai.feedback`)

This is Csolve’s differentiation layer vs a traditional coffee ERP — **recommend-only** intelligence on live data (no silent stock/money moves).

**What you see**

1. **AI Business Assistant** — ask questions such as:
   - How much Grade 1 coffee do we currently have?
   - How much coffee is reserved for export?
   - Who owes us the most money?
   - Which supplier has the highest rejection rate?
   - How much coffee did we export this month?
   - What is our total outstanding balance?
   - Which grade generated the highest profit?
2. **Stock operation trends** — 14-day intake vs outbound, stock by form/location, **local vs export demand forecast**
3. **Recommendations** (Accept / Reject / Dismiss):

| Kind | Example |
|------|---------|
| Demand forecast | Local & export kg projected from sales history |
| Stock prediction | “Grade 2 will reach minimum stock in ~12 days” |
| Procurement | “Buy ~N quintals G1 based on export commitments” |
| Quality analysis | High-rejection suppliers, better origins, rising defects, seasonal QC |
| Credit risk | Late payments, high exposure, unusual purchasing, rising AR |
| Intake / export readiness / pricing / blend | Existing ops guidance cards |

**Stock tracking:** Advice only. Accepting a card does **not** move inventory or money — confirm in the linked module.

**How to use**

1. Ask the assistant for a quick management answer.  
2. Review trend charts (local vs export demand).  
3. Filter recommendations by kind / status.  
4. **Accept / Reject / Dismiss** to log feedback.  
5. Click **Refresh** to rebuild live rule/forecast cards.

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

### 5.2 Collection — procurement & receiving (`/collections`)

**Who:** `collection.read` / `collection.write`

**Purpose:** Purchase cherry from farmers, suppliers, cooperatives, and collectors. Primary **stock IN** for coffee, with receiving inspection.

**What happens when you save a ticket**

1. Records **disposition**: fully accepted, partially accepted, or fully rejected.  
2. Creates a **cherry lot** for accepted kg (form `CHERRY`, QC phase `RECEIVED` / `ACCEPTED`).  
3. If any kg is rejected → creates a **reject lot** (form `REJECT`, QC phase `REJECTED`) that **remains in inventory** with reason, %, inspector, and action.  
4. Posts lot events (`CREATED`, `COLLECTED`, `RECEIVING_ACCEPTED` / `RECEIVING_REJECTED`).  
5. Creates a **Purchase** only for **accepted** kg (cash/bank out, or supplier credit / outstanding balance).

**Quality fields at receive**

Coffee type (item), origin (region / zone / woreda / kebele), grade, process method, moisture, defect level, screen size, batch/lot, inspection date, inspector.

**How to record intake**

1. **Collection → New**.  
2. Choose supplier, location (collection center), coffee item, gross weight kg, grade, price/kg, payment method.  
3. Set **receiving inspection**: Fully accepted / Partially accepted / Fully rejected.  
4. For partial: enter accepted kg + rejected kg (must sum to gross). Enter reject reason and action/destination.  
5. Optionally capture zone, process, screen, defects, moisture, origin.  
6. Save → open the ticket to see accepted lot and reject lot links.  
7. Optionally transfer accepted cherry to wet/dry mill.

**Tip:** Prefer Collection over generic Purchases for cherry so lots and quality stay complete.

---

### 5.2b Grading & quality (on lot detail `/lots/:id`)

**Who:** `lot.read` / `lot.write`

**Purpose:** Track quality at every stage and advance the grade lifecycle without losing rejected stock.

**Lifecycle (QC phase)**

`Received` → `Sample tested` → `Graded` → `Accepted` / `Rejected` → `Processed` → `Final grade`

Operational **status** (Active / Hold / Voided) stays separate from QC phase.

**How to grade**

1. Open the lot → **Grading & quality**.  
2. Choose the next phase, update moisture, screen, cup score, defects, grade.  
3. If marking **Rejected**, enter rejection reason (lot goes on Hold; reject inventory lots use form `REJECT`).  
4. Timeline records `SAMPLE_TESTED`, `GRADED`, `QC_HELD`, `FINAL_GRADED`, etc.

---

### 5.3 Local processing — flour & roast (`/process-runs`)

**Who:** `process.read` / `process.write`

**Purpose:** Convert coffee form and post yield (stock **OUT** of input lot, **IN** on new output lot). Output lot QC phase becomes `PROCESSED`. Supports **flour** and **roast**, plus packaging.

**Seeded templates (examples)**

| Template | Operation | Input → Output | Notes |
|----------|-----------|----------------|-------|
| Washed / dry / natural | Mill | Cherry/parchment → parchment/green | Hull & mill |
| Coffee roasting | Roast | Green → Roasted (kg) | e.g. 100 → 82 kg; **18 kg loss auto** |
| Coffee flour / grind | Flour | Roasted → Flour | Ground coffee |
| Package 1 kg / 250g | Pack | Roasted → Packaged (pcs) | e.g. 82 kg → 82 × 1 kg packs |

**On complete the system records**

- Input qty, output qty (kg or pack count), reject kg (retained as REJECT lot)
- **Production loss** = input − output weight − reject (automatic)
- Yield %
- Processing cost (rolled into output unit cost)
- Ledger rows: production consumption, output, loss, rejection

**Example roast → pack**

1. Roast: 100 kg green → 82 kg roasted (18 kg loss logged).  
2. Pack 1 kg: 82 kg roasted → 82 packages (pcs of `COF-ROAST-1KG`).

**How to run**

1. **Processing → New** → pick roast/flour/pack template, input lot, cost.  
2. Start → stages → QC if required.  
3. Complete: enter output (kg or packs) and reject; loss is calculated.  
4. Check lot timeline + **Inventory → Stock ledger**.

---

### 5.3b Stock ledger (`/inventory` → Stock ledger)

**Who:** `inventory.read`

Every movement stores: **Date · Product · Grade · Batch · Qty · Location · User · Reference**.

| Stock IN | Stock OUT |
|----------|-----------|
| Purchases / collection | Local sales |
| Production output | Export shipments |
| Sale returns | Production consumption / loss |
| Transfers in | Transfers out |
| Adjustments (found/opening) | Rejection, damage, wastage |

---

### 5.4 Roast profiles (`/roast-profiles`)

**Who:** Same process permissions

**Purpose:** Named roast curves (level, duration, shelf life, blend notes). Used when completing roast/pack runs to set roast date / best-before on lots.

**Stock IN/OUT:** None by itself.

---

### 5.4b Local sales (`/sales`, `/customers`)

**Who:** `sales.*`, `customers.*`

**Purpose:** Domestic retail / wholesale / cafe invoices.

- Customer types: **Retail · Wholesale · Cafe · Other**
- Invoice with product, qty, unit price, total
- Paid amount + outstanding (credit sales)
- Payment history via **Credits** + bank receipts
- **Sales return:** `POST /sales/:id/returns` restocks lot and refunds cash/bank or reduces credit

Prefer **Local** channel for roasted/packaged domestic sales; use **Exports** for containers.

---

### 5.5 Exports (`/exports`)

**Who:** `export.read` / `export.write`

**Purpose:** International coffee export pipeline and hard stock reservation.

**Lifecycle**

```
DRAFT → ALLOCATED → STAGED → SHIPPED → DELIVERED → CLOSED
                    (or CANCELLED — releases reserved stock)
```

Maps to: **Export order / Contract → Allocation → QC dossier → Packaging docs → Shipment → Documents → Customer payment**.

**What you track**

| Field | Notes |
|-------|--------|
| Buyer / country | International buyer |
| Export order # | Optional PO / order ref (alongside contract #) |
| Coffee type, grade, origin | Commercial description |
| Lot / batch + qty | Via allocations |
| Price, currency, Incoterms | Contract commercial terms |
| Destination, container | Shipment logistics |
| Shipping date / ETA | Window + shipping / expected arrival |
| Payment status / outstanding | From linked export sale + Credits |

**Documents (dossier)**

Checklist with references: Certificate of Origin, Phyto, QC/cupping, Packing list, Commercial invoice, Bill of lading, Weight/quality cert. Tick done and store document numbers.

**Stock / reservation (see also §8)**

| Step | Stock state | Stock impact |
|------|-------------|--------------|
| Create | — | None |
| **Allocate / Reserve** | **Reserved for export** | Locks kg on `stock_levels.reserved_quantity` — **cannot be sold locally** |
| **Stage** | Reserved (at staging) | Transfer reserved qty to export staging |
| **Ship** | **Shipped** | Physical OUT; reservation cleared; optional export sale |
| **Deliver** | **Delivered** | Status only (stock already left) |
| Cancel (pre-ship) | Back to **Available** | Releases reservation |

**How to run an export**

1. **Exports → New** — buyer, country, order #, type/grade/origin, volume, price, currency, incoterm, destination, container, dates, staging.  
2. **Reserve for export** — pick green lots; kg is hard-locked.  
3. Complete dossier (docs + references).  
4. **Stage** → move reserved coffee to staging.  
5. **Ship + sale** → stock OUT; invoice/payment status appears.  
6. **Mark delivered** when cargo arrives / is confirmed.  
7. Settle outstanding on **Credits** if credit sale; **Close** when done.

---

### 5.5b Export stock reservation

Coffee for export is split into four states:

| State | Meaning |
|-------|---------|
| **Available** | On hand minus reserved — safe for local sales |
| **Reserved for export** | Allocated to open contracts (`ALLOCATED` / `STAGED`) |
| **Shipped** | Left warehouse on a `SHIPPED` contract |
| **Delivered** | Confirmed with buyer (`DELIVERED` / `CLOSED`) |

Inventory list shows **avail · reserved** under quantity when any kg is locked. Local sales that would touch reserved coffee are rejected.

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

Tracks **customer receivables** and **supplier payables** so every party has Invoice → Paid → Outstanding.

Example (customer):

| Description | Amount |
| --- | --- |
| Invoice | 500,000 ETB |
| Paid | 300,000 ETB |
| Outstanding | 200,000 ETB |

**What you can do**

- **Customer credit balance** — open/partial receivables per sale
- **Supplier payable balance** — open/partial payables per purchase
- **Cash vs credit sales/purchases** — cash/bank settles immediately; credit creates an outstanding record with optional due date
- **Partial payments** — pay less than outstanding; status becomes `PARTIAL` until fully paid
- **Payment history** — each settlement posts a bank transaction; view history from the Pay dialog
- **Due dates & overdue** — filter **Overdue only**; overdue rows show days past due
- **Aging analysis** — Current / 1–30 / 31–60 / 61–90 / 90+ on the Aging tab (also on Reports → Credits)
- **Credit limits** — set on Customers and Suppliers; credit sales/purchases that would exceed the limit are blocked
- **Payment reminders** — daily in-app notifications for due-soon and overdue; **Send payment reminders** forces a run now

**Workflow**

1. Create a **credit sale** or **credit purchase** with due date.
2. Open **Credits** → Customer credit or Supplier payables.
3. Use **Pay** for full or partial settlement into a bank/cash account.
4. Watch Outstanding drop; sale/purchase Paid amounts stay in sync.
5. Review **Aging** and Reports → Credits for overdue concentration.

**Stock:** None — money and balances only.

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

Farmers and vendors for collection and purchases. Optional **payable credit limit** caps how much outstanding AP you allow.

### 7.3 Customers (`/customers`)

Local buyers and export buyers (Retail / Wholesale / Cafe / Other). Optional **credit limit** caps receivables for credit sales.

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

1. Collection → process to **green**.  
2. **Exports → New** — buyer, country, order #, type/grade/origin, destination, container, ETA.  
3. **Reserve** green lots → inventory shows **avail · reserved** (cannot sell reserved locally).  
4. Complete dossier docs + references → **Stage** → **Ship + sale**.  
5. **Mark delivered** → settle payment on Credits if needed → **Close**.  
6. Dashboard / AI advice show readiness and coverage.

Stock states: **Available → Reserved for export → Shipped → Delivered**.

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

Executives: use **Dashboard** + **AI advice** weekly; drill into gaps instead of exporting spreadsheets by hand.

---

## 10. Permissions quick reference

| Need | Permission codes (examples) |
|------|-----------------------------|
| See Dashboard | `insights.read` or `dashboard.read` |
| AI advice | `ai.read`; feedback `ai.feedback` |
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
| AI advice empty | All cards accepted/rejected | Click **Refresh** |
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

1. **Collection** = procurement **stock IN** (receiving inspection + accepted lot + reject lot if any + purchase on accepted kg).  
2. **Grading** = QC phase on the lot (Received → … → Final grade); rejects stay as `REJECT` inventory.  
3. **Processing** = form change (**OUT** old lot, **IN** new lot; process rejects stay in inventory).  
4. **Transfers** = location change (same lot).  
5. **Sales / Export ship** = commercial **stock OUT**.  
6. **Adjustments** = moisture, shrinkage, count corrections (not a substitute for reject lots).  
7. **Lot timeline** = the legal/operational story of every kg.  
8. **Dashboard + AI advice** = watch the business; humans still confirm stock and money.

*Csolve — AI-Powered Stock Management for Coffee*
