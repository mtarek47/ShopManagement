const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');

router.use(verifyToken);

// Helper: generate invoice number
const genInvoiceNo = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return `INV-${date}-${rand}`;
};

// POST /api/sales — create a new sale
router.post('/', async (req, res) => {
  const { items, subtotal, discountAmount, totalAmount, customerId, payments, notes } = req.body;
  if (!items || items.length === 0) return sendError(res, 'Cart items are required');
  if (!payments || payments.length === 0) return sendError(res, 'Payment details are required');

  const invoiceNo = genInvoiceNo();
  const paid = payments.reduce((s, p) => s + parseFloat(p.amount), 0);
  const paymentStatus = paid >= parseFloat(totalAmount) ? 'PAID' : paid > 0 ? 'PARTIAL' : 'CREDIT';

  // Loyalty points earned: 1 point per 100 BDT
  const loyaltyEarned = Math.floor(parseFloat(totalAmount) / 100);

  try {
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Create sale
      const newSale = await tx.sale.create({
        data: {
          invoiceNo, cashierId: req.user.id,
          customerId: customerId || null,
          subtotal: parseFloat(subtotal),
          discountAmount: parseFloat(discountAmount) || 0,
          totalAmount: parseFloat(totalAmount),
          paymentStatus, notes,
          items: { create: items.map(i => ({ productId: i.productId, qty: parseFloat(i.qty), unitPrice: parseFloat(i.unitPrice), discountAmount: parseFloat(i.discountAmount) || 0, subtotal: parseFloat(i.subtotal) })) },
          payments: { create: payments.map(p => ({ method: p.method, amount: parseFloat(p.amount), reference: p.reference || null })) },
        },
        include: { items: { include: { product: { select: { name: true, barcode: true, unit: true, brand: { select: { name: true } } } } } }, payments: true, customer: { select: { name: true, phone: true, loyaltyPoints: true } }, cashier: { select: { name: true } } },
      });

      // 2. Decrement stock for each item
      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: parseFloat(item.qty) } } });
      }

      // 3. Add loyalty points to customer & handle store credit due
      if (customerId) {
        const creditPayment = payments.find(p => p.method === 'STORE_CREDIT');
        const creditDueAmount = (creditPayment ? parseFloat(creditPayment.amount) : 0) + (paid < parseFloat(totalAmount) && !creditPayment ? Math.max(0, parseFloat(totalAmount) - paid) : 0);

        const customerUpdate = {};
        if (loyaltyEarned > 0) {
          customerUpdate.loyaltyPoints = { increment: loyaltyEarned };
        }
        if (creditDueAmount > 0) {
          customerUpdate.storeCreditDue = { increment: creditDueAmount };
        }

        if (Object.keys(customerUpdate).length > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: customerUpdate,
          });
        }
      }

      return newSale;
    });

    const { recordDailyAnalyticsSnapshot } = require('../services/analyticsLedger');
    recordDailyAnalyticsSnapshot(new Date(sale.createdAt)).catch((e) => console.error('Ledger sync error:', e));

    return sendSuccess(res, sale, 'Sale created', 201);
  } catch (err) {
    console.error('Sale error:', err);
    return sendError(res, 'Failed to create sale', 500);
  }
});

// GET /api/sales
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, from, to, cashierId } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(new Date(to).setHours(23, 59, 59));
  }
  if (cashierId) where.cashierId = cashierId;

  try {
    const [sales, total] = await Promise.all([
      prisma.sale.findMany({ where, include: { cashier: { select: { name: true } }, customer: { select: { name: true } }, payments: true }, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
      prisma.sale.count({ where }),
    ]);
    return sendSuccess(res, { sales, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch { return sendError(res, 'Failed to fetch sales', 500); }
});

// GET /api/sales/invoice/:invoiceNo
router.get('/invoice/:invoiceNo', async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { invoiceNo: req.params.invoiceNo },
      include: { items: { include: { product: { select: { name: true, barcode: true, unit: true } } } }, payments: true, customer: true, cashier: { select: { name: true } } },
    });
    if (!sale) return sendError(res, 'Invoice not found', 404);
    return sendSuccess(res, sale);
  } catch { return sendError(res, 'Failed to fetch invoice', 500); }
});

// GET /api/sales/held-carts
router.get('/held-carts', async (req, res) => {
  try {
    const carts = await prisma.heldCart.findMany({ where: { cashierId: req.user.id }, orderBy: { createdAt: 'desc' } });
    return sendSuccess(res, carts);
  } catch { return sendError(res, 'Failed to fetch held carts', 500); }
});

// POST /api/sales/hold
router.post('/hold', async (req, res) => {
  const { label, cartJson } = req.body;
  try {
    const held = await prisma.heldCart.create({ data: { cashierId: req.user.id, label, cartJson } });
    return sendSuccess(res, held, 'Cart held', 201);
  } catch { return sendError(res, 'Failed to hold cart', 500); }
});

// DELETE /api/sales/held-carts/:id
router.delete('/held-carts/:id', async (req, res) => {
  try {
    await prisma.heldCart.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Held cart deleted');
  } catch { return sendError(res, 'Failed to delete held cart', 500); }
});

// GET /api/sales/:id
router.get('/:id', async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: { select: { name: true, barcode: true, unit: true } } } }, payments: true, customer: true, cashier: { select: { name: true } } },
    });
    if (!sale) return sendError(res, 'Sale not found', 404);
    return sendSuccess(res, sale);
  } catch { return sendError(res, 'Failed to fetch sale', 500); }
});

// POST /api/sales/:id/return
router.post('/:id/return', async (req, res) => {
  const { items } = req.body; // [{ saleItemId, qty }]
  if (!items || items.length === 0) return sendError(res, 'Return items required');

  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!sale) throw new Error('Sale not found');

      for (const ri of items) {
        const saleItem = sale.items.find(i => i.id === ri.saleItemId);
        if (!saleItem) continue;
        const returnQty = Math.min(parseFloat(ri.qty), parseFloat(saleItem.qty));

        // Restock product
        await tx.product.update({ where: { id: saleItem.productId }, data: { currentStock: { increment: returnQty } } });

        // Create stock adjustment record
        await tx.stockAdjustment.create({
          data: {
            productId: saleItem.productId, qty: returnQty,
            reason: `Return from invoice ${sale.invoiceNo}`, type: 'RETURN',
            createdById: req.user.id,
          },
        });
      }
    });
    return sendSuccess(res, null, 'Return processed successfully');
  } catch (err) {
    return sendError(res, err.message || 'Failed to process return', 500);
  }
});

module.exports = router;
