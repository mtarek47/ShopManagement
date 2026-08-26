const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendSuccess, sendError } = require('../utils/response');

router.use(verifyToken);

// GET /api/employees — list employees/admins
// RULE: Regular ADMIN/MANAGER cannot see SUPER_ADMIN accounts! Only SUPER_ADMIN can see SUPER_ADMIN accounts.
router.get('/', requireRole('ADMIN'), async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const where = isSuperAdmin ? {} : { role: { not: 'SUPER_ADMIN' } };

    const employees = await prisma.user.findMany({
      where,
      select: { id: true, name: true, phone: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, employees);
  } catch {
    return sendError(res, 'Failed to fetch employees', 500);
  }
});

// POST /api/employees — create new staff
router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { name, phone, role, password } = req.body;
  if (!name || !phone || !role || !password) return sendError(res, 'All fields are required');
  if (password.length < 6) return sendError(res, 'Password must be at least 6 characters');

  // Only SUPER_ADMIN can create another SUPER_ADMIN
  if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return sendError(res, 'Only a Super Admin can create another Super Admin account', 403);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, phone, role, passwordHash } });
    const { passwordHash: _, ...safeUser } = user;
    return sendSuccess(res, safeUser, 'Employee created successfully', 201);
  } catch (err) {
    if (err.code === 'P2002') return sendError(res, 'Phone number already exists for another staff member', 400);
    return sendError(res, 'Failed to create employee', 500);
  }
});

// PUT /api/employees/:id — update staff / admin profile including phone number
router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const { name, phone, role, isActive } = req.body;
  if (!name || !phone) return sendError(res, 'Name and phone are required');

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser) return sendError(res, 'Staff account not found', 404);

    // If target is SUPER_ADMIN and actor is not SUPER_ADMIN -> block!
    if (targetUser.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return sendError(res, 'You do not have permission to modify this Super Admin profile', 403);
    }

    // Only SUPER_ADMIN can promote to SUPER_ADMIN
    if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return sendError(res, 'Only a Super Admin can assign the Super Admin role', 403);
    }

    const updateData = {
      name: name.trim(),
      phone: phone.trim(),
    };
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, name: true, phone: true, role: true, isActive: true },
    });
    return sendSuccess(res, user, 'Staff profile & phone number updated successfully');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Staff account not found', 404);
    if (err.code === 'P2002') return sendError(res, 'This phone number is already registered to another account', 400);
    return sendError(res, 'Failed to update employee: ' + err.message, 500);
  }
});

// POST /api/employees/:id/reset-password
router.post('/:id/reset-password', requireRole('ADMIN'), async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return sendError(res, 'New password must be at least 6 characters');

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser) return sendError(res, 'Staff account not found', 404);

    // If target is SUPER_ADMIN and actor is not SUPER_ADMIN -> block!
    if (targetUser.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return sendError(res, 'You do not have permission to reset Super Admin password', 403);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
    return sendSuccess(res, null, 'Password changed successfully');
  } catch {
    return sendError(res, 'Failed to update password', 500);
  }
});

// DELETE /api/employees/:id — Permanently delete staff account
router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const targetId = req.params.id;
  const actor = req.user;

  if (targetId === actor.id) {
    return sendError(res, 'You cannot delete your own active account', 400);
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!targetUser) return sendError(res, 'Staff account not found', 404);

    // If target is SUPER_ADMIN, nobody can delete it
    if (targetUser.role === 'SUPER_ADMIN') {
      return sendError(res, 'Super Admin accounts cannot be deleted', 403);
    }

    // If target is ADMIN and actor is not SUPER_ADMIN, block deletion!
    if (targetUser.role === 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
      return sendError(res, 'Only a Super Admin can delete an Admin account', 403);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete transient held carts
      await tx.heldCart.deleteMany({ where: { cashierId: targetId } });

      // 2. Reassign shift reports, sales, POs, and stock adjustments to actor
      await tx.shiftReport.updateMany({
        where: { cashierId: targetId },
        data: { cashierId: actor.id },
      });
      await tx.sale.updateMany({
        where: { cashierId: targetId },
        data: { cashierId: actor.id },
      });
      await tx.purchaseOrder.updateMany({
        where: { createdById: targetId },
        data: { createdById: actor.id },
      });
      await tx.stockAdjustment.updateMany({
        where: { createdById: targetId },
        data: { createdById: actor.id },
      });
      await tx.expense.updateMany({
        where: { createdById: targetId },
        data: { createdById: actor.id },
      });

      // 3. Permanently delete the user record
      await tx.user.delete({ where: { id: targetId } });
    });

    return sendSuccess(res, null, `Staff account "${targetUser.name}" has been deleted permanently`);
  } catch (err) {
    console.error('Delete employee error:', err);
    return sendError(res, 'Failed to delete staff account: ' + err.message, 500);
  }
});

module.exports = router;
