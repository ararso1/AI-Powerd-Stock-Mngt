# Frontend API Contract — Stock Management System

This document is the **canonical REST contract** for the NestJS backend (`inventory-api`). The Next.js frontend consumes these endpoints via `NEXT_PUBLIC_API_URL`.

**Base URL:** `http://localhost:3001/api` (backend `PORT`; frontend override: `NEXT_PUBLIC_API_URL` in `.env.local`)

### Currency

All monetary amounts are **numbers in Ethiopian Birr (ETB)** unless you override server env. There is no multi-currency conversion — values are stored and returned as decimals (e.g. `"1250.00"`).

| Env | Default | Meaning |
|-----|---------|---------|
| `CURRENCY` | `ETB` | ISO 4217 code for labels |
| `CURRENCY_SYMBOL` | `Br` | Short symbol for UI (e.g. `Br 1,250.00`) |

`GET /health` and dashboard / P&amp;L / reports summaries include:

```json
"currency": { "code": "ETB", "symbol": "Br" }
```

Format amounts on the frontend using `currency.code` or `currency.symbol`.

---

## Authentication

All protected routes require:

```
Authorization: Bearer <accessToken>
```

### POST `/auth/login`

**Body**

```json
{
  "email": "admin@stock.local",
  "password": "Admin@123"
}
```

**Response `200`**

```json
{
  "user": {
    "id": "uuid",
    "email": "admin@stock.local",
    "fullName": "System Administrator",
    "role": {
      "id": "uuid",
      "name": "Admin",
      "permissions": ["inventory.read", "..."]
    }
  },
  "accessToken": "jwt",
  "refreshToken": "jwt"
}
```

### POST `/auth/refresh`

```json
{ "refreshToken": "jwt" }
```

Returns the same shape as login (new token pair).

### POST `/auth/logout`

```json
{ "refreshToken": "jwt" }
```

### GET `/auth/me`

Returns the current user profile and permission codes.

### PATCH `/auth/me`

Update the authenticated user's own profile (`fullName`, `email`). Role and active status cannot be changed here — use admin `PATCH /users/:id`.

```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com"
}
```

Returns the same shape as `GET /auth/me`.

### PATCH `/auth/me/password`

Change password. Requires the current password. All active refresh tokens are revoked (user must sign in again on other devices).

```json
{
  "currentPassword": "OldPass@123",
  "newPassword": "NewSecurePass1"
}
```

- `newPassword` — minimum 8 characters.
- `400` if current password is wrong or new password equals current.
- Response: `{ "success": true }`

---

## Authorization model

- **Roles** are dynamic (CRUD at `/roles`).
- **Permissions** are a catalog at `/permissions`; assign to roles via `permissionIds` on create/update.
- Each endpoint declares required permission codes (e.g. `inventory.read`).
- The frontend hides navigation and actions using `user.role.permissions` from login/me.

### Default system roles (seeded)

| Role | Typical access |
|------|----------------|
| Admin | All permissions |
| Sales Representative | Sales, customers, bank, credits, dashboard |
| Purchaser | Purchases, suppliers, credits |
| Stock Keeper | Inventory, stock transfers |

Permission `sales.negative_stock` is required to set `allowNegativeStock: true` on sales.

Permission `sales.on_behalf` is required to set `soldByUserId` to someone other than the logged-in user (Admin has this after seed).

---

## Common enums

```ts
type LocationType = 'WAREHOUSE' | 'SHOWROOM';
type PaymentMethod = 'CASH' | 'BANK' | 'CREDIT';
type BankAccountType = 'CASH' | 'BANK';
type TransferStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
type CreditStatus = 'OPEN' | 'PARTIAL' | 'PAID';
type DocumentStatus = 'POSTED' | 'VOIDED';
```

---

## List pagination and filters

Many list endpoints return:

```json
{
  "data": [ /* items */ ],
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

| Query param | Description |
|-------------|-------------|
| `page` | Page number (default `1`) |
| `limit` | Page size (default `20`, max `100`) |
| `from` / `to` | ISO date range on list `createdAt` (or `expenseDate` for expenses) |
| `search` | Case-insensitive text search (fields vary per endpoint — see below) |

**Paginated** `{ data, meta }`: `/purchases`, `/sales`, `/inventory`, `/inventory/low-stock`, `/inventory/adjustments`, `/boms`, `/production-orders`, `/stock-transfers`, `/credits/customers`, `/credits/suppliers`, `/expenses`, `/suppliers`, `/customers`, `/banks/transactions`, `/users`, `/roles`, `/locations`, `/notifications`.

**Plain arrays** (no pagination): `/banks/accounts`, `/permissions`.

### Reports

All report endpoints require `reports.read`. Optional query filters on date-based reports: `from`, `to`, and where noted `locationId`, `supplierId`, `customerId`, `categoryId`, `soldByUserId`.

**Frontend behaviour:** Report tables use **client-side search and pagination** on the full API response. Summary cards always reflect the filtered API dataset (server filters). Row search narrows the current table view without a second API call.

| Endpoint | Filters | Description |
|----------|---------|-------------|
| `/reports/summary` | `from`, `to` | Revenue, purchases, expenses, gross/net profit |
| `/reports/sales` | `from`, `to`, `locationId`, `customerId`, `soldByUserId` | Sales totals, by payment method, by location |
| `/reports/purchases` | `from`, `to`, `locationId`, `supplierId` | Purchase totals, by payment method, by location |
| `/reports/expenses` | `from`, `to`, `categoryId` | Expense totals, by category |
| `/reports/sales-by-item` | `from`, `to`, `locationId` | Item-level sales revenue, cost, profit, margin |
| `/reports/purchases-by-item` | `from`, `to`, `locationId`, `supplierId` | Item-level purchase quantities and spend |
| `/reports/inventory-aging` | none | Current stock value and age by item/location |
| `/reports/customer-activity` | `from`, `to`, `customerId` | Customer spend and sale count |
| `/reports/supplier-activity` | `from`, `to`, `supplierId` | Supplier purchase count and spend |
| `/reports/commissions` | `from`, `to`, `soldByUserId` | Sales rep commission totals |
| `/reports/credits` | none | Outstanding customer receivables and supplier payables |
| `/reports/cash-flow` | `from`, `to` | Daily and total cash inflow/outflow |

### Endpoint-specific filters

| Endpoint | Extra query params |
|----------|-------------------|
| `/inventory` | `locationId` (optional — omit for all locations), `search` (item description, SKU) |
| `/inventory/low-stock` | `locationId` (optional), `page`, `limit` |
| `/inventory/adjustments` | `locationId`, `itemId`, `direction` (`in` \| `out`), `reason`, `search`, `from`/`to` |
| `/boms` | `finishedItemId`, `isActive` (`true`\|`false`), `search` |
| `/production-orders` | `locationId`, `finishedItemId`, `bomId`, `status`, `search`, `from`/`to` |
| `/suppliers`, `/customers` | `search` (name, email, phone) |
| `/purchases` | `includeVoided`, `supplierId`, `locationId`, `paymentMethod`, `search` (notes, supplier name) |
| `/sales` | `includeVoided`, `soldByUserId`, `customerId`, `locationId`, `paymentMethod`, `search` (notes, customer name) |
| `/expenses` | `categoryId`, `bankAccountId`, `search` (description, category name) |
| `/credits/customers` | `status`, `customerId`, `search` (customer name, phone) |
| `/credits/suppliers` | `status`, `supplierId`, `search` (supplier name, phone) |
| `/stock-transfers` | `fromLocationId`, `toLocationId`, `status`, `search` (notes) |
| `/banks/accounts` | `type` (`CASH` \| `BANK`), `includeInactive`, `search` (name, bank, account number) |
| `/banks/transactions` | `bankAccountId`, `type` (`SALE` \| `PURCHASE` \| `ADJUSTMENT` \| `CREDIT_PAYMENT` \| `EXPENSE`), `direction` (`in` \| `out`), `search` (description), `from`/`to` (on `createdAt`) |
| `/locations` | `type`, `includeInactive`, `search` (name) |
| `/users` | `roleId`, `isActive` (`true` \| `false`), `search` (email, full name) |
| `/roles` | `search` (name, description) |
| `/permissions` | `module`, `search` (code, name, module) |
| `/notifications` | `isRead` (`true` \| `false`), `module`, `search` (title, message) |

`paymentMethod`: `CASH` \| `BANK` \| `CREDIT`. Credit `status`: `OPEN` \| `PARTIAL` \| `PAID`. Transfer `status`: `PENDING` \| `COMPLETED` \| `CANCELLED`.

The frontend builds query strings with `lib/list-query.ts` (`buildListPath`) and paginates via `hooks/use-paginated-list.ts`.

---

## Locations

| Method | Path | Permission |
|--------|------|------------|
| GET | `/locations?type=SHOWROOM&includeInactive=true` | `locations.read` |
| GET | `/locations/:id` | `locations.read` |
| POST | `/locations` | `locations.write` |
| PATCH | `/locations/:id` | `locations.write` |

**Create body**

```json
{
  "name": "Showroom A",
  "type": "SHOWROOM",
  "address": "optional"
}
```

---

## Inventory (warehouse / per-location stock)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/inventory?locationId=` | `inventory.read` |
| GET | `/inventory/low-stock?locationId=` | `inventory.read` |
| GET | `/inventory/adjustments` | `inventory.read` |
| POST | `/inventory/adjustments` | `inventory.adjust` |
| GET | `/inventory/:id` | `inventory.read` |
| POST | `/inventory` | `inventory.write` |
| PATCH | `/inventory/:id` | `inventory.write` |
| DELETE | `/inventory/:id` | `inventory.delete` |
| POST | `/inventory/import?locationId=` | `inventory.import` |

**Stock record** (response item):

```json
{
  "id": "uuid",
  "locationId": "uuid",
  "itemId": "uuid",
  "quantity": "100.000",
  "purchasePrice": "25.50",
  "reorderPoint": "20.000",
  "item": { "id": "uuid", "sku": "SKU1", "description": "Widget", "unit": "pcs" },
  "location": { "id": "uuid", "name": "Main Warehouse", "type": "WAREHOUSE" }
}
```

**Low stock list** — items where `quantity <= reorderPoint` (when set) or `quantity <= 0`:

```json
{
  "data": [
    {
      "id": "uuid",
      "locationId": "uuid",
      "itemId": "uuid",
      "quantity": "5.000",
      "reorderPoint": "20.000",
      "purchasePrice": "25.50",
      "status": "LOW_STOCK",
      "shortage": "15.000",
      "item": { "id": "uuid", "sku": "SKU1", "description": "Widget", "unit": "pcs" },
      "location": { "id": "uuid", "name": "Main Warehouse", "type": "WAREHOUSE" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

`status`: `LOW_STOCK` (at/below reorder point) or `OUT_OF_STOCK` (quantity ≤ 0).

**Create**

```json
{
  "description": "Widget",
  "locationId": "uuid",
  "quantity": 100,
  "purchasePrice": 25.5,
  "reorderPoint": 20,
  "sku": "optional",
  "unit": "pcs",
  "itemType": "FINISHED"
}
```

**Update** (`PATCH /inventory/:id`)

```json
{
  "description": "Widget Pro",
  "sku": "SKU-001",
  "unit": "pcs",
  "itemType": "FINISHED",
  "purchasePrice": 26.0,
  "reorderPoint": 20
}
```

- `description` — item name (cannot be empty)
- `sku` — string or `null` to clear; must be unique across items (`409` if taken)
- `unit` — string or `null` to clear
- `itemType` — `RAW` \| `SEMI` \| `FINISHED` \| `OTHER`, or `null` to clear
- `purchasePrice`, `reorderPoint` — stock-level fields (`reorderPoint` may be `null` to clear)

**Quantity is not editable via PATCH.** Use stock adjustments below.

Item fields (`description`, `sku`, `unit`, `itemType`) update the shared catalog item (all locations that use that item). When stock crosses at or below the reorder point, users with `inventory.read` receive a `LOW_STOCK` in-app notification.

### Stock adjustments (audited qty changes)

Professional inventory systems do not silently overwrite quantity. Use adjustments for damage, loss, cycle count, found stock, opening balance, etc.

**Create** `POST /inventory/adjustments` — `inventory.adjust`

```json
{
  "locationId": "uuid",
  "itemId": "uuid",
  "direction": "out",
  "quantity": 5,
  "reason": "DAMAGE",
  "notes": "Broken in transit",
  "reference": "COUNT-2026-06"
}
```

| Field | Notes |
|-------|--------|
| `direction` | `in` (increase) or `out` (decrease) |
| `quantity` | Positive amount to move |
| `reason` | `DAMAGE` \| `LOSS` \| `FOUND` \| `COUNT` \| `OPENING` \| `RETURN` \| `OTHER` |
| `notes` / `reference` | Optional audit text |
| `purchasePrice` | Optional; only for `in` (updates weighted avg cost) |

Rules:
- `DAMAGE` / `LOSS` require `direction: "out"`
- `FOUND` / `OPENING` require `direction: "in"`
- `out` fails with `400` if available stock is insufficient
- Response includes `quantityBefore`, `quantityAfter`, `createdBy`

**List** `GET /inventory/adjustments` — filters: `locationId`, `itemId`, `direction`, `reason`, `search`, `from`/`to`, `page`/`limit`

```json
{
  "data": [
    {
      "id": "uuid",
      "locationId": "uuid",
      "itemId": "uuid",
      "direction": "out",
      "quantity": "5.000",
      "quantityBefore": "100.000",
      "quantityAfter": "95.000",
      "reason": "DAMAGE",
      "notes": "Broken in transit",
      "reference": "COUNT-2026-06",
      "createdById": "uuid",
      "createdAt": "2026-06-20T12:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Excel import** — `multipart/form-data`, field name `file`.

Expected columns (case-insensitive): `description`, `quantity`, `purchasePrice` / `purchase_price` / `price`, optional `sku`, optional `reorderPoint` / `reorder_point`, optional `itemType` (`RAW` \| `SEMI` \| `FINISHED` \| `OTHER`).

Item create/update also accepts `itemType` for manufacturing classification.

**Excel export (frontend)** — `inventory.read` users can export the current filters from the Stock Ledger page. The UI fetches all matching pages and downloads a CSV file (opens in Excel) with columns: `description`, `sku`, `unit`, `itemType`, `quantity`, `purchasePrice`, `reorderPoint`, `location`, `stockValue`. Export respects active `locationId` (omit for all locations), `search`, `from`, and `to` filters.

---

## Bills of materials (BOM)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/boms` | `bom.read` |
| GET | `/boms/:id` | `bom.read` |
| POST | `/boms` | `bom.write` |
| PATCH | `/boms/:id` | `bom.write` |
| DELETE | `/boms/:id` | `bom.write` (soft-deactivate) |

**Create**

```json
{
  "finishedItemId": "uuid",
  "name": "Standard chair",
  "version": "1.0",
  "notes": "optional",
  "lines": [
    { "componentItemId": "uuid", "quantity": 4, "scrapPercent": 2 },
    { "componentItemId": "uuid", "quantity": 1 }
  ]
}
```

`quantity` is per **1 finished unit**. `scrapPercent` increases required material (e.g. 2% scrap).

List filters: `finishedItemId`, `isActive` (`true`\|`false`), `search`, `page`, `limit`.

---

## Production orders

| Method | Path | Permission |
|--------|------|------------|
| GET | `/production-orders` | `production.read` |
| GET | `/production-orders/:id` | `production.read` |
| POST | `/production-orders` | `production.write` |
| POST | `/production-orders/:id/release` | `production.write` |
| POST | `/production-orders/:id/issue` | `production.write` |
| POST | `/production-orders/:id/complete` | `production.write` |
| POST | `/production-orders/:id/cancel` | `production.write` |

**Lifecycle:** `DRAFT` → `RELEASED` → `IN_PROGRESS` → `COMPLETED` (or `CANCELLED`).

**Create** — snapshots BOM lines into the order (required qty = BOM qty × planned × scrap factor):

```json
{
  "bomId": "uuid",
  "locationId": "uuid",
  "quantityPlanned": 10,
  "notes": "optional"
}
```

**Issue materials** — body optional; omit `lines` to issue all remaining:

```json
{
  "lines": [{ "componentItemId": "uuid", "quantity": 20 }]
}
```

**Complete** — receive finished goods; defaults to auto-issuing any shortfall:

```json
{ "quantity": 10, "autoIssue": true }
```

Finished-good unit cost is set from consumed component costs (weighted). Cancel returns issued (but not completed) materials to stock.

List filters: `locationId`, `finishedItemId`, `bomId`, `status`, `search`, `from`/`to`, `page`/`limit`.

---

## Stock transfers

| Method | Path | Permission |
|--------|------|------------|
| GET | `/stock-transfers` | `stock_transfer.read` |
| GET | `/stock-transfers/:id` | `stock_transfer.read` |
| POST | `/stock-transfers` | `stock_transfer.write` |
| DELETE | `/stock-transfers/:id` | `stock_transfer.write` (void completed transfer) |

```json
{
  "fromLocationId": "uuid",
  "toLocationId": "uuid",
  "notes": "optional",
  "lines": [{ "itemId": "uuid", "quantity": 10 }]
}
```

**Line `itemId`:** Product UUID from `GET /inventory` (`itemId` or `item.id`) — not SKU, not the stock row `id`.

---

## Suppliers & customers

| Resource | GET list | GET one | POST | PATCH | DELETE |
|----------|----------|---------|------|-------|--------|
| `/suppliers` | `suppliers.read` | `suppliers.read` | `suppliers.write` | `suppliers.write` | `suppliers.write` |
| `/customers` | `customers.read` | `customers.read` | `customers.write` | `customers.write` | `customers.write` |

Body fields: `name`, `phone`, `email`, `address`, `isActive` (PATCH).

---

## CRUD coverage by resource

| Resource | List | Get | Create | Update | Delete / void |
|----------|------|-----|--------|--------|----------------|
| Users | ✓ | ✓ | ✓ | ✓ | ✓ (soft) |
| Roles | ✓ | ✓ | ✓ | ✓ | ✓ |
| Locations | ✓ | ✓ | ✓ | ✓ | ✓ (soft `isActive`) |
| Inventory | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stock transfers | ✓ | ✓ | ✓ | — | ✓ (void, reverses stock) |
| Suppliers / customers | ✓ | ✓ | ✓ | ✓ | ✓ (soft) |
| **Purchases** | ✓ | ✓ | ✓ | ✓ (full document) | ✓ (void) |
| **Sales** | ✓ | ✓ | ✓ | ✓ (full document) | ✓ (void) |
| Expenses | ✓ | — | ✓ | ✓ (metadata) | ✓ (reverses bank) |
| Bank accounts | ✓ | ✓ | ✓ | ✓ | — |
| Credits | ✓ | — | pay only | — | — |
| Dashboard / P&amp;L | read only | | | | |

**PATCH** on purchases/sales accepts the same fields as **POST** (all optional). Omitting `lines` keeps existing line items. Sending `lines` replaces all lines. Stock, bank, and credit records are reconciled in one transaction. If credit payments exist (`paidAmount` > 0), only `notes` may be updated. Use **DELETE** to void when reversal is not enough.

---

## Purchases

| Method | Path | Permission |
|--------|------|------------|
| GET | `/purchases?includeVoided=true` | `purchase.read` |
| GET | `/purchases/:id` | `purchase.read` |
| POST | `/purchases` | `purchase.write` |
| PATCH | `/purchases/:id` | `purchase.write` |
| DELETE | `/purchases/:id` | `purchase.write` (void) |

```json
{
  "supplierId": "uuid",
  "locationId": "uuid",
  "paymentMethod": "BANK",
  "bankAccountId": "uuid",
  "notes": "optional",
  "creditDueDate": "2026-06-30",
  "lines": [
    { "itemId": "uuid", "quantity": 50, "unitPrice": 20 }
  ]
}
```

**Line `itemId`:** Must be the **product** UUID (`inventory.itemId` or `inventory.item.id` from `GET /inventory`). Do **not** send SKU, numeric ids, or empty strings. The stock row’s own `id` is only valid if it equals `itemId` (it usually does not).

- `BANK` / `CASH`: require `bankAccountId`. **CASH** must use an account with `accountType: "CASH"`; **BANK** must use `accountType: "BANK"` (API returns `400` if mismatched).
- `CREDIT`: creates supplier credit record; optional `creditDueDate`.
- Stock increases at `locationId` (weighted average purchase price).
- All steps run in a single database transaction.

**PATCH** `/purchases/:id` — partial body; reconciles stock/bank/credit when any field other than `notes` alone changes. Blocked when linked supplier credit has payments (notes-only then).

**DELETE** `/purchases/:id` — voids document (`status: VOIDED`), reverses stock and bank, removes unpaid credit.

---

## Sales

| Method | Path | Permission |
|--------|------|------------|
| GET | `/sales?includeVoided=true&soldByUserId=uuid` | `sales.read` |
| GET | `/sales/commissions/summary?from=&to=&soldByUserId=` | `sales.read` |
| GET | `/sales/:id` | `sales.read` |
| POST | `/sales` | `sales.write` |
| PATCH | `/sales/:id` | `sales.write` |
| DELETE | `/sales/:id` | `sales.write` (void) |

```json
{
  "customerId": "uuid",
  "locationId": "uuid",
  "paymentMethod": "CASH",
  "bankAccountId": "uuid",
  "allowNegativeStock": false,
  "creditDueDate": "2026-06-30",
  "soldByUserId": "uuid",
  "commissionPercent": 10,
  "commissionBasis": "PROFIT",
  "lines": [{ "itemId": "uuid", "quantity": 2, "unitPrice": 35 }]
}
```

**Commission / sales rep**

| Field | Default | Meaning |
|--------|---------|---------|
| `soldByUserId` | creator | User credited for the sale |
| `commissionPercent` | `10` | 0–100 rate applied to the commission base |
| `commissionBasis` | `"PROFIT"` | `"PROFIT"` or `"SALES"` — what the percent applies to |

**Commission bases**

| `commissionBasis` | Base amount | Formula |
|-------------------|-------------|---------|
| `PROFIT` (default) | Gross profit on the sale | `Σ (lineTotal − quantity × purchaseCost)` per line; negative profit is treated as `0` |
| `SALES` | Sale subtotal | Sum of line totals (same as `subtotal`) |

Examples (default `commissionPercent: 10`, `commissionBasis: "PROFIT"`):

- Subtotal `1000`, cost `700` → profit `300` → `commissionAmount: "30.00"`
- Same sale with `"commissionBasis": "SALES"` → `commissionAmount: "100.00"`

Sale responses include `soldByUserId`, `commissionPercent`, `commissionBasis`, `commissionAmount`, and nested `soldByUser` (`id`, `fullName`, `email`).

Users with `sales.on_behalf` may set `soldByUserId` to any active user; others default to self.

**GET** `/sales/commissions/summary` — per-rep totals for active sales:

```json
[
  {
    "soldByUserId": "uuid",
    "soldByUserName": "Jane Rep",
    "saleCount": 12,
    "totalSubtotal": "45000.00",
    "totalCommission": "2250.00"
  }
]
```

**Line `itemId`:** Product UUID from `GET /inventory` (`itemId` or `item.id`) — not SKU, not the stock row `id`.

**Behavior**

- If stock is insufficient and `allowNegativeStock` is false → `400` with message.
- If `allowNegativeStock` is true → requires `sales.negative_stock` permission; response may include `stockWarnings` array.
- `CREDIT` requires `customerId`; creates customer credit; optional `creditDueDate`.
- `BANK` / `CASH` require `bankAccountId`; account type must match payment method (see purchases).
- All steps run in a single database transaction.

**PATCH** `/sales/:id` — same rules as purchases; optional `soldByUserId`, `commissionPercent`, and `commissionBasis` (metadata-only patch without `lines` recalculates commission from existing line profit/subtotal). May return `stockWarnings` when `allowNegativeStock` is true. Requires `sales.negative_stock` when enabling negative stock on update.

**DELETE** `/sales/:id` — voids document, reverses stock and bank, removes unpaid customer credit.

---

## Credits

| Method | Path | Permission |
|--------|------|------------|
| GET | `/credits/customers` | `credit.read` |
| GET | `/credits/suppliers` | `credit.read` |
| POST | `/credits/customers/:id/payments` | `credit.write` |
| POST | `/credits/suppliers/:id/payments` | `credit.write` |

**Payment body**

```json
{
  "amount": 500,
  "bankAccountId": "uuid"
}
```

Customer payment = money in; supplier payment = money out.

---

## Expenses

| Method | Path | Permission |
|--------|------|------------|
| GET | `/expenses/categories` | `expense.read` |
| POST | `/expenses/categories` | `expense.write` |
| GET | `/expenses` | `expense.read` |
| POST | `/expenses` | `expense.write` |
| PATCH | `/expenses/:id` | `expense.write` |
| DELETE | `/expenses/:id` | `expense.write` |

```json
{
  "categoryId": "uuid",
  "bankAccountId": "uuid",
  "amount": 150,
  "description": "Rent",
  "expenseDate": "2026-05-30"
}
```

Reduces bank balance automatically (transactional).

**DELETE** `/expenses/:id` — removes the expense and **reverses** the linked bank transaction.

---

## Bank accounts

| Method | Path | Permission |
|--------|------|------------|
| GET | `/banks/accounts?type=CASH\|BANK` | `bank.read` |
| GET | `/banks/liquidity` | `bank.read` |
| GET | `/banks/accounts/:id` | `bank.read` |
| POST | `/banks/accounts` | `bank.write` |
| PATCH | `/banks/accounts/:id` | `bank.write` |
| GET | `/banks/transactions?bankAccountId=&type=&direction=` | `bank.read` |
| POST | `/banks/transactions/adjustment` | `bank.write` |

**List query (`GET /banks/transactions`)**

| Param | Description |
|-------|-------------|
| `bankAccountId` | Filter to one account (recommended) |
| `type` | `SALE`, `PURCHASE`, `ADJUSTMENT`, `CREDIT_PAYMENT`, or `EXPENSE` |
| `direction` | `in` (money in) or `out` (money out) |
| `search` | Case-insensitive match on `description` |
| `from` / `to` | ISO date range on `createdAt` |
| `page` / `limit` | Pagination (default 20, max 100) |

**List row shape**

```json
{
  "id": "uuid",
  "bankAccountId": "uuid",
  "type": "SALE",
  "direction": "in",
  "amount": "10000.00",
  "balanceAfter": "15000.00",
  "description": "Sale …",
  "refType": "sale",
  "refId": "uuid",
  "createdAt": "2026-06-20T06:26:18.156Z",
  "bankAccount": { "id": "uuid", "name": "Main Bank", "accountType": "CASH" }
}
```

`amount` is always positive; use `direction` for sign in the UI.

| `direction` | Meaning |
|-------------|---------|
| `in` | Money into the account (sale, customer credit receipt, purchase void reversal, opening/manual deposit) |
| `out` | Money out of the account (purchase, expense, supplier credit payment, sale void reversal) |

`type` values:

| `type` | Typical `refType` | Meaning |
|--------|-------------------|---------|
| `SALE` | `sale` | Cash/bank received from a sale |
| `PURCHASE` | `purchase` | Cash/bank paid for a purchase |
| `ADJUSTMENT` | `purchase_reversal`, `sale_reversal`, manual | Balance correction or document void reversal |
| `CREDIT_PAYMENT` | `supplier_credit_payment`, `customer_credit_payment` | Credit settlement in/out |
| `EXPENSE` | `expense` | Expense payment out of account |

**Account fields**

| Field | Required | Purpose |
|-------|----------|---------|
| `name` | yes | Short **display label** in dropdowns (e.g. `"Main Bank"`, `"Cash"`) |
| `accountType` | yes on create | `CASH` = cash till / petty cash; `BANK` = real bank account |
| `bankName` | no | **Provider / institution** (e.g. `"Commercial Bank of Ethiopia"`) |
| `accountHolderName` | no | **Name on the account** (business or person) |
| `accountNumber` | no | Account number at the bank |
| `balance` | no | Opening balance on create only (default `0`) |
| `isActive` | no | PATCH only — set `false` to soft-deactivate |

**Create / update body**

```json
{
  "name": "Main Bank",
  "accountType": "BANK",
  "bankName": "Commercial Bank of Ethiopia",
  "accountHolderName": "Noble Store PLC",
  "accountNumber": "1000123456789",
  "balance": 0
}
```

**Payment account picker (purchases / sales)**

| `paymentMethod` | Call `GET /banks/accounts?type=` |
|-----------------|----------------------------------|
| `CASH` | `type=CASH` only |
| `BANK` | `type=BANK` only |
| `CREDIT` | no account |

The frontend auto-selects the cash till when `paymentMethod` is `CASH` and only one CASH account exists; shows a picker when multiple cash tills exist or when payment is `BANK`.

**GET `/banks/liquidity`** — accounts plus totals:

```json
{
  "accounts": [{ "id": "uuid", "name": "Cash", "accountType": "CASH", "balance": "5000.00" }],
  "totals": {
    "cashTotal": "5000.00",
    "bankTotal": "25000.00",
    "totalLiquidity": "30000.00"
  }
}
```

**Adjustment**

```json
{
  "bankAccountId": "uuid",
  "amount": 1000,
  "direction": "in",
  "description": "Opening balance"
}
```

---

## Dashboard

### GET `/dashboard` — `dashboard.read`

Optional query: `?from=2026-05-01&to=2026-05-31` filters the `profitAndLoss` block (daily sales/purchases remain today-only).

```json
{
  "totalInventoryValue": "125000.00",
  "stockValueByLocation": [
    { "locationId": "uuid", "locationName": "Main Warehouse", "value": "80000.00" }
  ],
  "showroomCount": 3,
  "dailySales": "4500.00",
  "dailyPurchases": "2000.00",
  "profitAndLoss": {
    "revenue": "50000.00",
    "costOfGoodsSold": "35000.00",
    "grossProfit": "15000.00",
    "totalExpenses": "5000.00",
    "netProfit": "10000.00"
  },
  "financialOverview": {
    "cashTotal": "5000.00",
    "bankTotal": "20000.00",
    "totalLiquidity": "25000.00",
    "totalBankBalance": "25000.00",
    "bankAccounts": [
      { "id": "uuid", "name": "Cash", "accountType": "CASH", "bankName": null, "balance": "5000.00" },
      { "id": "uuid", "name": "Main Bank", "accountType": "BANK", "bankName": "CBE", "balance": "20000.00" }
    ]
  }
}
```

`totalLiquidity` = `cashTotal` + `bankTotal`. `totalBankBalance` is kept for older clients (same as `totalLiquidity`).

---

## Profit & loss

| Method | Path | Permission |
|--------|------|------------|
| GET | `/profit-loss/summary?from=&to=` | `profit_loss.read` |
| GET | `/profit-loss/by-item?from=&to=` | `profit_loss.read` |

**Per-item row**: `itemId`, `description`, `quantitySold`, `revenue`, `cost`, `profit`, `marginPercent`.

---

## Notifications (in-app)

User-scoped in-app notifications. Any authenticated user can manage **their own** notifications — no extra permission required. Poll `GET /notifications/unread-count` for badge counts (no WebSocket/SSE yet).

Notifications are created automatically when you record a **sale**, **purchase**, or **stock transfer**. Low-stock / out-of-stock alerts go to users with `inventory.read`.

| Method | Path | Auth |
|--------|------|------|
| GET | `/notifications` | Bearer token |
| GET | `/notifications/:id` | Bearer token |
| GET | `/notifications/unread-count` | Bearer token |
| PATCH | `/notifications/read-all` | Bearer token |
| PATCH | `/notifications/:id/read` | Bearer token |
| DELETE | `/notifications/:id` | Bearer token |

**List query params:** `page`, `limit`, `search`, `from`, `to`, `isRead` (`true`|`false`), `module` (e.g. `sales`, `inventory`).

**List response**

```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "module": "sales",
      "type": "SALE",
      "title": "Sale completed",
      "message": "Sale #1234 recorded at Main Showroom",
      "entityType": "sale",
      "entityId": "uuid",
      "isRead": false,
      "readAt": null,
      "metadata": { "total": "1250.00" },
      "createdAt": "2026-06-10T12:34:56.000Z",
      "updatedAt": "2026-06-10T12:34:56.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Unread count:** `{ "count": 3 }`

**Mark all read:** `{ "updated": 3 }`

**Dismiss:** `{ "success": true }`

**Get one:** returns a single notification object (same shape as a list item).

### Notification types (`type` field)

| Value | Typical use |
|-------|-------------|
| `LOW_STOCK` | Inventory below threshold |
| `STOCK_TRANSFER` | Transfer completed / pending |
| `SALE` | Sale events |
| `PURCHASE` | Purchase events |
| `CREDIT_DUE` | Credit payment reminders |
| `EXPENSE` | Expense events |
| `SYSTEM` | General system messages |

Use `entityType` + `entityId` to deep-link to the related record from the notification detail page (e.g. `/sales/:entityId`). The UI route for a notification is `/notifications/:id`.

The frontend polls unread count every 60s and maps entity types in `lib/notification-routes.ts`.

---

## Users & roles (admin)

| Method | Path | Permission |
|--------|------|------------|
| GET/POST/PATCH/DELETE | `/users` | `users.read` / `users.write` |
| GET/POST/PATCH/DELETE | `/roles` | `roles.read` / `roles.write` |
| GET | `/permissions` | `roles.read` |

**Create role**

```json
{
  "name": "Accountant",
  "description": "Finance only",
  "permissionIds": ["uuid", "uuid"]
}
```

**Create user**

```json
{
  "email": "user@example.com",
  "password": "secret123",
  "fullName": "Jane Doe",
  "roleId": "uuid"
}
```

**Update user** (PATCH `/users/:id`)

```json
{
  "fullName": "Jane Doe",
  "roleId": "uuid",
  "password": "optional-new-password"
}
```

---

## Error format

NestJS default:

```json
{
  "statusCode": 400,
  "message": "Stock unavailable: ...",
  "error": "Bad Request"
}
```

| Code | Meaning |
|------|---------|
| 401 | Missing/invalid token |
| 403 | Missing permission |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |

---

## Health

`GET /api/health` — no auth.

```json
{
  "status": "ok",
  "service": "inventory-api",
  "currency": { "code": "ETB", "symbol": "Br" }
}
```

---

## Currency

All monetary amounts are **numbers in Ethiopian Birr (ETB)** unless you override server env. There is no multi-currency conversion — values are stored and returned as decimals (e.g. `"1250.00"`).

| Env | Default | Meaning |
|-----|---------|---------|
| `CURRENCY` | `ETB` | ISO 4217 code for labels |
| `CURRENCY_SYMBOL` | `Br` | Short symbol for UI (e.g. `Br 1,250.00`) |

`GET /health` and dashboard / P&amp;L summary include:

```json
"currency": { "code": "ETB", "symbol": "Br" }
```

The frontend loads currency from `/health` on startup (defaults to ETB / `Br`) and formats amounts as `{symbol} {amount}` (e.g. `Br 1,250.00`).

---

## Setup checklist

### Backend (this repo)

1. `npm run db:create` (or create `stock_management` in Postgres manually).
2. Run `database/schema.sql` **or** set `DB_SYNCHRONIZE=true` for dev only.
3. Set `.env` (`DB_PASSWORD` must be a string; empty breaks pg SASL auth).
4. `DB_SEED=true` on first run → roles, permissions, admin, default warehouse, **Main Bank** + **Cash** accounts.
5. `npm run start:dev` → `http://localhost:3001/api`

Default admin: `admin@stock.local` / `Admin@123` (override with `SEED_ADMIN_*`).

**CORS:** `CORS_ORIGIN=http://localhost:3000` (comma-separated for multiple origins).

### Frontend (Next.js)

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001/api
npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Frontend route map

| UI route | Primary API |
|----------|-------------|
| `/login` | `POST /auth/login` |
| `/account` | `PATCH /auth/me`, `PATCH /auth/me/password` |
| `/dashboard` | `GET /dashboard` |
| `/inventory` | `/inventory`, `/inventory/low-stock`, `/inventory/adjustments`, import |
| `/boms`, `/boms/new`, `/boms/[id]`, `/boms/[id]/edit` | `/boms` |
| `/production-orders`, `/production-orders/new`, `/production-orders/[id]` | `/production-orders` (+ `release` / `issue` / `complete` / `cancel`) |
| `/stock-transfers`, `/stock-transfers/[id]` | `/stock-transfers` |
| `/purchases`, `/purchases/new`, `/purchases/[id]`, `/purchases/[id]/edit` | `/purchases` (POST, PATCH, DELETE void) |
| `/sales`, `/sales/new`, `/sales/[id]`, `/sales/[id]/edit`, `/sales/commissions` | `/sales`, `/sales/commissions/summary` (POST, PATCH, DELETE void) |
| `/credits` | `/credits/*` |
| `/expenses` | `/expenses` |
| `/banks` | `/banks/*` |
| `/profit-loss` | `/profit-loss/*` |
| `/reports` | `/reports/*` |
| `/locations`, `/suppliers`, `/customers` | master data + PATCH |
| `/users`, `/roles` | admin CRUD |
| `/notifications`, `/notifications/[id]` | in-app notification bell, list, and detail |
