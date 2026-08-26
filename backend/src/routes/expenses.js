const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSuccess, sendError } = require('../utils/response');

router.use(verifyToken);

// GET /api/expenses — List expenses with filters
router.get('/', async (req, res) => {
  const { page = 1, limit = 50, category, from, to } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};

  if (category) where.category = category;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(new Date(to).setHours(23, 59, 59));
  }

  try {
    const [expenses, total, agg] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { createdBy: { select: { name: true } } },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return sendSuccess(res, {
      expenses,
      total,
      totalAmount: parseFloat(agg._sum.amount || 0),
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('Fetch expenses error:', err);
    return sendError(res, 'Failed to fetch expenses', 500);
  }
});

// POST /api/expenses — Record new expense
router.post('/', async (req, res) => {
  const { title, category, amount, paymentMethod, date, notes } = req.body;
  if (!title || !amount || parseFloat(amount) <= 0) {
    return sendError(res, 'Title and valid amount are required', 400);
  }

  try {
    const expense = await prisma.expense.create({
      data: {
        title: title.trim(),
        category: category || 'GENERAL',
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || 'CASH',
        date: date ? new Date(date) : new Date(),
        notes: notes ? notes.trim() : null,
        createdById: req.user.id,
      },
      include: { createdBy: { select: { name: true } } },
    });

    const { recordDailyAnalyticsSnapshot } = require('../services/analyticsLedger');
    recordDailyAnalyticsSnapshot(expense.date).catch((e) => console.error('Ledger sync error:', e));

    return sendSuccess(res, expense, 'Expense recorded successfully', 201);
  } catch (err) {
    console.error('Create expense error:', err);
    return sendError(res, 'Failed to record expense', 500);
  }
});

// DELETE /api/expenses/:id — Delete expense
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const deleted = await prisma.expense.delete({ where: { id: req.params.id } });
    const { recordDailyAnalyticsSnapshot } = require('../services/analyticsLedger');
    if (deleted?.date) {
      recordDailyAnalyticsSnapshot(deleted.date).catch((e) => console.error('Ledger sync error:', e));
    }
    return sendSuccess(res, null, 'Expense deleted successfully');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Expense record not found', 404);
    return sendError(res, 'Failed to delete expense', 500);
  }
});

module.exports = router;
