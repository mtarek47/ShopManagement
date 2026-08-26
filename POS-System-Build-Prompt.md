# 🛒 AI Coding Agent Prompt: Auto-Sync Offline POS System

> **Kivabe use korbe:** Ei entire document ta copy kore Claude Code, Cursor, ba onno kono coding agent-er প্রথম prompt hisebe দিয়ে দাও। Agent eta পড়ে পুরো project scaffold kore দেবে। প্রতিটা Phase আলাদা করে diteo paro, othoba পুরোটা একসাথে দিয়ে "Start with Phase 1" bolte paro.

---

## 🎯 Project Overview

Tumi ekta **production-grade, offline-first Point of Sale (POS) system** banabe Supershop, Departmental Store, ar Pharmacy-r jonne. System ta local network e completely offline chalbe, kintu automatically cloud e backup nebe. Ei prompt-e full tech stack, architecture, database schema, module-wise features, ar acceptance criteria deya ache — kono ambiguity thakle sensible default dhore agiye jao, kintu major architectural decision-e comment kore janiye dio.

**Core principle:** Offline-first. Internet na thakleo billing, stock, everything 100% kaj korte hobe. Internet sudhu backup ar (future) multi-branch sync-er jonne lagbe.

---

## 🛠️ Tech Stack (Fixed — deviate korle reason দিয়ে janiye dio)

| Layer | Technology |
|---|---|
| Frontend | React.js, packaged as Desktop App via Electron.js |
| Backend | Node.js + Express.js (REST API) |
| Database | PostgreSQL |
| ORM | Prisma (recommended — type-safe, migration-friendly) |
| Background Services | PM2 (Linux) / NSSM (Windows) for process management, auto-boot |
| Scheduled Jobs | node-cron (daily backup, expiry checks, etc.) |
| Cloud Backup | Google Drive API (OAuth2 service account or refresh-token flow) |
| Charts | Recharts or Chart.js |
| Auth | JWT + bcrypt, role-based middleware |
| Printing | ESC/POS thermal printer library (e.g. `node-thermal-printer`) |
| Barcode | `jsbarcode` / `bwip-js` for generation, camera or USB HID scanner for scanning |

---

## 🚀 Phase 0: Project Scaffolding

1. Monorepo structure:
   ```
   /pos-system
     /backend        (Express API)
     /frontend        (React + Electron)
     /database        (Prisma schema, migrations, seeders)
     /scripts          (backup, restore, installer scripts)
     /docs
   ```
2. Setup `.env.example` for both backend and frontend (DB creds, Google Drive API keys, JWT secret, PORT).
3. Setup Prisma with PostgreSQL connection.
4. Setup ESLint + Prettier for consistent code style.
5. Write a top-level `README.md` explaining local dev setup and production build/install steps.

**Deliverable check:** `npm run dev` boots backend on localhost, Prisma connects to local Postgres, React dev server runs, Electron opens a blank window hitting the backend health-check endpoint.

---

## 🔁 Phase 1: Auto-Boot & Background Service System

- On Windows PC restart: PostgreSQL service auto-starts (native Windows service), Express backend auto-starts via **NSSM** (registered as a Windows service) or **PM2 + pm2-windows-startup**.
- Electron app shortcut placed in Windows Startup folder, auto-launches **full-screen kiosk mode** pointing to `localhost:<PORT>`.
- Write a `scripts/install.ps1` (or `.bat`) that:
  - Installs Postgres if not present (or checks for it),
  - Registers backend as a service via NSSM,
  - Copies Electron shortcut into Startup folder,
  - Runs initial Prisma migration + seed (default admin user).
- Add a health-check/retry loop in Electron's main process — if backend isn't up yet on boot, show a loading splash and retry connecting every 2s.

**Acceptance:** Restart PC → within ~30s POS app is open full-screen and ready to bill, with zero manual steps.

---

## ☁️ Phase 2: Automated Cloud Backup & Restore

- `node-cron` job (default: daily at 2:00 AM, configurable from Admin Settings) that:
  1. Runs `pg_dump` to produce a `.sql` file.
  2. Compresses it into a **password-protected `.zip`** (use `archiver` + a zip-encryption lib, or shell out to 7-Zip with `-p` flag).
  3. Uploads to a dedicated Google Drive folder via Google Drive API, naming files `backup_YYYY-MM-DD_HHmm.zip`.
  4. Keeps a rolling retention (e.g. last 30 daily backups) — deletes older ones from Drive.
  5. Logs backup success/failure to a `backup_logs` table, visible on Admin Dashboard.
- **One-Click Restore** flow (Admin Panel):
  1. List available backups fetched from Google Drive (with date/size).
  2. Admin selects one → downloads → prompts for zip password → decompresses → runs `pg_restore`/`psql` to rebuild DB.
  3. Show a clear warning + confirmation modal ("This will overwrite current data") before executing.
- Add a manual "Backup Now" button too, not just scheduled.

**Acceptance:** Killing and reprovisioning the app on a fresh PC, then restoring the latest backup, brings back all products, sales, customers exactly as before.

---

## 📦 Phase 3: Database Schema (Prisma models — design these tables)

Design normalized PostgreSQL tables covering at least:

- `users` (id, name, phone, password_hash, role: ADMIN/MANAGER/CASHIER, active)
- `products` (id, name, sku/barcode, category_id, brand_id, cost_price, sale_price, unit, current_stock, low_stock_threshold, expiry_date, is_active)
- `categories`, `brands`
- `suppliers` (id, name, contact, address, total_due)
- `purchase_orders` + `purchase_order_items` (supplier stock-in records)
- `customers` (id, name, phone, loyalty_points, store_credit_due)
- `sales` (id, invoice_no, cashier_id, customer_id, subtotal, discount, total, payment_method, payment_status, created_at)
- `sale_items` (sale_id, product_id, qty, unit_price, discount, subtotal)
- `sale_payments` (sale_id, method: CASH/CARD/BKASH/NAGAD/ROCKET, amount) — supports **split payment**
- `held_carts` (suspended carts, cashier_id, cart_json, created_at)
- `stock_adjustments` (damage/loss/return entries — product_id, qty, reason, type, created_by)
- `backup_logs`
- `shift_reports` (day-close cash drawer reconciliation: expected vs actual cash)

Write full Prisma schema with proper relations, indexes on `barcode`, `invoice_no`, and foreign keys with `onDelete` behavior thought through (e.g. don't hard-delete products with sale history — use `is_active` soft delete instead).

---

## 🧩 Phase 4: Core Modules

### Module A — POS & Billing Counter (Cashier Screen)
- Barcode scan input (auto-focus hidden input field that listens for scanner's rapid keystrokes + Enter) → instantly adds to cart.
- **Hold/Suspend Cart**: save current cart to `held_carts`, clear screen, allow starting a new bill; held carts list accessible to resume.
- **Split payment**: allow entering multiple payment rows (Cash + bKash etc.) that must sum to total before confirming sale.
- **Dynamic discounting**: per-line-item discount (flat/%) and whole-bill discount (flat/%), permission-gated by role (see Module E).
- **Return/Refund**: search past invoice by number/phone, select items to return, auto-recalculate change due, auto-increment product stock back.
- **Thermal receipt printing**: print + reprint, and send cash-drawer-open command (`ESC/POS` pulse command) on cash sales.
- **Keyboard shortcuts** (NFR requirement): F2 = Pay, Esc = Cancel/Clear cart, F4 = Hold, F6 = Search product, etc. Document the full shortcut map in-app (a "?" help overlay).
- Target: cart-add and payment-submit API calls must respond <100ms locally — avoid unnecessary joins/queries in the hot path, use indexed lookups.

### Module B — Inventory & Stock Management
- Real-time stock decrement on sale (within the same DB transaction as the sale, to avoid race conditions on concurrent cashiers).
- Low-stock dashboard widget (red badge) — threshold configurable per product.
- Expiry tracking with a daily cron check that flags products expiring within N days (configurable), shown as dashboard notifications.
- Barcode generator for locally-created products (no existing barcode) — printable label sheet.
- Category/Brand CRUD + filtering in product list.
- Damage/Loss entry form → creates `stock_adjustments` row, decrements stock, tags as loss for P&L reporting.

### Module C — Supplier & Purchase Management
- Supplier CRUD.
- Purchase Order entry: select supplier, add line items (product, qty, cost price) → on save, increments stock and updates `cost_price` (or maintain weighted-average cost — decide and document).
- Accounts Payable: running due-per-supplier, partial payment recording against a PO.

### Module D — Customer Management (CRM)
- Customer CRUD with purchase history view (join to `sales`).
- Loyalty points: configurable earn-rate (e.g. 1 point per 100 taka spent), redeemable as discount at checkout.
- Store Credit/Baki: allow a sale to be marked "on credit" against a customer, track due, record partial due-collection payments.

### Module E — Employee & Access Control
- JWT auth, roles: ADMIN, MANAGER, CASHIER.
- Middleware enforcing: Cashier can create sales but **cannot** delete products or exceed a configured max-discount% without Manager/Admin override (PIN-based override modal).
- Shift/Drawer management: at day-close, cashier enters actual cash counted; system computes expected cash (opening float + cash sales − cash refunds) and shows variance — saved as `shift_reports`.

### Module F — Reporting & Analytics Dashboard
- Real-time today's-sales, profit, transaction-count widgets.
- Sales reports: daily/weekly/monthly + custom date range, filterable by cashier/category.
- P&L statement: revenue − COGS (using cost_price) − losses (from stock_adjustments).
- Top-selling products chart (bar/line via Recharts).

---

## 🔒 Non-Functional Requirements

- **Speed**: local API responses under 100ms for billing-path endpoints — add DB indexes, avoid N+1 queries, consider connection pooling.
- **Keyboard-first UX** on POS screen as detailed in Module A.
- **Security**: DB password stored encrypted/in `.env` (never committed), backup zips password-protected, JWT secrets rotated per deployment, bcrypt for all password storage, rate-limiting on login endpoint.

---

## ✅ Suggested Build Order for the Agent

1. Phase 0 scaffold → 2. Database schema + Prisma migrations + seed script (default admin) → 3. Auth + RBAC middleware → 4. Module A (POS billing, since it's the core hot path) → 5. Module B (Inventory) → 6. Module F (basic dashboard) → 7. Module C & D → 8. Module E (shift/day-close) → 9. Phase 1 (auto-boot scripts) → 10. Phase 2 (backup/restore).

After each phase, **pause and summarize what was built, list any assumptions made, and show how to test it locally** before moving to the next phase.
