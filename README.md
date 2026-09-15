# 🛒 Smart Buy — Modern Web POS System (Dockerized)

Production-grade, Offline-First Point of Sale system for Supershop, Departmental Store & Pharmacy.
Now fully containerized with **Docker Compose** as a pure **Web Application** — no Electron required!

---

## ⚡ Quick Start on Windows (১-ক্লিকে চালানো)

যে কোনো Windows ল্যাপটপ বা কম্পিউটারে এই সফটওয়্যারটি চালানোর জন্য শুধুমাত্র **Docker Desktop** ইনস্টল থাকলেই চলবে (Node.js বা PostgreSQL ইনস্টল করার কোনো প্রয়োজন নেই)।

### পদক্ষেপসমূহ:
1. **Docker Desktop** ইনস্টল করুন (যদি না থাকে): [ডাউনলোড লিংক](https://www.docker.com/products/docker-desktop/)
2. Docker Desktop চালু করুন।
3. প্রজেক্ট ফোল্ডারে থাকা **`docker-start.bat`** ফাইলে ডাবল ক্লিক করুন।
   - এটি স্বয়ংক্রিয়ভাবে ডাটাবেজ, ব্যাকএন্ড ও ওয়েব ফ্রন্টএন্ড কনটেইনার চালু করবে।
   - ডাটাবেজ টেবিল এবং ডিফল্ট প্রোডাক্ট/অ্যাডমিন অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে তৈরি হবে।
   - কয়েক সেকেন্ডের মধ্যে আপনার ডিফল্ট ব্রাউজারে `http://localhost:3000` স্বয়ংক্রিয়ভাবে ওপেন হবে!
4. কাজ শেষে অ্যাপ বন্ধ করতে **`docker-stop.bat`** ফাইলে ডাবল ক্লিক করুন।

---

## 🔑 ডিফল্ট লগইন তথ্য (Default Login Credentials)

| Account | Phone Number | Password | Role |
|---|---|---|---|
| **Root Master Account** | `01999999999` | `superadmin123` | **SUPER_ADMIN** |
| **Store Admin** | `01700000000` | `admin123` | **ADMIN** |

> ⚠️ **নিরাপত্তা সতর্কতা:** প্রথমবার লগইন করার পর অ্যাডমিন প্রোফাইল থেকে পাসওয়ার্ড পরিবর্তন করে নিন।

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend Web** | React 18 + Vite + TailwindCSS | Served via **Nginx** on port `3000` |
| **Backend API** | Node.js (v20) + Express.js | Internal REST API on port `5000` |
| **Database** | PostgreSQL 16 + Prisma ORM | Persistent volume `pos_postgres_data` on port `5432` |
| **Web Server / Proxy** | Nginx Alpine | Handles Single-Page App routing & reverse-proxies `/api` |
| **Printing** | Browser Native Print (`window.print`) | Supports thermal receipt printers (58mm/80mm) & PDF export |

---

## 📂 Project Structure

```
/ShopManagement
  ├── docker-compose.yml     ← Master multi-container orchestrator
  ├── docker-start.bat       ← Windows 1-click launcher (starts app & opens browser)
  ├── docker-stop.bat        ← Windows 1-click shutdown script
  ├── docker-start.sh        ← macOS / Linux launcher script
  ├── docker-stop.sh         ← macOS / Linux stop script
  ├── .env.docker            ← Docker environment configuration
  ├── frontend/
  │   ├── Dockerfile         ← Multi-stage build (Vite -> Nginx)
  │   ├── nginx.conf         ← Nginx proxy & SPA router configuration
  │   └── src/               ← React 18 components, POS billing, reports
  ├── backend/
  │   ├── Dockerfile         ← Node.js 20 container with openssl & postgresql-client
  │   ├── docker-entrypoint.sh ← Auto-migrator & idempotent seeder on startup
  │   └── src/               ← Express REST API & business logic
  └── database/
      ├── schema.prisma      ← Prisma data schema
      └── seeders/           ← Initial categories, brands, & grocery seeds
```

---

## 💻 Developer CLI Commands

You can also run commands directly from terminal:

```bash
# Start all containers in background
npm run docker:up
# or
docker compose up -d --build

# View real-time logs
npm run docker:logs
# or
docker compose logs -f

# Stop containers
npm run docker:down
# or
docker compose down
```

### Local Dev without Docker (ঐচ্ছিক)
লোকালি ডকার ছাড়া নোড রান করতে চাইলে:
```bash
npm run install:all
npm run dev        # Starts backend on 5000 and Vite dev server on 3000
```

---

## 📦 Features & Modules

- **Module A — POS Counter**: বারকোড স্ক্যানার সাপোর্ট, নন-বারকোড লুজ আইটেম (ওজন/কেজি/হালি), হোল্ড কার্ট, ডিসকাউন্ট, ক্যাশ/বিকাশ/নগদ/কার্ড ও বাকি (Store Credit) বিলিং।
- **Module B — Inventory**: স্টক অ্যালার্ট, ব্যাচ, এক্সপায়ারি ট্র্যাকিং, স্টক অ্যাডজাস্টমেন্ট ও বারকোড জেনারেটর।
- **Module C — Suppliers & Purchases**: সাপ্লায়ার বকেয়া ট্র্যাকিং, পারচেজ অর্ডার ও চালান রিসিভ।
- **Module D — Customer CRM**: বাকি খাতা (Dues/Baki), লয়ালটি পয়েন্ট সিস্টেম।
- **Module E — Employee & Shifts**: ক্যাশিয়ার শিফট খোলা/বন্ধ, ক্লোজিং ক্যাশ ভেরিয়েন্স রিপোর্ট।
- **Module F — Reports & Analytics**: ডেইলি/মান্থলি সেলস রিপোর্ট, লাভ-ক্ষতি (P&L), টপ সেলিং প্রোডাক্টস।
- **Module G — Automated Backups**: প্রতিদিন স্বয়ংক্রিয় ডাটাবেজ ব্যাকআপ জিপ তৈরি ও গুগল ড্রাইভ ইন্টিগ্রেশন।
