const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSuccess, sendError } = require('../utils/response');
const {
  performBackup,
  restoreDatabase,
  getShopSettings,
  saveShopSettings,
  BACKUP_DIR,
} = require('../services/backup');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// GET /api/admin/settings — Public for login page and thermal receipt rendering
router.get('/settings', (req, res) => {
  try {
    return sendSuccess(res, getShopSettings());
  } catch (err) {
    return sendError(res, 'Failed to fetch settings: ' + err.message, 500);
  }
});

// Admin-only routes below
router.use(verifyToken, requireRole('ADMIN'));

// GET /api/admin/backups
router.get('/backups', async (req, res) => {
  try {
    const logs = await prisma.backupLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    const safeLogs = logs.map((l) => ({
      ...l,
      fileSize: l.fileSize ? Number(l.fileSize) : null,
    }));
    return sendSuccess(res, safeLogs);
  } catch (err) {
    console.error('Fetch backups error:', err);
    return sendError(res, 'Failed to fetch backup logs: ' + err.message, 500);
  }
});

// POST /api/admin/backup — manual backup trigger (includes DB + Invoice Header Settings)
router.post('/backup', async (req, res) => {
  try {
    const result = await performBackup();
    if (result.success) {
      return sendSuccess(res, result, 'Full database & invoice settings backup created successfully.');
    } else {
      return sendError(res, result.error || 'Backup creation failed', 500);
    }
  } catch (err) {
    console.error('Backup trigger error:', err);
    return sendError(res, 'Failed to trigger backup process: ' + err.message, 500);
  }
});

// POST /api/admin/restore — Restore database & invoice settings from uploaded .zip file
router.post('/restore', upload.single('backupFile'), async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Please choose a valid .zip backup file to upload', 400);
  }

  try {
    const result = await restoreDatabase(req.file.buffer);
    return sendSuccess(res, result, result.message || 'System database & invoice settings restored successfully!');
  } catch (err) {
    console.error('Database restore error:', err);
    return sendError(res, 'Database restore failed: ' + err.message, 500);
  }
});

// POST /api/admin/restore-local/:filename — Restore database & settings from an existing local backup file
router.post('/restore-local/:filename', async (req, res) => {
  const filePath = path.join(BACKUP_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return sendError(res, 'Backup archive file not found on server', 404);
  }

  try {
    const result = await restoreDatabase(filePath);
    return sendSuccess(res, result, result.message || `System & settings restored from "${req.params.filename}" successfully!`);
  } catch (err) {
    console.error('Local backup restore error:', err);
    return sendError(res, 'Restore failed: ' + err.message, 500);
  }
});

// PUT /api/admin/settings — Update receipt header, footer and system settings
router.put('/settings', (req, res) => {
  try {
    const current = getShopSettings();
    const updated = { ...current, ...req.body };
    saveShopSettings(updated);
    return sendSuccess(res, updated, 'Shop receipt & system settings saved successfully');
  } catch (err) {
    console.error('Save settings error:', err);
    return sendError(res, 'Failed to save settings: ' + err.message, 500);
  }
});

// GET /api/admin/system-info
router.get('/system-info', (req, res) => {
  const settings = getShopSettings();
  return sendSuccess(res, {
    nodeVersion: process.version,
    platform: process.platform,
    appVersion: '1.0.0',
    shopName: settings.shopName || 'Smart Buy',
    uptime: Math.floor(process.uptime()) + 's',
    memoryUsage: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
  });
});

module.exports = router;
