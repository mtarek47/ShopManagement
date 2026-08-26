const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSuccess, sendError } = require('../utils/response');

router.use(verifyToken);

// GET /api/reports/dashboard
router.get('/dashboard', async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  try {
    const [todaySalesAgg, todayExpenseAgg, lowStockCount, expiringSoonCount, last5Sales, last7Days, products] = await Promise.all([
      prisma.sale.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow } },
        _sum: { totalAmount: true, discountAmount: true },
        _count: { id: true },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      prisma.product.count({ where: { isActive: true } }).then(async () => {
        const all = await prisma.product.findMany({ where: { isActive: true }, select: { currentStock: true, lowStockThreshold: true } });
        return all.filter(p => parseFloat(p.currentStock) <= parseFloat(p.lowStockThreshold)).length;
      }),
      prisma.product.count({
        where: {
          isActive: true,
          expiryDate: { not: null, lte: thirtyDaysFromNow },
        },
      }),
      prisma.sale.findMany({
        where: { createdAt: { gte: today, lt: tomorrow } },
        include: { customer: { select: { name: true } }, payments: true, cashier: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Last 7 days sales trend
      (async () => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - i);
          const next = new Date(d);
          next.setDate(next.getDate() + 1);
          const agg = await prisma.sale.aggregate({
            where: { createdAt: { gte: d, lt: next } },
            _sum: { totalAmount: true },
            _count: { id: true },
          });
          days.push({
            date: d.toLocaleDateString('en-BD', { month: 'short', day: 'numeric' }),
            total: parseFloat(agg._sum.totalAmount || 0),
            count: agg._count.id,
          });
        }
        return days;
      })(),
      // Today's profit calculation
      prisma.saleItem.findMany({
        where: { sale: { createdAt: { gte: today, lt: tomorrow } } },
        include: { product: { select: { costPrice: true } } },
      }),
    ]);

    const todayRevenue = parseFloat(todaySalesAgg._sum.totalAmount || 0);
    const todayExpenses = parseFloat(todayExpenseAgg._sum.amount || 0);
    const todayTransactions = todaySalesAgg._count.id;
    const todayGrossProfit = products.reduce((sum, item) => {
      return sum + (parseFloat(item.unitPrice) - parseFloat(item.product.costPrice)) * item.qty;
    }, 0);
    const todayNetProfit = todayGrossProfit - todayExpenses;

    return sendSuccess(res, {
      todaySales: todayRevenue,
      todayExpenses,
      todayTransactions,
      todayProfit: todayGrossProfit,
      todayNetProfit,
      lowStockCount,
      expiringSoonCount,
      last5Sales,
      last7DaysSales: last7Days,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 'Failed to load dashboard', 500);
  }
});

// GET /api/reports/sales — Detailed Sales Report with Profit & Loss
router.get('/sales', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { from, to, cashierId } = req.query;
  const where = {};
  const dateFilter = {};

  if (from || to) {
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(new Date(to).setHours(23, 59, 59));
    where.createdAt = dateFilter;
  }
  if (cashierId) where.cashierId = cashierId;

  try {
    const [salesAgg, salesList, expensesAgg, adjustmentsList] = await Promise.all([
      prisma.sale.aggregate({
        where,
        _sum: { totalAmount: true, discountAmount: true, subtotal: true },
        _count: { id: true },
        _avg: { totalAmount: true },
      }),
      prisma.sale.findMany({
        where,
        include: {
          cashier: { select: { name: true } },
          customer: { select: { name: true, phone: true } },
          payments: true,
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  sku: true,
                  barcode: true,
                  unit: true,
                  costPrice: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.expense.aggregate({
        where: from || to ? { date: dateFilter } : {},
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.stockAdjustment.findMany({
        where: from || to ? { createdAt: dateFilter } : {},
        include: { product: { select: { name: true, costPrice: true } } },
      }),
    ]);

    const totalRevenue = parseFloat(salesAgg._sum.totalAmount || 0);
    const totalDiscounts = parseFloat(salesAgg._sum.discountAmount || 0);
    const totalTransactions = salesAgg._count.id;
    const avgTransaction = parseFloat(salesAgg._avg.totalAmount || 0);
    const totalExpenses = parseFloat(expensesAgg._sum.amount || 0);

    // Calculate COGS and items sold
    let totalCost = 0;
    let totalItemsSold = 0;
    const productTotals = {};
    const categoryTotals = {};

    salesList.forEach((sale) => {
      sale.items.forEach((item) => {
        const itemQty = parseFloat(item.qty) || 0;
        const itemSubtotal = parseFloat(item.subtotal) || 0;
        const unitCost = parseFloat(item.product?.costPrice) || 0;
        const cost = unitCost * itemQty;

        totalCost += cost;
        totalItemsSold += itemQty;

        const prodName = item.product?.name || 'Product';
        productTotals[prodName] = productTotals[prodName] || {
          name: prodName,
          unit: item.product?.unit || 'pcs',
          qty: 0,
          revenue: 0,
        };
        productTotals[prodName].qty += itemQty;
        productTotals[prodName].revenue += itemSubtotal;

        const cat = item.product?.category?.name || 'Uncategorized';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + itemSubtotal;
      });
    });

    // Calculate Damage / Loss Value
    let damageLoss = 0;
    adjustmentsList.forEach((adj) => {
      if (adj.type === 'DAMAGE' || adj.type === 'LOSS') {
        const cost = parseFloat(adj.product?.costPrice || 0) * Math.abs(parseFloat(adj.qty || 0));
        damageLoss += cost;
      }
    });

    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses - damageLoss;

    const topProducts = Object.values(productTotals)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15);

    const salesByCategory = Object.entries(categoryTotals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    return sendSuccess(res, {
      totalRevenue,
      totalCost,
      totalDiscounts,
      totalItemsSold,
      grossProfit,
      totalExpenses,
      damageLoss,
      netProfit,
      grossProfitMargin: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0,
      netProfitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0,
      totalTransactions,
      avgTransaction,
      topProducts,
      salesByCategory,
      detailedSales: salesList,
    });
  } catch (err) {
    console.error('Report error:', err);
    return sendError(res, 'Failed to generate sales report', 500);
  }
});

// GET /api/reports/inventory-valuation — Feature 4: ইনভেন্টরি ভ্যালুয়েশন (দোকানে কত টাকার মাল আছে)
router.get('/inventory-valuation', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    let totalCostValue = 0;   // Trapped capital in buying price
    let totalRetailValue = 0; // Total sales value
    let totalUnits = 0;
    const categoryBreakdown = {};

    const items = products.map((p) => {
      const stock = parseFloat(p.currentStock) || 0;
      const cost = parseFloat(p.costPrice) || 0;
      const price = parseFloat(p.salePrice) || 0;

      const itemCostVal = stock * cost;
      const itemRetailVal = stock * price;
      const itemMargin = itemRetailVal - itemCostVal;

      totalCostValue += itemCostVal;
      totalRetailValue += itemRetailVal;
      totalUnits += stock;

      const catName = p.category?.name || 'Uncategorized';
      if (!categoryBreakdown[catName]) {
        categoryBreakdown[catName] = { name: catName, units: 0, costValue: 0, retailValue: 0 };
      }
      categoryBreakdown[catName].units += stock;
      categoryBreakdown[catName].costValue += itemCostVal;
      categoryBreakdown[catName].retailValue += itemRetailVal;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        category: catName,
        brand: p.brand?.name || '—',
        currentStock: stock,
        unit: p.unit,
        costPrice: cost,
        salePrice: price,
        costValue: itemCostVal,
        retailValue: itemRetailVal,
        potentialProfit: itemMargin,
      };
    });

    return sendSuccess(res, {
      totalProducts: products.length,
      totalUnits,
      totalCostValue,     // কত টাকার মাল কেনা আছে
      totalRetailValue,   // বিক্রি করলে কত পাওয়া যাবে
      potentialProfit: totalRetailValue - totalCostValue, // সম্ভাব্য মোট লাভ
      categoryBreakdown: Object.values(categoryBreakdown).sort((a, b) => b.costValue - a.costValue),
      items,
    });
  } catch (err) {
    console.error('Inventory valuation error:', err);
    return sendError(res, 'Failed to calculate inventory valuation', 500);
  }
});

// GET /api/reports/dead-stock — Feature 8: ডেড স্টক আইডেন্টিফিকেশন (Slow-moving / 0 sales items)
router.get('/dead-stock', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { days = 30 } = req.query;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

  try {
    const [activeProducts, recentSales] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, currentStock: { gt: 0 } },
        include: { category: { select: { name: true } }, brand: { select: { name: true } } },
      }),
      prisma.saleItem.findMany({
        where: { sale: { createdAt: { gte: cutoffDate } } },
        select: { productId: true },
        distinct: ['productId'],
      }),
    ]);

    const soldProductIds = new Set(recentSales.map((s) => s.productId));
    const deadItems = [];
    let totalTrappedCapital = 0;

    activeProducts.forEach((p) => {
      if (!soldProductIds.has(p.id)) {
        const stock = parseFloat(p.currentStock) || 0;
        const cost = parseFloat(p.costPrice) || 0;
        const trappedValue = stock * cost;
        totalTrappedCapital += trappedValue;

        deadItems.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.category?.name || 'Uncategorized',
          currentStock: stock,
          unit: p.unit,
          costPrice: cost,
          salePrice: parseFloat(p.salePrice) || 0,
          trappedCapital: trappedValue,
        });
      }
    });

    deadItems.sort((a, b) => b.trappedCapital - a.trappedCapital);

    return sendSuccess(res, {
      periodDays: parseInt(days),
      deadProductsCount: deadItems.length,
      totalTrappedCapital, // ডেড স্টকে আটকে থাকা মোট ক্যাপিটাল
      items: deadItems,
    });
  } catch (err) {
    console.error('Dead stock report error:', err);
    return sendError(res, 'Failed to generate dead stock report', 500);
  }
});

module.exports = router;
