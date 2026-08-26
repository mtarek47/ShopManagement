const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSuccess, sendError } = require('../utils/response');

router.use(verifyToken);

router.get('/', async (req, res) => {
  const { search } = req.query;
  const where = { isActive: true };
  if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }];
  try {
    const suppliers = await prisma.supplier.findMany({ where, orderBy: { name: 'asc' } });
    return sendSuccess(res, suppliers);
  } catch { return sendError(res, 'Failed to fetch suppliers', 500); }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, contact, phone, address } = req.body;
  if (!name) return sendError(res, 'Name is required');
  try {
    const supplier = await prisma.supplier.create({ data: { name, contact, phone, address } });
    return sendSuccess(res, supplier, 'Supplier created', 201);
  } catch { return sendError(res, 'Failed to create supplier', 500); }
});

router.get('/:id', async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: { product: { select: { name: true, unit: true, barcode: true } } },
            },
            createdBy: { select: { name: true } },
          },
          take: 30,
        },
      },
    });
    if (!supplier) return sendError(res, 'Supplier not found', 404);
    return sendSuccess(res, supplier);
  } catch (err) {
    console.error(err);
    return sendError(res, 'Failed to fetch supplier', 500);
  }
});

router.put('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: req.body });
    return sendSuccess(res, supplier, 'Supplier updated');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Supplier not found', 404);
    return sendError(res, 'Failed to update supplier', 500);
  }
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    await prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
    return sendSuccess(res, null, 'Supplier deleted');
  } catch { return sendError(res, 'Failed to delete supplier', 500); }
});

// POST /api/suppliers/:id/payments — record a payment against supplier
router.post('/:id/payments', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { amount } = req.body;
  if (!amount || parseFloat(amount) <= 0) return sendError(res, 'Valid amount is required');
  try {
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { totalDue: { decrement: parseFloat(amount) } },
    });
    return sendSuccess(res, supplier, 'Payment recorded');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Supplier not found', 404);
    return sendError(res, 'Failed to record payment', 500);
  }
});

module.exports = router;
