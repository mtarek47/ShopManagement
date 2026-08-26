const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');

router.use(verifyToken);

// GET /api/customers — list with search & pagination
router.get('/', async (req, res) => {
  const { search, page = 1, limit = 50, filter } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = { isActive: true };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (filter === 'due_only') {
    where.storeCreditDue = { gt: 0 };
  } else if (filter === 'loyalty_only') {
    where.loyaltyPoints = { gt: 0 };
  }

  try {
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: { select: { sales: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.customer.count({ where }),
    ]);

    return sendSuccess(res, {
      customers,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch {
    return sendError(res, 'Failed to fetch customers', 500);
  }
});

// POST /api/customers — create new customer
router.post('/', async (req, res) => {
  const { name, phone, email, address, initialDue } = req.body;
  if (!name || !phone) return sendError(res, 'Name and phone are required');

  try {
    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        email: email || null,
        address: address || null,
        storeCreditDue: parseFloat(initialDue) || 0,
        loyaltyPoints: 0,
      },
    });
    return sendSuccess(res, customer, 'Customer profile created', 201);
  } catch (err) {
    if (err.code === 'P2002') return sendError(res, 'Phone number already exists for another customer');
    return sendError(res, 'Failed to create customer', 500);
  }
});

// GET /api/customers/:id — detailed profile + purchase history + item breakdowns
router.get('/:id', async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            items: {
              include: {
                product: { select: { name: true, barcode: true, unit: true } },
              },
            },
            payments: true,
            cashier: { select: { name: true } },
          },
        },
      },
    });

    if (!customer) return sendError(res, 'Customer not found', 404);
    return sendSuccess(res, customer);
  } catch (err) {
    console.error(err);
    return sendError(res, 'Failed to fetch customer profile', 500);
  }
});

// PUT /api/customers/:id — update profile
router.put('/:id', async (req, res) => {
  const { name, phone, email, address } = req.body;
  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { name, phone, email, address },
    });
    return sendSuccess(res, customer, 'Customer details updated');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Customer not found', 404);
    if (err.code === 'P2002') return sendError(res, 'Phone number already exists', 400);
    return sendError(res, 'Failed to update customer', 500);
  }
});

// DELETE /api/customers/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
    return sendSuccess(res, null, 'Customer deactivated');
  } catch {
    return sendError(res, 'Failed to delete customer', 500);
  }
});

// POST /api/customers/:id/due-payment — Record Due Settlement / বাকি পরিশোধ
router.post('/:id/due-payment', async (req, res) => {
  const { amount, method = 'CASH', notes } = req.body;
  const payAmount = parseFloat(amount);
  if (!payAmount || payAmount <= 0) return sendError(res, 'Valid payment amount is required');

  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return sendError(res, 'Customer not found', 404);

    const currentDue = parseFloat(customer.storeCreditDue) || 0;
    const newDue = Math.max(0, currentDue - payAmount);

    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: { storeCreditDue: newDue },
    });

    return sendSuccess(res, {
      customer: updated,
      amountPaid: payAmount,
      previousDue: currentDue,
      remainingDue: newDue,
      method,
      notes,
    }, 'Due payment collected successfully');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Failed to record due payment', 500);
  }
});

// POST /api/customers/:id/loyalty-redeem — Redeem loyalty points for instant cash discount
router.post('/:id/loyalty-redeem', async (req, res) => {
  const { points } = req.body;
  const pts = parseInt(points);
  if (!pts || pts <= 0) return sendError(res, 'Valid points amount required');

  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return sendError(res, 'Customer not found', 404);
    if (customer.loyaltyPoints < pts) return sendError(res, `Customer only has ${customer.loyaltyPoints} loyalty points`);

    const discountAmount = pts; // 1 point = 1 BDT discount
    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: { loyaltyPoints: { decrement: pts } },
    });
    return sendSuccess(res, { customer: updated, discountAmount }, `${pts} points redeemed for ৳${discountAmount} discount`);
  } catch {
    return sendError(res, 'Failed to redeem points', 500);
  }
});

// POST /api/customers/:id/adjust-points — Add or manual adjust points
router.post('/:id/adjust-points', async (req, res) => {
  const { points, reason } = req.body;
  const pts = parseInt(points);
  if (isNaN(pts)) return sendError(res, 'Valid points amount required');

  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return sendError(res, 'Customer not found', 404);

    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: { loyaltyPoints: { increment: pts } },
    });

    return sendSuccess(res, updated, `Loyalty points adjusted (${pts > 0 ? '+' : ''}${pts} pts)`);
  } catch {
    return sendError(res, 'Failed to adjust points', 500);
  }
});

module.exports = router;
