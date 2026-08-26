const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSuccess, sendError } = require('../utils/response');

router.use(verifyToken, requireRole('ADMIN', 'MANAGER'));

router.get('/', async (req, res) => {
  const { page = 1, limit = 20, supplierId, status } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
  if (supplierId) where.supplierId = supplierId;
  if (status) where.status = status;

  try {
    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where, include: { supplier: { select: { name: true } }, createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit),
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return sendSuccess(res, { orders, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch { return sendError(res, 'Failed to fetch purchases', 500); }
});

router.post('/', async (req, res) => {
  const { supplierId, invoiceNo, items, amountPaid, notes } = req.body;
  if (!supplierId || !items || items.length === 0) return sendError(res, 'Supplier and items are required');

  const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.costPrice) * parseFloat(i.qty), 0);
  const paid = parseFloat(amountPaid) || 0;
  const due = totalAmount - paid;
  const status = paid >= totalAmount ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';
  const poInvoiceNo = invoiceNo || `PO-${Date.now()}`;

  try {
    const [order] = await prisma.$transaction([
      prisma.purchaseOrder.create({
        data: {
          supplierId,
          invoiceNo: poInvoiceNo,
          totalAmount,
          amountPaid: paid,
          status,
          notes,
          createdById: req.user.id,
          items: {
            create: items.map(i => ({
              productId: i.productId,
              qty: parseFloat(i.qty),
              costPrice: parseFloat(i.costPrice),
              subtotal: parseFloat(i.costPrice) * parseFloat(i.qty),
            })),
          },
        },
        include: {
          supplier: true,
          createdBy: { select: { name: true } },
          items: { include: { product: { select: { name: true, barcode: true, unit: true } } } },
        },
      }),
      ...items.map(i =>
        prisma.product.update({
          where: { id: i.productId },
          data: { currentStock: { increment: parseFloat(i.qty) }, costPrice: parseFloat(i.costPrice) },
        })
      ),
      prisma.supplier.update({ where: { id: supplierId }, data: { totalDue: { increment: due } } }),
    ]);
    return sendSuccess(res, order, 'Purchase order created', 201);
  } catch (err) {
    if (err.code === 'P2002') return sendError(res, 'Invoice number already exists');
    console.error(err);
    return sendError(res, 'Failed to create purchase order', 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: true,
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { name: true, barcode: true, unit: true } } } },
      },
    });
    if (!order) return sendError(res, 'Purchase order not found', 404);
    return sendSuccess(res, order);
  } catch { return sendError(res, 'Failed to fetch purchase order', 500); }
});

router.put('/:id/payment', async (req, res) => {
  const { amount } = req.body;
  if (!amount || parseFloat(amount) <= 0) return sendError(res, 'Valid amount is required');
  try {
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return sendError(res, 'Order not found', 404);
    const newPaid = parseFloat(order.amountPaid) + parseFloat(amount);
    const status = newPaid >= parseFloat(order.totalAmount) ? 'PAID' : 'PARTIAL';
    const due = parseFloat(order.totalAmount) - newPaid;
    const [updated] = await prisma.$transaction([
      prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { amountPaid: newPaid, status } }),
      prisma.supplier.update({ where: { id: order.supplierId }, data: { totalDue: { decrement: parseFloat(amount) } } }),
    ]);
    return sendSuccess(res, updated, 'Payment recorded');
  } catch { return sendError(res, 'Failed to record payment', 500); }
});

module.exports = router;
