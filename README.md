# 🛒 Demo Shop — POS System

Production-grade, Offline-First Point of Sale system for Supershop, Departmental Store & Pharmacy.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Electron.js |
| Backend | Node.js + Express.js |
| Database | PostgreSQL 18 + Prisma ORM |
| Auth | JWT + bcrypt |
| Cloud Backup | Google Drive API |
| Printing | ESC/POS thermal printer |

## Project Structure

```
/ShopManagement
  /backend          ← Express REST API (Port 5000)
  /frontend         ← React + Electron Desktop App
  /database         ← Prisma schema, migrations, seeders
  /scripts          ← Backup, restore, installer scripts
  /docs
```

## Local Dev Setup

### Prerequisites
- Node.js v18+
- PostgreSQL 18 (running on port 5432)
- npm v9+

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Setup environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your PostgreSQL credentials
```

### 3. Run database migration
```bash
npm run db:migrate
```

### 4. Seed database (creates default admin user)
```bash
npm run db:seed
```

### 5. Start development server
```bash
npm run dev
```

Backend runs on: http://localhost:5000  
Frontend runs on: http://localhost:3000

### Default Login Credentials
- **Phone:** 01700000000
- **Password:** admin123

> ⚠️ Change the admin password immediately after first login!

## Production Build

```bash
npm run build
```

## Default Admin User
| Field | Value |
|---|---|
| Name | Admin |
| Phone | 01700000000 |
| Password | admin123 |
| Role | ADMIN |

## Environment Variables (backend/.env)

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 5000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `GOOGLE_DRIVE_*` | Google Drive backup credentials |
| `BACKUP_PASSWORD` | Password for backup zip files |
| `SHOP_NAME` | Shop name shown on receipts |

## Modules

- **Module A** — POS Billing Counter
- **Module B** — Inventory & Stock Management  
- **Module C** — Supplier & Purchase Management
- **Module D** — Customer CRM (Loyalty Points, Baki)
- **Module E** — Employee & Shift Management
- **Module F** — Reporting & Analytics Dashboard
