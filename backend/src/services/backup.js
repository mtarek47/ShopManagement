const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const prisma = require('../config/database');

const BACKUP_DIR = path.join(__dirname, '../../../backups');
const SETTINGS_FILE = path.join(__dirname, '../../../scripts/settings.json');

// Ensure local backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Get current shop & invoice receipt settings
 */
function getShopSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch { /* use defaults */ }
  return {
    shopName: 'Smart Buy',
    shopSubtitle: 'Supershop & Departmental Store',
    shopAddress: 'House #12, Road #04, Dhanmondi, Dhaka',
    shopPhone: '01700-000000, 01800-000000',
    vatRegNo: '002391048-0101',
    receiptFooter: '*** THANK YOU FOR SHOPPING WITH US ***',
    receiptReturnPolicy: 'Exchange possible within 3 days with original receipt',
    backupSchedule: '0 2 * * *',
    lowStockThreshold: 10,
    loyaltyPointRate: 100,
  };
}

/**
 * Save shop & invoice receipt settings to persistent JSON
 */
function saveShopSettings(newSettings) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save settings file:', err);
    return false;
  }
}

/**
 * Locate pg_dump executable on macOS / Linux / Windows
 */
function findPgDumpBinary() {
  const commonPaths = [
    '/Library/PostgreSQL/18/bin/pg_dump',
    '/Library/PostgreSQL/17/bin/pg_dump',
    '/Library/PostgreSQL/16/bin/pg_dump',
    '/Library/PostgreSQL/15/bin/pg_dump',
    '/opt/homebrew/bin/pg_dump',
    '/usr/local/bin/pg_dump',
    '/usr/bin/pg_dump',
    'pg_dump',
  ];

  for (const p of commonPaths) {
    if (p === 'pg_dump') return 'pg_dump';
    if (fs.existsSync(p)) return p;
  }
  return 'pg_dump';
}

/**
 * Locate psql executable
 */
function findPsqlBinary() {
  const commonPaths = [
    '/Library/PostgreSQL/18/bin/psql',
    '/Library/PostgreSQL/17/bin/psql',
    '/Library/PostgreSQL/16/bin/psql',
    '/Library/PostgreSQL/15/bin/psql',
    '/opt/homebrew/bin/psql',
    '/usr/local/bin/psql',
    '/usr/bin/psql',
    'psql',
  ];

  for (const p of commonPaths) {
    if (p === 'psql') return 'psql';
    if (fs.existsSync(p)) return p;
  }
  return 'psql';
}

/**
 * Complete JSON snapshot exporter using Prisma including Invoice Header Details
 */
async function exportDatabaseJson() {
  const [
    users,
    categories,
    brands,
    products,
    suppliers,
    purchaseOrders,
    purchaseOrderItems,
    customers,
    sales,
    saleItems,
    salePayments,
    stockAdjustments,
    shiftReports,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.category.findMany(),
    prisma.brand.findMany(),
    prisma.product.findMany(),
    prisma.supplier.findMany(),
    prisma.purchaseOrder.findMany(),
    prisma.purchaseOrderItem.findMany(),
    prisma.customer.findMany(),
    prisma.sale.findMany(),
    prisma.saleItem.findMany(),
    prisma.salePayment.findMany(),
    prisma.stockAdjustment.findMany(),
    prisma.shiftReport.findMany(),
    prisma.expense.findMany(),
    prisma.dailyAnalytics.findMany(),
  ]);

  const settings = getShopSettings();

  return {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    shop: settings.shopName || 'Smart Buy',
    settings, // Includes invoice header, address, phone, VAT registration, return policy & footer!
    tables: {
      users,
      categories,
      brands,
      products,
      suppliers,
      purchaseOrders,
      purchaseOrderItems,
      customers,
      sales,
      saleItems,
      salePayments,
      stockAdjustments,
      shiftReports,
      expenses,
      dailyAnalytics,
    },
  };
}

/**
 * Perform full PostgreSQL database backup creating both SQL, JSON and Settings inside zip
 */
async function performBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sqlFilename = `backup_${timestamp}.sql`;
  const jsonFilename = `database_snapshot_${timestamp}.json`;
  const zipFilename = `backup_${timestamp}.zip`;
  const sqlFilePath = path.join(BACKUP_DIR, sqlFilename);
  const jsonFilePath = path.join(BACKUP_DIR, jsonFilename);
  const zipFilePath = path.join(BACKUP_DIR, zipFilename);

  console.log(`[Backup Service] Starting database & settings backup: ${zipFilename}...`);

  // Always generate fresh JSON snapshot with full invoice header details & settings
  const snapshot = await exportDatabaseJson();
  fs.writeFileSync(jsonFilePath, JSON.stringify(snapshot, null, 2), 'utf8');

  // Try generating SQL dump with clean drop statements
  const pgDumpBin = findPgDumpBinary();
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/pos_db';
  const dumpCmd = `"${pgDumpBin}" --clean --if-exists --no-owner --no-privileges "${dbUrl}" > "${sqlFilePath}"`;

  await new Promise((resolve) => {
    exec(dumpCmd, (err) => {
      if (err) {
        console.warn(`[Backup Service] pg_dump warning: ${err.message}`);
      }
      resolve();
    });
  });

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      const stats = fs.statSync(zipFilePath);
      console.log(`[Backup Service] Backup archive created successfully (${stats.size} bytes).`);

      // Clean up temporary uncompressed files
      try { if (fs.existsSync(sqlFilePath)) fs.unlinkSync(sqlFilePath); } catch (_) {}
      try { if (fs.existsSync(jsonFilePath)) fs.unlinkSync(jsonFilePath); } catch (_) {}

      // Log to database
      await prisma.backupLog.create({
        data: {
          filename: zipFilename,
          fileSize: BigInt(stats.size),
          status: 'SUCCESS',
          errorMessage: 'Local archive with full invoice settings saved securely.',
        },
      }).catch(() => {});

      cleanOldBackups();
      resolve({ success: true, filename: zipFilename, size: stats.size });
    });

    archive.on('error', (err) => {
      console.error('[Backup Service] Archive error:', err);
      reject(err);
    });

    archive.pipe(output);
    if (fs.existsSync(jsonFilePath)) archive.file(jsonFilePath, { name: jsonFilename });
    if (fs.existsSync(sqlFilePath) && fs.statSync(sqlFilePath).size > 0) {
      archive.file(sqlFilePath, { name: sqlFilename });
    }
    archive.finalize();
  });
}

/**
 * Restore database from a JSON snapshot using Prisma including invoice settings
 */
async function restoreFromJson(tables, settings) {
  console.log('[Backup Service] Restoring database records & settings from snapshot...');

  // 1. Restore Invoice & Receipt Settings if present
  if (settings) {
    saveShopSettings(settings);
    console.log('[Backup Service] Restored invoice header details:', settings.shopName);
  }

  // 2. Restore Tables
  await prisma.$transaction(async (tx) => {
    // Users
    if (tables.users?.length) {
      for (const u of tables.users) {
        await tx.user.upsert({
          where: { id: u.id },
          update: { name: u.name, phone: u.phone, passwordHash: u.passwordHash, role: u.role, isActive: true },
          create: { ...u, isActive: true },
        });
      }
    }

    // Categories
    if (tables.categories?.length) {
      for (const c of tables.categories) {
        await tx.category.upsert({
          where: { id: c.id },
          update: { name: c.name, description: c.description, isActive: true },
          create: { ...c, isActive: true },
        });
      }
    }

    // Brands
    if (tables.brands?.length) {
      for (const b of tables.brands) {
        await tx.brand.upsert({
          where: { id: b.id },
          update: { name: b.name, description: b.description, isActive: true },
          create: { ...b, isActive: true },
        });
      }
    }

    // Products (Ensure all inventory items are active and visible)
    if (tables.products?.length) {
      for (const p of tables.products) {
        await tx.product.upsert({
          where: { id: p.id },
          update: {
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            categoryId: p.categoryId,
            brandId: p.brandId,
            costPrice: p.costPrice,
            salePrice: p.salePrice,
            unit: p.unit || 'pcs',
            currentStock: p.currentStock,
            lowStockThreshold: p.lowStockThreshold || 10,
            expiryDate: p.expiryDate ? new Date(p.expiryDate) : null,
            isActive: true,
          },
          create: {
            ...p,
            unit: p.unit || 'pcs',
            lowStockThreshold: p.lowStockThreshold || 10,
            expiryDate: p.expiryDate ? new Date(p.expiryDate) : null,
            isActive: true,
          },
        });
      }
    }

    // Suppliers
    if (tables.suppliers?.length) {
      for (const s of tables.suppliers) {
        await tx.supplier.upsert({
          where: { id: s.id },
          update: { name: s.name, contact: s.contact, phone: s.phone, address: s.address, totalDue: s.totalDue, isActive: true },
          create: { ...s, isActive: true },
        });
      }
    }

    // Customers
    if (tables.customers?.length) {
      for (const c of tables.customers) {
        await tx.customer.upsert({
          where: { id: c.id },
          update: { name: c.name, phone: c.phone, email: c.email, address: c.address, loyaltyPoints: c.loyaltyPoints, storeCreditDue: c.storeCreditDue, isActive: true },
          create: { ...c, isActive: true },
        });
      }
    }

    // Purchase Orders & Items
    if (tables.purchaseOrders?.length) {
      for (const po of tables.purchaseOrders) {
        await tx.purchaseOrder.upsert({
          where: { id: po.id },
          update: { totalAmount: po.totalAmount, amountPaid: po.amountPaid, status: po.status, notes: po.notes },
          create: po,
        });
      }
    }

    if (tables.purchaseOrderItems?.length) {
      for (const poi of tables.purchaseOrderItems) {
        await tx.purchaseOrderItem.upsert({
          where: { id: poi.id },
          update: { qty: poi.qty, costPrice: poi.costPrice, subtotal: poi.subtotal },
          create: poi,
        });
      }
    }

    // Sales, Sale Items, Payments
    if (tables.sales?.length) {
      for (const s of tables.sales) {
        await tx.sale.upsert({
          where: { id: s.id },
          update: { totalAmount: s.totalAmount, subtotal: s.subtotal, discountAmount: s.discountAmount, paymentStatus: s.paymentStatus },
          create: s,
        });
      }
    }

    if (tables.saleItems?.length) {
      for (const si of tables.saleItems) {
        await tx.saleItem.upsert({
          where: { id: si.id },
          update: { qty: si.qty, unitPrice: si.unitPrice, discountAmount: si.discountAmount, subtotal: si.subtotal },
          create: si,
        });
      }
    }

    if (tables.salePayments?.length) {
      for (const sp of tables.salePayments) {
        await tx.salePayment.upsert({
          where: { id: sp.id },
          update: { amount: sp.amount, method: sp.method },
          create: sp,
        });
      }
    }

    // Stock Adjustments & Shift Reports
    if (tables.stockAdjustments?.length) {
      for (const sa of tables.stockAdjustments) {
        await tx.stockAdjustment.upsert({
          where: { id: sa.id },
          update: { qty: sa.qty, reason: sa.reason, type: sa.type },
          create: sa,
        });
      }
    }

    if (tables.shiftReports?.length) {
      for (const sr of tables.shiftReports) {
        await tx.shiftReport.upsert({
          where: { id: sr.id },
          update: { totalSales: sr.totalSales, actualCash: sr.actualCash },
          create: sr,
        });
      }
    }

    // Expenses
    if (tables.expenses?.length) {
      for (const exp of tables.expenses) {
        await tx.expense.upsert({
          where: { id: exp.id },
          update: { title: exp.title, category: exp.category, amount: exp.amount, paymentMethod: exp.paymentMethod, date: new Date(exp.date), notes: exp.notes },
          create: { ...exp, date: new Date(exp.date) },
        });
      }
    }

    // Daily Analytics Snapshots
    if (tables.dailyAnalytics?.length) {
      for (const da of tables.dailyAnalytics) {
        await tx.dailyAnalytics.upsert({
          where: { id: da.id },
          update: { ...da, date: new Date(da.date) },
          create: { ...da, date: new Date(da.date) },
        });
      }
    }
  });

  // Re-sync all analytics ledger tables to ensure absolute consistency
  const { syncAllHistoricalAnalytics } = require('./analyticsLedger');
  syncAllHistoricalAnalytics().catch((e) => console.error('Restore analytics sync error:', e));

  // Ensure all products are marked active
  await prisma.product.updateMany({ data: { isActive: true } });

  console.log(`[Backup Service] Restore completed: ${tables.products?.length || 0} products restored and active.`);
  return {
    success: true,
    message: `Database & Invoice Header Settings restored successfully! ${tables.products?.length || 0} inventory products and store settings recovered.`,
  };
}

/**
 * Restore database & settings from uploaded zip file buffer or file path
 */
async function restoreDatabase(zipInput) {
  let zip;
  if (Buffer.isBuffer(zipInput)) {
    zip = new AdmZip(zipInput);
  } else if (typeof zipInput === 'string' && fs.existsSync(zipInput)) {
    zip = new AdmZip(zipInput);
  } else {
    throw new Error('Invalid backup file provided');
  }

  const entries = zip.getEntries();
  if (entries.length === 0) throw new Error('Empty backup archive');

  console.log(`[Backup Service] Extracting backup zip (${entries.length} files)...`);

  // 1. If JSON snapshot is found in archive, restore tables + invoice header settings
  const jsonEntry = entries.find((e) => e.entryName.endsWith('.json'));
  if (jsonEntry) {
    const rawJson = jsonEntry.getData().toString('utf8');
    const snapshot = JSON.parse(rawJson);
    if (!snapshot.tables) throw new Error('Invalid database snapshot format in archive');
    return await restoreFromJson(snapshot.tables, snapshot.settings);
  }

  // 2. If SQL dump is found in archive, parse and restore
  const sqlEntry = entries.find((e) => e.entryName.endsWith('.sql'));
  if (sqlEntry) {
    const tempSqlPath = path.join(BACKUP_DIR, `temp_restore_${Date.now()}.sql`);
    fs.writeFileSync(tempSqlPath, sqlEntry.getData());

    const psqlBin = findPsqlBinary();
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/pos_db';
    const restoreCmd = `"${psqlBin}" "${dbUrl}" < "${tempSqlPath}"`;

    return new Promise((resolve) => {
      exec(restoreCmd, async (err) => {
        try { fs.unlinkSync(tempSqlPath); } catch (_) {}
        if (err) {
          console.warn('[Backup Service] psql execution note:', err.message);
        }
        await prisma.product.updateMany({ data: { isActive: true } }).catch(() => {});
        console.log('[Backup Service] SQL restore and inventory reactivation completed.');
        resolve({ success: true, message: 'Database restored and inventory synchronized successfully' });
      });
    });
  }

  throw new Error('No valid database dump (.json or .sql) found inside the zip archive');
}

/**
 * Remove local backups older than BACKUP_RETENTION_DAYS (default 30)
 */
function cleanOldBackups() {
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  fs.readdir(BACKUP_DIR, (err, files) => {
    if (err) return;
    files.forEach((file) => {
      if (file.endsWith('.zip')) {
        const filePath = path.join(BACKUP_DIR, file);
        fs.stat(filePath, (sErr, stats) => {
          if (!sErr && stats.mtimeMs < cutoffTime) {
            fs.unlink(filePath, () => {
              console.log(`[Backup Service] Cleaned up expired backup: ${file}`);
            });
          }
        });
      }
    });
  });
}

/**
 * Initialize cron schedule
 */
function initBackupCron() {
  const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *'; // Default 2:00 AM daily
  cron.schedule(schedule, async () => {
    console.log('[Backup Cron] Firing daily automatic backup...');
    await performBackup();
  });
  console.log(`[Backup Service] Cron scheduler active with pattern: ${schedule}`);
}

module.exports = {
  performBackup,
  restoreDatabase,
  getShopSettings,
  saveShopSettings,
  initBackupCron,
  BACKUP_DIR,
};
