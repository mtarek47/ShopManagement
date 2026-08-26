const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSuccess, sendError } = require('../utils/response');

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return sendSuccess(res, brands);
  } catch { return sendError(res, 'Failed to fetch brands', 500); }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return sendError(res, 'Name is required');
  try {
    const brand = await prisma.brand.create({ data: { name, description } });
    return sendSuccess(res, brand, 'Brand created', 201);
  } catch (err) {
    if (err.code === 'P2002') return sendError(res, 'Brand already exists');
    return sendError(res, 'Failed to create brand', 500);
  }
});

router.put('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const brand = await prisma.brand.update({ where: { id: req.params.id }, data: req.body });
    return sendSuccess(res, brand, 'Brand updated');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Brand not found', 404);
    return sendError(res, 'Failed to update brand', 500);
  }
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    await prisma.brand.update({ where: { id: req.params.id }, data: { isActive: false } });
    return sendSuccess(res, null, 'Brand deleted');
  } catch { return sendError(res, 'Failed to delete brand', 500); }
});

module.exports = router;
