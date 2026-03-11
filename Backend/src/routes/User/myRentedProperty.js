// src/routes/User/myRentedProperty.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();
router.use(protect);

// GET /api/user/my-rental
router.get('/my-rental', async (req, res) => {
  try {
    const rental = await db.rental.findFirst({
      where: {
        tenantId: req.user.id,
        isActive: true,
      },
      include: {
        property: {
          include: {
            owner: { select: { id: true, name: true, phone: true, email: true } }
          }
        },
        agreement: {
          include: {
            securityPayment:    true,
            monthlyPayments:    { orderBy: { month: 'asc' } },
            dissolutionRequest: true,
          }
        },
        owner:  { select: { id: true, name: true, phone: true, email: true } },
        tenant: { select: { id: true, name: true, phone: true, email: true } },
      }
    });

    if (!rental) {
      return res.json({ success: true, data: null, message: 'Abhi koi active rental nahi hai.' });
    }

    return res.json({
      success: true,
      data: {
        rental,
        property:  rental.property,
        agreement: rental.agreement,
        owner:     rental.owner,
        complaints: [],
      }
    });

  } catch (err) {
    console.error('[my-rental GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/user/complaints  (unchanged)
router.post('/complaints', async (req, res) => {
  return res.status(501).json({ success: false, message: 'Complaint feature is disabled.' });
});

export default router;