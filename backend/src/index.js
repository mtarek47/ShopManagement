require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const prisma = require('./config/database');
const { initBackupCron } = require('./services/backup');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ['http://localhost:3000', 'file://'] }));
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

// ─── Auto-seed Master Super Admin (Root Master Account) ────────────────────────
async function ensureMasterSuperAdmin() {
  try {
    const bcrypt = require('bcryptjs');
    const masterPhone = '01999999999';
    const existing = await prisma.user.findUnique({ where: { phone: masterPhone } });
    if (!existing) {
      const passwordHash = await bcrypt.hash('superadmin123', 12);
      await prisma.user.create({
        data: {
          name: 'Master Super Admin',
          phone: masterPhone,
          passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });
      console.log('👑 [Auth Seed] Auto-seeded Master Super Admin root account (01999999999 / superadmin123)');
    }
  } catch (err) {
    console.error('Failed to ensure Master Super Admin:', err.message);
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    await ensureMasterSuperAdmin();
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
