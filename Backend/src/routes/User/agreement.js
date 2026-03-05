// src/routes/User/agreement.js
// ══════════════════════════════════════════════════════
// GET  /api/user/agreement/:listingId      → agreement dekho
// PUT  /api/user/agreement/:id             → terms update (owner)
// PUT  /api/user/agreement/:id/sign        → sign karo
// POST /api/user/agreement/:id/pay         → tenant deposit submit kare (transaction ID)
// PUT  /api/user/agreement/:id/verify      → owner verify/reject kare
// ══════════════════════════════════════════════════════

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();

router.use(protect);

// ── GET /api/user/agreement/:listingId ───────────────
router.get('/:listingId', async (req, res) => {
  try {
    const listing = await db.listing.findUnique({
      where:   { id: req.params.listingId },
      include: {
        agreement: { include: { securityPayment: true } },
        property:  { include: { owner: true } }
      }
    });

    if (!listing) return res.status(404).json({ success: false, message: 'Listing nahi mili.' });

    const isOwner  = listing.property.ownerId === req.user.id;
    const isTenant = listing.tenantId         === req.user.id;

    if (!isOwner && !isTenant) return res.status(403).json({ success: false, message: 'Access nahi hai.' });
    if (listing.status !== 'ACCEPTED') return res.status(400).json({ success: false, message: 'Agreement sirf accepted listings ke liye available hai.' });
    if (!listing.agreement)            return res.status(404).json({ success: false, message: 'Agreement abhi nahi bana.' });

    return res.json({
      success: true,
      data: {
        agreement:      listing.agreement,
        securityPayment: listing.agreement.securityPayment,
        property:       listing.property,
        tenantId:       listing.tenantId,
        userRole:       isOwner ? 'owner' : 'tenant'
      }
    });

  } catch (err) {
    console.error('[agreement GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/user/agreement/:id — Terms update (owner)
router.put('/:id', async (req, res) => {
  try {
    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.id },
      include: { listing: { include: { property: true } } }
    });

    if (!agreement)                                          return res.status(404).json({ success: false, message: 'Agreement nahi mila.' });
    if (agreement.listing.property.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Sirf owner terms update kar sakta hai.' });
    if (agreement.status !== 'DRAFT')                       return res.status(400).json({ success: false, message: 'Sirf DRAFT agreement update ho sakta hai.' });

    const {
      monthlyRent, securityDeposit, advanceMonths,
      startDate, endDate, durationMonths,
      noticePeriodDays, utilitiesIncluded,
      maintenanceByOwner, petsAllowed, additionalTerms
    } = req.body;

    const updated = await db.agreement.update({
      where: { id: req.params.id },
      data: {
        ...(monthlyRent        != null && { monthlyRent:        parseFloat(monthlyRent) }),
        ...(securityDeposit    != null && { securityDeposit:    parseFloat(securityDeposit) }),
        ...(advanceMonths      != null && { advanceMonths:      parseInt(advanceMonths) }),
        ...(startDate          != null && { startDate:          new Date(startDate) }),
        ...(endDate            != null && { endDate:            new Date(endDate) }),
        ...(durationMonths     != null && { durationMonths:     parseInt(durationMonths) }),
        ...(noticePeriodDays   != null && { noticePeriodDays:   parseInt(noticePeriodDays) }),
        ...(utilitiesIncluded  != null && { utilitiesIncluded:  Boolean(utilitiesIncluded) }),
        ...(maintenanceByOwner != null && { maintenanceByOwner: Boolean(maintenanceByOwner) }),
        ...(petsAllowed        != null && { petsAllowed:        Boolean(petsAllowed) }),
        ...(additionalTerms    != null && { additionalTerms }),
        tenantSigned: false, ownerSigned: false,
        tenantSignedAt: null, ownerSignedAt: null,
      }
    });

    return res.json({ success: true, data: updated, message: 'Agreement update ho gaya.' });

  } catch (err) {
    console.error('[agreement PUT]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/user/agreement/:id/sign ─────────────────
router.put('/:id/sign', async (req, res) => {
  try {
    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.id },
      include: { listing: { include: { property: true } } }
    });

    if (!agreement)                    return res.status(404).json({ success: false, message: 'Agreement nahi mila.' });
    if (agreement.status === 'ACTIVE') return res.status(400).json({ success: false, message: 'Agreement pehle se active hai.' });
    if (agreement.status !== 'DRAFT')  return res.status(400).json({ success: false, message: 'Sirf DRAFT sign ho sakta hai.' });

    const isOwner  = agreement.listing.property.ownerId === req.user.id;
    const isTenant = agreement.listing.tenantId         === req.user.id;
    if (!isOwner && !isTenant) return res.status(403).json({ success: false, message: 'Access nahi hai.' });

    const now        = new Date();
    const updateData = isOwner
      ? { ownerSigned: true,  ownerSignedAt:  now }
      : { tenantSigned: true, tenantSignedAt: now };

    // Dono ne sign kiya?
    // NOTE: ab agreement ACTIVE nahi hogi sign se — pehle deposit verify hogi
    const bothSigned = isOwner ? agreement.tenantSigned : agreement.ownerSigned;

    const updated = await db.agreement.update({
      where: { id: req.params.id },
      data:  updateData
    });

    const msg = bothSigned
      ? 'Dono ne sign kar liya! Ab tenant security deposit submit kare.'
      : 'Aap ne sign kar diya. Doosre party ka intezaar hai.';

    return res.json({
      success:      true,
      data:         updated,
      message:      msg,
      bothSigned:   bothSigned,   // frontend payment form unlock karne ke liye
    });

  } catch (err) {
    console.error('[agreement sign]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/user/agreement/:id/pay — Tenant deposit submit
router.post('/:id/pay', async (req, res) => {
  try {
    const { transactionId, amount } = req.body;

    if (!transactionId?.trim()) return res.status(400).json({ success: false, message: 'Transaction ID zaruri hai.' });
    if (!amount)                 return res.status(400).json({ success: false, message: 'Amount zaruri hai.' });

    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.id },
      include: {
        listing:        { include: { property: true } },
        securityPayment: true
      }
    });

    if (!agreement) return res.status(404).json({ success: false, message: 'Agreement nahi mila.' });

    // Sirf tenant submit kar sakta hai
    if (agreement.listing.tenantId !== req.user.id) return res.status(403).json({ success: false, message: 'Sirf tenant payment submit kar sakta hai.' });

    // Dono ne sign kiya hona chahiye
    if (!agreement.tenantSigned || !agreement.ownerSigned) {
      return res.status(400).json({ success: false, message: 'Pehle dono parties sign karo.' });
    }

    // Pehle se pending payment hai?
    if (agreement.securityPayment?.status === 'PENDING_VERIFICATION') {
      return res.status(409).json({ success: false, message: 'Ek payment pehle se verification pending hai.' });
    }
    if (agreement.securityPayment?.status === 'VERIFIED') {
      return res.status(409).json({ success: false, message: 'Payment pehle se verified ho chuki hai.' });
    }

    // Agar REJECTED thi to delete kar ke nayi submit karo
    if (agreement.securityPayment?.status === 'REJECTED') {
      await db.securityDepositPayment.delete({ where: { agreementId: req.params.id } });
    }

    const payment = await db.securityDepositPayment.create({
      data: {
        agreementId:   req.params.id,
        transactionId: transactionId.trim(),
        amount:        parseFloat(amount),
        status:        'PENDING_VERIFICATION',
      }
    });

    return res.status(201).json({
      success: true,
      data:    payment,
      message: 'Payment submit ho gayi! Owner verification ka intezaar karein.'
    });

  } catch (err) {
    console.error('[agreement pay]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/user/agreement/:id/verify — Owner verify/reject
router.put('/:id/verify', async (req, res) => {
  try {
    const { action, rejectedReason = '' } = req.body;  // action: 'verify' | 'reject'

    if (!['verify', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "action 'verify' ya 'reject' hona chahiye." });
    }

    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.id },
      include: {
        listing:        { include: { property: true } },
        securityPayment: true
      }
    });

    if (!agreement) return res.status(404).json({ success: false, message: 'Agreement nahi mila.' });

    // Sirf owner verify kar sakta hai
    if (agreement.listing.property.ownerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Sirf owner payment verify kar sakta hai.' });
    }

    if (!agreement.securityPayment) {
      return res.status(404).json({ success: false, message: 'Koi payment submit nahi ki gayi.' });
    }
    if (agreement.securityPayment.status !== 'PENDING_VERIFICATION') {
      return res.status(400).json({ success: false, message: 'Yeh payment already process ho chuki hai.' });
    }

    if (action === 'verify') {
      // Transaction mein: payment verified + agreement ACTIVE
      await db.$transaction(async (tx) => {
        await tx.securityDepositPayment.update({
          where: { agreementId: req.params.id },
          data:  { status: 'VERIFIED', verifiedAt: new Date() }
        });
        await tx.agreement.update({
          where: { id: req.params.id },
          data:  { status: 'ACTIVE' }
        });
      });

      return res.json({ success: true, message: 'Payment verify ho gayi! Agreement ab ACTIVE hai.' });

    } else {
      // Reject — tenant dobara submit karega
      await db.securityDepositPayment.update({
        where: { agreementId: req.params.id },
        data:  {
          status:         'REJECTED',
          rejectedReason: rejectedReason || 'Transaction ID sahi nahi hai.'
        }
      });

      return res.json({ success: true, message: 'Payment reject ho gayi. Tenant ko notify kar diya.' });
    }

  } catch (err) {
    console.error('[agreement verify]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
