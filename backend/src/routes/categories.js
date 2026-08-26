const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSuccess, sendError } = require('../utils/response');

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const cats = await prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return sendSuccess(res, cats);
  } catch { return sendError(res, 'Failed to fetch categories', 500); }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return sendError(res, 'Name is required');
  try {
    const cat = await prisma.category.create({ data: { name, description } });
    return sendSuccess(res, cat, 'Category created', 201);
  } catch (err) {
    if (err.code === 'P2002') return sendError(res, 'Category already exists');
    return sendError(res, 'Failed to create category', 500);
  }
});

router.put('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const cat = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
    return sendSuccess(res, cat, 'Category updated');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Category not found', 404);
    return sendError(res, 'Failed to update category', 500);
  }
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
    return sendSuccess(res, null, 'Category deleted');
  } catch { return sendError(res, 'Failed to delete category', 500); }
});

module.exports = router;
