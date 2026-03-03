// src/routes/User/agreement.js
// ══════════════════════════════════════════════════════
// BOTH (tenant + owner) — login required
// GET /api/user/agreement/:listingId    → agreement dekho
// PUT /api/user/agreement/:id           → terms update karo (owner only)
// PUT /api/user/agreement/:id/sign      → sign karo
//
// index.js mein add karo:
//   import agreementRoutes from './routes/User/agreement.js';
//   app.use('/api/user/agreement', agreementRoutes);
// ══════════════════════════════════════════════════════

import express   from 'express';
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
      include: { agreement: true, property: { include: { owner: true } } }
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
        agreement: listing.agreement,
        property:  listing.property,
        tenantId:  listing.tenantId,
        userRole:  isOwner ? 'owner' : 'tenant'
      }
    });

  } catch (err) {
    console.error('[agreement GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/user/agreement/:id — Terms update (owner) ─
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
        // Terms badli to signatures reset
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

    if (!agreement)                   return res.status(404).json({ success: false, message: 'Agreement nahi mila.' });
    if (agreement.status === 'ACTIVE') return res.status(400).json({ success: false, message: 'Agreement pehle se active hai.' });
    if (agreement.status !== 'DRAFT') return res.status(400).json({ success: false, message: 'Sirf DRAFT sign ho sakta hai.' });

    const isOwner  = agreement.listing.property.ownerId === req.user.id;
    const isTenant = agreement.listing.tenantId         === req.user.id;
    if (!isOwner && !isTenant) return res.status(403).json({ success: false, message: 'Access nahi hai.' });

    const now        = new Date();
    const updateData = isOwner
      ? { ownerSigned:  true, ownerSignedAt:  now }
      : { tenantSigned: true, tenantSignedAt: now };

    // Dono ne sign kiya? ACTIVE kar do
    const bothSigned = isOwner ? agreement.tenantSigned : agreement.ownerSigned;
    if (bothSigned) updateData.status = 'ACTIVE';

    const updated = await db.agreement.update({
      where: { id: req.params.id },
      data:  updateData
    });

    const msg = bothSigned
      ? 'Dono ne sign kar liya! Agreement ACTIVE ho gaya.'
      : 'Aap ne sign kar diya. Doosre party ka intezaar hai.';

    return res.json({ success: true, data: updated, message: msg });

  } catch (err) {
    console.error('[agreement sign]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
