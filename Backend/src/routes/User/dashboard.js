// src/routes/User/dashboard.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = Router();
const db     = new PrismaClient();
router.use(protect);

// GET /api/user/dashboard
router.get('/', async (req, res) => {
  try {
    const ownerId = req.user.id;

    const [properties, activeRentals, securityPayments, monthlyPayments] = await Promise.all([

      // Owner ki tamam properties
      db.property.findMany({
        where:   { ownerId },
        include: {
          listings: {
            where:   { status: 'ACCEPTED' },
            include: {
              tenant:    { select: { id: true, name: true, phone: true } },
              agreement: { select: { id: true, status: true, monthlyRent: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Active rentals count
      db.rental.count({ where: { ownerId, isActive: true } }),

      // Pending security deposits
      db.securityDepositPayment.count({
        where: {
          status:    'PENDING_VERIFICATION',
          agreement: { listing: { property: { ownerId } } }
        }
      }),

      // Total collected (verified monthly + security)
      db.monthlyRentPayment.aggregate({
        where: {
          status:    'VERIFIED',
          agreement: { listing: { property: { ownerId } } }
        },
        _sum: { amount: true }
      }),
    ]);

    // Security deposit total collected
    const securityCollected = await db.securityDepositPayment.aggregate({
      where: {
        status:    'VERIFIED',
        agreement: { listing: { property: { ownerId } } }
      },
      _sum: { amount: true }
    });

    // Pending monthly payments count
    const pendingMonthly = await db.monthlyRentPayment.count({
      where: {
        status:    'PENDING_VERIFICATION',
        agreement: { listing: { property: { ownerId } } }
      }
    });

    // Recent 5 verified payments
    const recentPayments = await db.monthlyRentPayment.findMany({
      where: {
        status:    'VERIFIED',
        agreement: { listing: { property: { ownerId } } }
      },
      include: {
        agreement: {
          include: {
            listing: {
              include: {
                tenant:   { select: { id: true, name: true } },
                property: { select: { id: true, address: true, city: true } }
              }
            }
          }
        }
      },
      orderBy: { verifiedAt: 'desc' },
      take: 5
    });

    const totalCollected = (monthlyPayments._sum.amount || 0)
                         + (securityCollected._sum.amount || 0);

    return res.json({
      success: true,
      data: {
        user: req.user,
        stats: {
          totalProperties: properties.length,
          totalRentals:    activeRentals,
          pendingPayments: pendingMonthly + securityPayments,
          totalCollected,
        },
        properties,
        recentPayments,
      }
    });

  } catch (err) {
    console.error('[dashboard GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;