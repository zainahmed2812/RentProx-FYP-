// src/routes/User/myRentedProperty.js
// ══════════════════════════════════════════════════════
// TENANT — login required
// GET  /api/user/my-rental              → meri rented property info
// POST /api/user/complaints             → maintenance/complaint submit
// GET  /api/user/complaints             → meri sab complaints
//
// index.js mein add karo:
//   import myRentalRoutes from './routes/User/myRentedProperty.js';
//   app.use('/api/user', myRentalRoutes);
// ══════════════════════════════════════════════════════

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();

router.use(protect);

// ── GET /api/user/my-rental ───────────────────────────
// Tenant ki active rented property — agreement ACTIVE honi chahiye
router.get('/my-rental', async (req, res) => {
  try {
    // Active agreement wali listing dhundo jahan tenant = current user
    const listing = await db.listing.findFirst({
      where: {
        tenantId: req.user.id,
        status:   'ACCEPTED',
        agreement: {
          status: 'ACTIVE'
        }
      },
      include: {
        property: {
          include: { owner: { select: { id: true, name: true, phone: true, email: true } } }
        },
        agreement: {
          include: { securityPayment: true }
        }
      }
    });

    if (!listing) {
      return res.json({
        success: true,
        data:    null,
        message: 'Abhi koi active rental nahi hai.'
      });
    }

    // Complaints for this property
    const complaints = await db.complaint.findMany({
      where:   { tenantId: req.user.id, propertyId: listing.propertyId },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      data: {
        listing,
        property:   listing.property,
        agreement:  listing.agreement,
        owner:      listing.property.owner,
        complaints,
      }
    });

  } catch (err) {
    console.error('[my-rental GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/user/complaints — Submit maintenance/complaint
router.post('/complaints', async (req, res) => {
  try {
    const { propertyId, type = 'MAINTENANCE', title, description } = req.body;

    if (!propertyId)   return res.status(400).json({ success: false, message: 'propertyId zaruri hai.' });
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title zaruri hai.' });
    if (!description?.trim()) return res.status(400).json({ success: false, message: 'Description zaruri hai.' });

    // Sirf wo tenant complaint kar sakta hai jis ki yahan active tenancy ho
    const activeTenancy = await db.listing.findFirst({
      where: {
        tenantId:   req.user.id,
        propertyId,
        status:     'ACCEPTED',
        agreement:  { status: 'ACTIVE' }
      }
    });

    if (!activeTenancy) {
      return res.status(403).json({
        success: false,
        message: 'Sirf active tenant complaint/maintenance request submit kar sakta hai.'
      });
    }

    const validTypes = ['MAINTENANCE', 'COMPLAINT', 'OTHER'];
    const complaintType = validTypes.includes(type) ? type : 'MAINTENANCE';

    const complaint = await db.complaint.create({
      data: {
        tenantId:    req.user.id,
        propertyId,
        type:        complaintType,
        title:       title.trim(),
        description: description.trim(),
      }
    });

    return res.status(201).json({
      success: true,
      data:    complaint,
      message: 'Request submit ho gayi!'
    });

  } catch (err) {
    console.error('[complaints POST]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/user/complaints — Meri sab complaints
router.get('/complaints', async (req, res) => {
  try {
    const complaints = await db.complaint.findMany({
      where:   { tenantId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { address: true, city: true } }
      }
    });

    return res.json({ success: true, data: complaints });

  } catch (err) {
    console.error('[complaints GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
