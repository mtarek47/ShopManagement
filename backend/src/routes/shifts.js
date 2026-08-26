const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');

router.use(verifyToken);

/**
 * Helper: Auto-close unclosed shifts from previous days if any
 */
async function autoReconcilePreviousDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Find sales before today that don't have a shift report for that day
    const lastReport = await prisma.shiftReport.findFirst({
      orderBy: { closedAt: 'desc' },
    });

    // If last report was on an older date or no report exists, check if there are sales on previous dates
    const oldestUnclosedSale = await prisma.sale.findFirst({
      where: lastReport ? { createdAt: { gt: lastReport.closedAt, lt: today } } : { createdAt: { lt: today } },
      orderBy: { createdAt: 'asc' },
    });

    if (oldestUnclosedSale) {
      const saleDate = new Date(oldestUnclosedSale.createdAt);
      saleDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(saleDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // Aggregate cash sales and total sales for that past day
      const [cashAgg, totalAgg, expenseAgg, defaultAdmin] = await Promise.all([
        prisma.salePayment.aggregate({
          where: { method: 'CASH', sale: { createdAt: { gte: saleDate, lt: nextDay } } },
          _sum: { amount: true },
        }),
        prisma.sale.aggregate({
          where: { createdAt: { gte: saleDate, lt: nextDay } },
          _sum: { totalAmount: true },
          _count: { id: true },
        }),
        prisma.expense.aggregate({
          where: { date: { gte: saleDate, lt: nextDay }, paymentMethod: 'CASH' },
          _sum: { amount: true },
        }),
        prisma.user.findFirst({ where: { role: 'ADMIN' } }),
      ]);

      const openingFloat = 1000; // Standard opening float
      const cashSales = parseFloat(cashAgg._sum.amount || 0);
      const cashExpenses = parseFloat(expenseAgg._sum.amount || 0);
      const expectedCash = openingFloat + cashSales - cashExpenses;

      if (totalAgg._count.id > 0 && defaultAdmin) {
        await prisma.shiftReport.create({
          data: {
            cashierId: defaultAdmin.id,
            openingFloat,
            expectedCash,
            actualCash: expectedCash,
            variance: 0,
            totalSales: parseFloat(totalAgg._sum.totalAmount || 0),
            totalTransactions: totalAgg._count.id,
            notes: `Auto-reconciled day end (${saleDate.toISOString().slice(0, 10)})`,
            closedAt: new Date(nextDay.getTime() - 1000),
          },
        });
      }
    }
  } catch (err) {
    console.error('Auto reconcile error:', err);
  }
}

// GET /api/shifts/live — Live real-time automated cash drawer calculations for today
router.get('/live', async (req, res) => {
  await autoReconcilePreviousDays();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const [cashSalesAgg, digitalSalesAgg, creditSalesAgg, expenseAgg, salesAgg] = await Promise.all([
      // 1. Cash Sales Today
      prisma.salePayment.aggregate({
        where: {
          method: 'CASH',
          sale: { createdAt: { gte: today, lt: tomorrow } },
        },
        _sum: { amount: true },
      }),
      // 2. Digital Sales Today (bKash, Nagad, Card)
      prisma.salePayment.aggregate({
        where: {
          method: { in: ['BKASH', 'NAGAD', 'CARD', 'ROCKET'] },
          sale: { createdAt: { gte: today, lt: tomorrow } },
        },
        _sum: { amount: true },
      }),
      // 3. Store Credit / Due Sales Today
      prisma.salePayment.aggregate({
        where: {
          method: 'STORE_CREDIT',
          sale: { createdAt: { gte: today, lt: tomorrow } },
        },
        _sum: { amount: true },
      }),
      // 4. Daily Cash Expenses
      prisma.expense.aggregate({
        where: {
          date: { gte: today, lt: tomorrow },
          paymentMethod: 'CASH',
        },
        _sum: { amount: true },
      }),
      // 5. Total Sales Today
      prisma.sale.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow } },
        _sum: { totalAmount: true, discountAmount: true },
        _count: { id: true },
      }),
    ]);

    const openingFloat = 1000; // Default opening float
    const cashSales = parseFloat(cashSalesAgg._sum.amount || 0);
    const digitalSales = parseFloat(digitalSalesAgg._sum.amount || 0);
    const creditSales = parseFloat(creditSalesAgg._sum.amount || 0);
    const cashExpenses = parseFloat(expenseAgg._sum.amount || 0);
    const expectedCash = openingFloat + cashSales - cashExpenses;

    const totalSalesRevenue = parseFloat(salesAgg._sum.totalAmount || 0);
    const totalTransactions = salesAgg._count.id;

    return sendSuccess(res, {
      date: today.toISOString().slice(0, 10),
      openingFloat,
      cashSales,
      digitalSales,
      creditSales,
      cashExpenses,
      expectedCash,
      totalSalesRevenue,
      totalTransactions,
    });
  } catch (err) {
    console.error('Live shift error:', err);
    return sendError(res, 'Failed to calculate live shift telemetry', 500);
  }
});

// GET /api/shifts — list historical shift reports
router.get('/', async (req, res) => {
  await autoReconcilePreviousDays();

  const { page = 1, limit = 30 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = req.user.role === 'CASHIER' ? { cashierId: req.user.id } : {};

  try {
    const [reports, total] = await Promise.all([
      prisma.shiftReport.findMany({
        where,
        include: { cashier: { select: { name: true, phone: true } } },
        orderBy: { closedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.shiftReport.count({ where }),
    ]);

    return sendSuccess(res, {
      reports,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('Fetch shifts error:', err);
    return sendError(res, 'Failed to fetch shift reports', 500);
  }
});

// POST /api/shifts/close — Close active shift / day end manually
router.post('/close', async (req, res) => {
  const { openingFloat, actualCash, notes } = req.body;
  if (openingFloat == null || actualCash == null) {
    return sendError(res, 'Opening float and actual counted cash are required', 400);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // 1. Aggregate cash payments today
    const [cashPayments, cashExpensesAgg, salesAgg] = await Promise.all([
      prisma.salePayment.aggregate({
        where: {
          method: 'CASH',
          sale: { createdAt: { gte: today, lt: tomorrow } },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          date: { gte: today, lt: tomorrow },
          paymentMethod: 'CASH',
        },
        _sum: { amount: true },
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    const cashSales = parseFloat(cashPayments._sum.amount || 0);
    const cashExpenses = parseFloat(cashExpensesAgg._sum.amount || 0);
    const expectedCash = parseFloat(openingFloat) + cashSales - cashExpenses;
    const variance = parseFloat(actualCash) - expectedCash;

    const report = await prisma.shiftReport.create({
      data: {
        cashierId: req.user.id,
        openingFloat: parseFloat(openingFloat),
        expectedCash,
        actualCash: parseFloat(actualCash),
        variance,
        totalSales: parseFloat(salesAgg._sum.totalAmount || 0),
        totalTransactions: salesAgg._count.id,
        notes: notes ? notes.trim() : 'Manual Shift Reconciliation',
      },
      include: { cashier: { select: { name: true } } },
    });

    return sendSuccess(res, report, 'Shift closed and reconciled successfully');
  } catch (err) {
    console.error('Close shift error:', err);
    return sendError(res, 'Failed to close shift: ' + err.message, 500);
  }
});

module.exports = router;
