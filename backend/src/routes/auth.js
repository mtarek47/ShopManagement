const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return sendError(res, 'Phone and password required');

  try {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.isActive) return sendError(res, 'Invalid credentials', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return sendError(res, 'Invalid credentials', 401);

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    const { passwordHash, ...safeUser } = user;
    return sendSuccess(res, { user: safeUser, token });
  } catch (err) {
    console.error(err);
    return sendError(res, 'Login failed', 500);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, phone: true, role: true, isActive: true, createdAt: true },
    });
    if (!user) return sendError(res, 'User not found', 404);
    return sendSuccess(res, user);
  } catch (err) {
    return sendError(res, 'Failed to fetch user', 500);
  }
});

// POST /api/auth/change-password
router.post('/change-password', verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return sendError(res, 'Old and new password required');
  if (newPassword.length < 6) return sendError(res, 'New password must be at least 6 characters');

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) return sendError(res, 'Old password is incorrect', 401);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    return sendSuccess(res, null, 'Password changed successfully');
  } catch (err) {
    return sendError(res, 'Failed to change password', 500);
  }
});

module.exports = router;
