const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSuccess, sendError } = require('../utils/response');

// All routes require auth
router.use(verifyToken);

// GET /api/products/search?q=...  (fast product search — used by POS barcode scanner)
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return sendSuccess(res, []);
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { barcode: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { category: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
      take: 20,
    });
    return sendSuccess(res, products);
  } catch (err) {
    return sendError(res, 'Search failed', 500);
  }
});

// GET /api/products
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, search, categoryId, brandId, stockStatus, expiryStatus, sortBy = 'name', sortOrder = 'asc' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = { isActive: true };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { category: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (brandId) where.brandId = brandId;
  if (stockStatus === 'out') where.currentStock = { lte: 0 };

  // Expiry date filtering (e.g. expiring within 30 days or expired)
  const now = new Date();
  if (expiryStatus === 'expiring_soon') {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    where.expiryDate = { not: null, lte: thirtyDaysFromNow };
  } else if (expiryStatus === 'expired') {
    where.expiryDate = { not: null, lt: now };
  }

  const validSortFields = ['name', 'salePrice', 'costPrice', 'currentStock', 'createdAt'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
  const order = sortOrder === 'desc' ? 'desc' : 'asc';

  try {
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } } },
        orderBy: { [sortField]: order },
        skip,
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);

    let filtered = products;
    if (stockStatus === 'low') {
      filtered = products.filter(p => parseFloat(p.currentStock) > 0 && parseFloat(p.currentStock) <= parseFloat(p.lowStockThreshold));
    }

    return sendSuccess(res, { products: filtered, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    return sendError(res, 'Failed to fetch products', 500);
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true, brand: true },
    });
    if (!product) return sendError(res, 'Product not found', 404);
    return sendSuccess(res, product);
  } catch (err) {
    return sendError(res, 'Failed to fetch product', 500);
  }
});

// POST /api/products
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, barcode, sku, categoryId, brandId, brandName, costPrice, salePrice, unit, currentStock, lowStockThreshold, expiryDate } = req.body;
  if (!name || !categoryId || costPrice == null || salePrice == null) {
    return sendError(res, 'Name, category, cost price, and sale price are required');
  }

  try {
    let resolvedBrandId = brandId || null;
    if (brandName && brandName.trim()) {
      const trimmed = brandName.trim();
      let brand = await prisma.brand.findFirst({
        where: { name: { equals: trimmed, mode: 'insensitive' } },
      });
      if (!brand) {
        brand = await prisma.brand.create({
          data: { name: trimmed },
        });
      }
      resolvedBrandId = brand.id;
    }

    const product = await prisma.product.create({
      data: {
        name,
        barcode: barcode || null,
        sku: sku || null,
        categoryId,
        brandId: resolvedBrandId,
        costPrice: parseFloat(costPrice),
        salePrice: parseFloat(salePrice),
        unit: unit || 'pcs',
        currentStock: parseFloat(currentStock) || 0,
        lowStockThreshold: parseFloat(lowStockThreshold) || 10,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
      include: { category: true, brand: true },
    });
    return sendSuccess(res, product, 'Product created', 201);
  } catch (err) {
    if (err.code === 'P2002') return sendError(res, 'Barcode or SKU already exists');
    console.error(err);
    return sendError(res, 'Failed to create product', 500);
  }
});

// PUT /api/products/:id
router.put('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, barcode, sku, categoryId, brandId, brandName, costPrice, salePrice, unit, currentStock, lowStockThreshold, expiryDate, isActive } = req.body;
  try {
    let resolvedBrandId = brandId || null;
    if (brandName !== undefined) {
      if (brandName && brandName.trim()) {
        const trimmed = brandName.trim();
        let brand = await prisma.brand.findFirst({
          where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        if (!brand) {
          brand = await prisma.brand.create({
            data: { name: trimmed },
          });
        }
        resolvedBrandId = brand.id;
      } else {
        resolvedBrandId = null;
      }
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name,
        barcode: barcode || null,
        sku: sku || null,
        categoryId,
        brandId: resolvedBrandId,
        costPrice: costPrice != null ? parseFloat(costPrice) : undefined,
        salePrice: salePrice != null ? parseFloat(salePrice) : undefined,
        unit,
        currentStock: currentStock != null ? parseFloat(currentStock) : undefined,
        lowStockThreshold: lowStockThreshold != null ? parseFloat(lowStockThreshold) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isActive,
      },
      include: { category: true, brand: true },
    });
    return sendSuccess(res, product, 'Product updated');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Product not found', 404);
    if (err.code === 'P2002') return sendError(res, 'Barcode or SKU already exists');
    console.error(err);
    return sendError(res, 'Failed to update product', 500);
  }
});

// DELETE /api/products/:id  (soft delete)
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    return sendSuccess(res, null, 'Product deactivated');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Product not found', 404);
    return sendError(res, 'Failed to delete product', 500);
  }
});

// POST /api/products/:id/adjust-stock
router.post('/:id/adjust-stock', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { qty, reason, type } = req.body;
  if (!qty || !reason || !type) return sendError(res, 'qty, reason, and type are required');

  try {
    const [adjustment, product] = await prisma.$transaction([
      prisma.stockAdjustment.create({
        data: { productId: req.params.id, qty: parseInt(qty), reason, type, createdById: req.user.id },
      }),
      prisma.product.update({
        where: { id: req.params.id },
        data: { currentStock: { increment: parseInt(qty) } },
      }),
    ]);
    return sendSuccess(res, { adjustment, product }, 'Stock adjusted');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Product not found', 404);
    return sendError(res, 'Failed to adjust stock', 500);
  }
});

module.exports = router;
