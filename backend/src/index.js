require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const prisma = require('./config/database');
const { initBackupCron } = require('./services/backup');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    shop: process.env.SHOP_NAME || 'Demo Shop',
    version: '1.0.0',
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/categories',require('./routes/categories'));
app.use('/api/brands',    require('./routes/brands'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/sales',     require('./routes/sales'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/reports',   require('./routes/reports'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/shifts',    require('./routes/shifts'));
app.use('/api/expenses',  require('./routes/expenses'));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// ─── Auto-seed Master Super Admin & Store Admin ──────────────────────────────
async function ensureRootAccounts() {
  const bcrypt = require('bcryptjs');

  // 1. Master Super Admin (01999999999 / superadmin123)
  try {
    const masterPhone = '01999999999';
    const masterHash = await bcrypt.hash('superadmin123', 12);
    const superAdmin = await prisma.user.upsert({
      where: { phone: masterPhone },
      update: {
        name: 'Master Super Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        passwordHash: masterHash,
      },
      create: {
        name: 'Master Super Admin',
        phone: masterPhone,
        passwordHash: masterHash,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    console.log(`👑 [Auth Seed] Master Super Admin verified (${superAdmin.phone} / superadmin123)`);
  } catch (err) {
    console.error('Failed to ensure Master Super Admin:', err.message);
  }

  // 2. Default Store Admin (01700000000 / admin123)
  try {
    const adminPhone = '01700000000';
    const adminHash = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
      where: { phone: adminPhone },
      update: {
        name: 'Admin',
        role: 'ADMIN',
        isActive: true,
        passwordHash: adminHash,
      },
      create: {
        name: 'Admin',
        phone: adminPhone,
        passwordHash: adminHash,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`✅ [Auth Seed] Store Admin verified (${admin.phone} / admin123)`);
  } catch (err) {
    console.error('Failed to ensure Store Admin:', err.message);
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    await ensureRootAccounts();
    initBackupCron();
    const { syncAllHistoricalAnalytics } = require('./services/analyticsLedger');
    syncAllHistoricalAnalytics().catch((e) => console.error('Initial analytics sync failed:', e));
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🏪 Shop: ${process.env.SHOP_NAME || 'Demo Shop'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
