// src/routes/User/agreement.js
// GET  /api/user/agreement/:listingId  → view agreement
// PUT  /api/user/agreement/:id         → update terms (owner, DRAFT only)
// PUT  /api/user/agreement/:id/sign    → sign agreement
// POST /api/user/agreement/:id/pay     → tenant submits deposit
// PUT  /api/user/agreement/:id/verify  → owner verify/reject

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

    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found.' });

    const isOwner  = listing.property.ownerId === req.user.id;
    const isTenant = listing.tenantId         === req.user.id;

    if (!isOwner && !isTenant) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (listing.status !== 'ACCEPTED') return res.status(400).json({ success: false, message: 'Agreement is only available for accepted listings.' });
    if (!listing.agreement) return res.status(404).json({ success: false, message: 'Agreement has not been created yet.' });

    return res.json({
      success: true,
      data: {
        agreement:       listing.agreement,
        securityPayment: listing.agreement.securityPayment || null,
        property:        listing.property,
        tenantId:        listing.tenantId,
        userRole:        isOwner ? 'owner' : 'tenant'
      }
    });

  } catch (err) {
    console.error('[agreement GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/user/agreement/:id — Terms update (owner only, DRAFT only)
router.put('/:id', async (req, res) => {
  try {
    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.id },
      include: { listing: { include: { property: true } } }
    });

    if (!agreement)                                          return res.status(404).json({ success: false, message: 'Agreement not found.' });
    if (agreement.listing.property.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Only the owner can update terms.' });
    if (agreement.status !== 'DRAFT')                       return res.status(400).json({ success: false, message: 'Only DRAFT agreements can be updated.' });

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

    return res.json({ success: true, data: updated, message: 'Agreement updated successfully.' });

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

    if (!agreement)                    return res.status(404).json({ success: false, message: 'Agreement not found.' });
    if (agreement.status === 'ACTIVE') return res.status(400).json({ success: false, message: 'Agreement is already active.' });
    if (agreement.status !== 'DRAFT')  return res.status(400).json({ success: false, message: 'Only DRAFT agreements can be signed.' });

    const isOwner  = agreement.listing.property.ownerId === req.user.id;
    const isTenant = agreement.listing.tenantId         === req.user.id;
    if (!isOwner && !isTenant) return res.status(403).json({ success: false, message: 'Access denied.' });

    const now        = new Date();
    const updateData = isOwner
      ? { ownerSigned: true,  ownerSignedAt:  now }
      : { tenantSigned: true, tenantSignedAt: now };

    const bothSigned = isOwner ? agreement.tenantSigned : agreement.ownerSigned;

    // NOTE: stays DRAFT after both sign — becomes ACTIVE only after deposit is verified
    const updated = await db.agreement.update({
      where: { id: req.params.id },
      data:  updateData
    });

    const msg = bothSigned
      ? 'Both parties have signed! Tenant must now submit the security deposit.'
      : 'You have signed. Waiting for the other party.';

    return res.json({ success: true, data: updated, message: msg, bothSigned });

  } catch (err) {
    console.error('[agreement sign]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/user/agreement/:id/pay — Tenant deposit submit
router.post('/:id/pay', async (req, res) => {
  try {
    const { transactionId, amount } = req.body;

    if (!transactionId?.trim()) return res.status(400).json({ success: false, message: 'Transaction ID is required.' });
    if (!amount)                 return res.status(400).json({ success: false, message: 'Amount is required.' });

    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.id },
      include: {
        listing:        { include: { property: true } },
        securityPayment: true
      }
    });

    if (!agreement) return res.status(404).json({ success: false, message: 'Agreement not found.' });
    if (agreement.listing.tenantId !== req.user.id) return res.status(403).json({ success: false, message: 'Only the tenant can submit a payment.' });
    if (!agreement.tenantSigned || !agreement.ownerSigned) return res.status(400).json({ success: false, message: 'Both parties must sign first.' });

    if (agreement.securityPayment?.status === 'PENDING_VERIFICATION')
      return res.status(409).json({ success: false, message: 'A payment is already pending verification.' });
    if (agreement.securityPayment?.status === 'VERIFIED')
      return res.status(409).json({ success: false, message: 'Payment has already been verified.' });

    // REJECTED thi to delete kar ke nayi submit karo
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
      message: 'Payment submitted! Waiting for owner verification.'
    });

  } catch (err) {
    console.error('[agreement pay]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/user/agreement/:id/verify — Owner verify/reject
router.put('/:id/verify', async (req, res) => {
  try {
    const { action, rejectedReason = '' } = req.body;

    if (!['verify', 'reject'].includes(action))
      return res.status(400).json({ success: false, message: "action must be 'verify' or 'reject'." });

    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.id },
      include: {
        listing:        { include: { property: true } },
        securityPayment: true
      }
    });

    if (!agreement) return res.status(404).json({ success: false, message: 'Agreement not found.' });
    if (agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Only the owner can verify payments.' });
    if (!agreement.securityPayment)
      return res.status(404).json({ success: false, message: 'No payment has been submitted.' });
    if (agreement.securityPayment.status !== 'PENDING_VERIFICATION')
      return res.status(400).json({ success: false, message: 'This payment has already been processed.' });

    if (action === 'verify') {
      await db.$transaction(async (tx) => {
        // 1. Security deposit verify
        await tx.securityDepositPayment.update({
          where: { agreementId: req.params.id },
          data:  { status: 'VERIFIED', verifiedAt: new Date() }
        });

        // 2. Agreement ACTIVE
        const updatedAgreement = await tx.agreement.update({
          where:   { id: req.params.id },
          data:    { status: 'ACTIVE' },
          include: { listing: { include: { property: true } } }
        });

        // 3. Rental record create karo (Agreement se linked)
        await tx.rental.upsert({
          where:  { agreementId: req.params.id },
          update: { isActive: true },
          create: {
            agreementId: req.params.id,
            propertyId:  updatedAgreement.listing.propertyId,
            ownerId:     updatedAgreement.listing.property.ownerId,
            tenantId:    updatedAgreement.listing.tenantId,
            rentAmount:  updatedAgreement.monthlyRent,
            startDate:   updatedAgreement.startDate,
            endDate:     updatedAgreement.endDate,
            isActive:    true,
          }
        });
      });
      return res.json({ success: true, message: 'Payment verified! Agreement is now ACTIVE.' });

    } else {
      await db.securityDepositPayment.update({
        where: { agreementId: req.params.id },
        data:  { status: 'REJECTED', rejectedReason: rejectedReason || 'Invalid transaction ID.' }
      });
      return res.json({ success: true, message: 'Payment rejected.' });
    }

  } catch (err) {
    console.error('[agreement verify]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;