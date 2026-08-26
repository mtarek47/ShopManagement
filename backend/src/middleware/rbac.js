const { sendError } = require('../utils/response');

/**
 * Middleware factory: requireRole('ADMIN', 'MANAGER')
 * req.user must be set by verifyToken first.
 * SUPER_ADMIN has master bypass for all protected role routes.
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }
    if (req.user.role === 'SUPER_ADMIN') {
      return next(); // Master override for SUPER_ADMIN
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, `Access denied. Required role: ${roles.join(' or ')}`, 403);
    }
    next();
  };
};

module.exports = { requireRole };
