// src/routes/User/ownerRequests.js
// ══════════════════════════════════════════════════════
// HOME OWNER — login required
// GET /api/owner/requests              → incoming requests + payment alerts
// PUT /api/owner/requests/:id/accept   → accept karo
// PUT /api/owner/requests/:id/decline  → decline karo
// ══════════════════════════════════════════════════════

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();

router.use(protect);

// ── GET /api/owner/requests ───────────────────────────
router.get('/', async (req, res) => {
  try {
    const requests = await db.listing.findMany({
      where:   { property: { ownerId: req.user.id } },
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { id: true, address: true, city: true, rentAmount: true } },
        tenant:   { select: { id: true, name: true, email: true, phone: true, cnic: true } },
        // ─── BUG FIX 2a: securityPayment bhi include karo ───
        // Taake owner ko pata chale k tenant ne payment submit ki hai ya nahi
        agreement: {
          include: { securityPayment: true }
        }
      }
    });

    // ─── BUG FIX 2b: Payment pending alerts ─────────────
    // Accepted requests jahan dono ne sign kiya, payment PENDING_VERIFICATION hai
    const paymentAlerts = requests.filter(r =>
      r.status === 'ACCEPTED' &&
      r.agreement?.tenantSigned &&
      r.agreement?.ownerSigned &&
      r.agreement?.securityPayment?.status === 'PENDING_VERIFICATION'
    );

    return res.json({
      success: true,
      data: {
        all:           requests,
        pending:       requests.filter(r => r.status === 'PENDING'),
        accepted:      requests.filter(r => r.status === 'ACCEPTED'),
        declined:      requests.filter(r => r.status === 'DECLINED'),
        paymentAlerts, // frontend pe notification badge ke liye
      }
    });

  } catch (err) {
    console.error('[ownerRequests GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/owner/requests/:id/accept ───────────────
router.put('/:id/accept', async (req, res) => {
  try {
    const listing = await db.listing.findUnique({
      where:   { id: req.params.id },
      include: { property: true }
    });

    if (!listing)                                 return res.status(404).json({ success: false, message: 'Request nahi mili.' });
    if (listing.property.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Yeh aap ki property nahi.' });
    if (listing.status !== 'PENDING')             return res.status(400).json({ success: false, message: 'Sirf PENDING request accept ho sakti hai.' });

    const result = await db.$transaction(async (tx) => {

      // Accepted listing update
      const updatedListing = await tx.listing.update({
        where: { id: listing.id },
        data:  { status: 'ACCEPTED', isActive: true }
      });

      // Property unavailable
      await tx.property.update({
        where: { id: listing.propertyId },
        data:  { isAvailable: false }   // ← BUG FIX 2c: yeh ensure karta hai listing se hatt jaaye
      });

      // Baaki sab pending requests decline + isActive=false (public listing se bhi hatao)
      await tx.listing.updateMany({
        where: {
          propertyId: listing.propertyId,
          id:         { not: listing.id },
          status:     'PENDING'
        },
        data: { status: 'DECLINED', isActive: false }
      });

      // Agreement draft
      const startDate = new Date();
      const endDate   = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 12);

      const agreement = await tx.agreement.create({
        data: {
          listingId:          listing.id,
          monthlyRent:        listing.property.rentAmount,
          securityDeposit:    listing.property.rentAmount * 2,
          advanceMonths:      1,
          startDate,
          endDate,
          durationMonths:     12,
          noticePeriodDays:   30,
          utilitiesIncluded:  false,
          maintenanceByOwner: true,
          petsAllowed:        false,
          status:             'DRAFT',
        }
      });

      return { listing: updatedListing, agreement };
    });

    return res.json({ success: true, data: result, message: 'Request accept ho gayi! Agreement draft ban gaya.' });

  } catch (err) {
    console.error('[ownerRequests accept]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/owner/requests/:id/decline ──────────────
router.put('/:id/decline', async (req, res) => {
  try {
    const listing = await db.listing.findUnique({
      where:   { id: req.params.id },
      include: { property: true }
    });

    if (!listing)                                 return res.status(404).json({ success: false, message: 'Request nahi mili.' });
    if (listing.property.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Yeh aap ki property nahi.' });
    if (listing.status !== 'PENDING')             return res.status(400).json({ success: false, message: 'Sirf PENDING request decline ho sakti hai.' });

    await db.listing.update({
      where: { id: listing.id },
      data:  { status: 'DECLINED', isActive: false }
    });

    return res.json({ success: true, message: 'Request decline ho gayi.' });

  } catch (err) {
    console.error('[ownerRequests decline]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
