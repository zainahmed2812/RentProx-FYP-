// src/routes/Admin/dashboard.js
// ══════════════════════════════════════════════════════
// Admin Dashboard
// GET /api/admin/dashboard
// Returns: system-wide stats — tamam users, properties, payments
// ══════════════════════════════════════════════════════

import { Router } from 'express';
import db from '../../helpers/db.js';
import { sendSuccess, catchAsync } from '../../helpers/response.js';
import { protect, adminOnly } from '../../middleware/authMiddleware.js';

const router = Router();
router.use(protect, adminOnly); // pehle login check, phir admin check

// GET /api/admin/dashboard
router.get('/', catchAsync(async (req, res) => {

  const [totalUsers, totalProperties, totalRentals, pendingPayments, paidAggregate, recentUsers] = await Promise.all([
    db.user.count(),
    db.property.count(),
    db.rental.count(),
    db.payment.count({ where: { paid: false } }),
    db.payment.aggregate({ where: { paid: true }, _sum: { amount: true } }),
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true, active: true },
    }),
  ]);

  const recentProperties = await db.property.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  return sendSuccess(res, {
    stats: {
      totalUsers,
      totalProperties,
      totalRentals,
      pendingPayments,
      totalCollected: paidAggregate._sum.amount || 0,
    },
    recentUsers,
    recentProperties,
  });
}));

export default router;