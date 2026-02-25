// src/routes/User/dashboard.js
// ══════════════════════════════════════════════════════
// User Dashboard
// GET /api/user/dashboard
// Returns: logged-in user ki tamam properties + stats
// ══════════════════════════════════════════════════════

import { Router } from 'express';
import db from '../../helpers/db.js';
import { sendSuccess, sendError, catchAsync } from '../../helpers/response.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = Router();
router.use(protect); // har route ke liye login zaruri hai

// GET /api/user/dashboard
router.get('/', catchAsync(async (req, res) => {
  const ownerId = req.user.id;

  // Parallel queries - sab ek saath chalenge (fast)
  const [properties, totalRentals, pendingPayments, paidAggregate] = await Promise.all([

    // User ki tamam properties with rental info
    db.property.findMany({
      where: { ownerId },
      include: {
        rentals: {
          include: {
            tenant: { select: { id: true, name: true, phone: true } },
            payments: { orderBy: { month: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Total active rentals
    db.rental.count({ where: { ownerId } }),

    // Unpaid payments count
    db.payment.count({ where: { paid: false, rental: { ownerId } } }),

    // Total collected rent
    db.payment.aggregate({
      where: { paid: true, rental: { ownerId } },
      _sum: { amount: true },
    }),
  ]);

  // Recent 5 payments
  const recentPayments = await db.payment.findMany({
    where: { rental: { ownerId } },
    include: {
      rental: {
        include: {
          tenant: { select: { id: true, name: true } },
          property: { select: { id: true, address: true, city: true } },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
    take: 5,
  });

  return sendSuccess(res, {
    user: req.user,
    stats: {
      totalProperties:  properties.length,
      totalRentals,
      pendingPayments,
      totalCollected:   paidAggregate._sum.amount || 0,
    },
    properties,
    recentPayments,
  });
}));

export default router;