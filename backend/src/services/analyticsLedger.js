const prisma = require('../config/database');

/**
 * Normalizes any Date to UTC midnight of that day
 */
function normalizeDate(d = new Date()) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/**
 * Calculates and persists the exact financial snapshot for a given day in the daily_analytics table.
 */
async function recordDailyAnalyticsSnapshot(targetDate = new Date()) {
  const startOfDay = normalizeDate(targetDate);
  const nextDay = new Date(startOfDay);
  nextDay.setDate(nextDay.getDate() + 1);
  const dateString = startOfDay.toISOString().slice(0, 10);

  try {
    const [salesAgg, salesList, expensesAgg, adjustmentsList, productsList] = await Promise.all([
      // Sales Aggregate for this day
      prisma.sale.aggregate({
        where: { createdAt: { gte: startOfDay, lt: nextDay } },
        _sum: { totalAmount: true, discountAmount: true, subtotal: true },
        _count: { id: true },
      }),
      // Sales items and payments for COGS & payment channels
      prisma.sale.findMany({
        where: { createdAt: { gte: startOfDay, lt: nextDay } },
        include: {
          payments: true,
          items: {
            include: {
              product: { select: { costPrice: true } },
            },
          },
        },
      }),
      // Operating expenses for this day
      prisma.expense.aggregate({
        where: { date: { gte: startOfDay, lt: nextDay } },
        _sum: { amount: true },
      }),
      // Stock damage / loss adjustments for this day
      prisma.stockAdjustment.findMany({
        where: { createdAt: { gte: startOfDay, lt: nextDay } },
        include: { product: { select: { costPrice: true } } },
      }),
      // Current inventory snapshot
      prisma.product.findMany({
        where: { isActive: true },
        select: { currentStock: true, costPrice: true, salePrice: true },
      }),
    ]);

    const netRevenue = parseFloat(salesAgg._sum.totalAmount || 0);
    const discountAmount = parseFloat(salesAgg._sum.discountAmount || 0);
    const grossRevenue = netRevenue + discountAmount;
    const totalTransactions = salesAgg._count.id;
    const operatingExpenses = parseFloat(expensesAgg._sum.amount || 0);

    let cogs = 0;
    let itemsSoldQty = 0;
    let cashInflow = 0;
    let digitalInflow = 0;
    let dueInflow = 0;

    salesList.forEach((s) => {
      s.items?.forEach((i) => {
        const qty = parseFloat(i.qty) || 0;
        const unitCost = parseFloat(i.product?.costPrice) || 0;
        cogs += qty * unitCost;
        itemsSoldQty += qty;
      });

      s.payments?.forEach((p) => {
        const amt = parseFloat(p.amount) || 0;
        if (p.method === 'CASH') cashInflow += amt;
        else if (p.method === 'STORE_CREDIT') dueInflow += amt;
        else digitalInflow += amt;
      });
    });

    let damageLoss = 0;
    adjustmentsList.forEach((adj) => {
      if (adj.type === 'DAMAGE' || adj.type === 'LOSS') {
        const cost = parseFloat(adj.product?.costPrice || 0) * Math.abs(parseFloat(adj.qty || 0));
        damageLoss += cost;
      }
    });

    const grossProfit = netRevenue - cogs;
    const netProfit = grossProfit - operatingExpenses - damageLoss;

    let inventoryCostSnapshot = 0;
    let inventoryRetailSnapshot = 0;
    productsList.forEach((p) => {
      const stock = parseFloat(p.currentStock) || 0;
      inventoryCostSnapshot += stock * parseFloat(p.costPrice || 0);
      inventoryRetailSnapshot += stock * parseFloat(p.salePrice || 0);
    });

    const snapshot = await prisma.dailyAnalytics.upsert({
      where: { date: startOfDay },
      update: {
        dateString,
        grossRevenue,
        discountAmount,
        netRevenue,
        cogs,
        grossProfit,
        operatingExpenses,
        damageLoss,
        netProfit,
        totalTransactions,
        itemsSoldQty,
        cashInflow,
        digitalInflow,
        dueInflow,
        inventoryCostSnapshot,
        inventoryRetailSnapshot,
      },
      create: {
        date: startOfDay,
        dateString,
        grossRevenue,
        discountAmount,
        netRevenue,
        cogs,
        grossProfit,
        operatingExpenses,
        damageLoss,
        netProfit,
        totalTransactions,
        itemsSoldQty,
        cashInflow,
        digitalInflow,
        dueInflow,
        inventoryCostSnapshot,
        inventoryRetailSnapshot,
      },
    });

    return snapshot;
  } catch (err) {
    console.error(`[Analytics Ledger] Failed to record snapshot for ${dateString}:`, err);
  }
}

/**
 * Synchronizes/backfills all historical dates into the daily_analytics table.
 */
async function syncAllHistoricalAnalytics() {
  try {
    // Find all distinct sale dates in the system
    const sales = await prisma.sale.findMany({ select: { createdAt: true } });
    const expenses = await prisma.expense.findMany({ select: { date: true } });
    const shifts = await prisma.shiftReport.findMany({ select: { closedAt: true } });

    const allDates = new Set();
    // Always include today
    allDates.add(normalizeDate(new Date()).toISOString());

    sales.forEach((s) => allDates.add(normalizeDate(s.createdAt).toISOString()));
    expenses.forEach((e) => allDates.add(normalizeDate(e.date).toISOString()));
    shifts.forEach((sr) => allDates.add(normalizeDate(sr.closedAt).toISOString()));

    for (const dStr of allDates) {
      await recordDailyAnalyticsSnapshot(new Date(dStr));
    }

    console.log(`[Analytics Ledger] Synced ${allDates.size} daily analytics records into permanent database ledger.`);
  } catch (err) {
    console.error('[Analytics Ledger] Historical sync error:', err);
  }
}

module.exports = {
  recordDailyAnalyticsSnapshot,
  syncAllHistoricalAnalytics,
};
