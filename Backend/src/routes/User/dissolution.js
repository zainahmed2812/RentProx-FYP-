// src/routes/User/dissolution.js
// ══════════════════════════════════════════════════════
// Agreement Dissolution — Tenant + Owner dono sides
//
// ── TENANT ENDPOINTS ─────────────────────────────────
//   POST   /api/user/dissolution              → request bhejo
//   GET    /api/user/dissolution/:agreementId → apni request dekho
//   DELETE /api/user/dissolution/:id          → pending request wapas lo
//
// ── OWNER ENDPOINTS ──────────────────────────────────
//   GET    /api/owner/dissolution             → sab incoming requests
//   PUT    /api/owner/dissolution/:id/accept  → accept → agreement CANCELLED
//   PUT    /api/owner/dissolution/:id/decline → decline
//   POST   /api/owner/dissolution/direct      → bina request ke seedha dissolve
//
// ── index.js mein add karo ───────────────────────────
//   import dissolutionRoutes from './routes/User/dissolution.js';
//   app.use('/api/user',  dissolutionRoutes);
//   app.use('/api/owner', dissolutionRoutes);
// ══════════════════════════════════════════════════════

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();

router.use(protect);

// ══════════════════════════════════════════════════════
//  INTERNAL HELPER — agreement + listing + property reset
//  Yeh function dono cases mein reuse hota hai:
//  (1) owner accepts tenant's request
//  (2) owner direct dissolve karta hai
// ══════════════════════════════════════════════════════

async function performDissolution(tx, agreementId, dissolvedBy, note) {
  // 1. Agreement CANCELLED + audit trail
  const agreement = await tx.agreement.update({
    where: { id: agreementId },
    data: {
      status:         'CANCELLED',
      dissolvedAt:    new Date(),
      dissolvedBy,              // 'owner' ya 'tenant_request'
      dissolutionNote: note || '',
    },
    include: { listing: { select: { id: true, propertyId: true } } }
  });

  // 2. Listing close karo
  await tx.listing.update({
    where: { id: agreement.listing.id },
    data:  { status: 'DECLINED', isActive: false }
  });

  // 3. Property wapas available
  await tx.property.update({
    where: { id: agreement.listing.propertyId },
    data:  { isAvailable: true }
  });

  return agreement;
}

// ══════════════════════════════════════════════════════
//  TENANT ROUTES
// ══════════════════════════════════════════════════════

// POST /api/user/dissolution
// Tenant dissolution request bhejta hai
router.post('/dissolution', async (req, res) => {
  try {
    const { agreementId, reason, proposedVacateDate } = req.body;

    if (!agreementId)    return res.status(400).json({ success: false, message: 'agreementId is required.' });
    if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Dissolution reason is required.' });

    // Agreement verify + tenant ownership check
    const agreement = await db.agreement.findUnique({
      where:   { id: agreementId },
      include: { listing: true, dissolutionRequest: true }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement not found.' });

    if (agreement.listing.tenantId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your agreement.' });

    if (agreement.status !== 'ACTIVE')
      return res.status(400).json({ success: false, message: 'Only ACTIVE agreements can be dissolved.' });

    // Pehle se PENDING request check
    if (agreement.dissolutionRequest?.status === 'PENDING')
      return res.status(409).json({ success: false, message: 'A request is already pending. Please wait for the owner\'s response or withdraw your request.' });

    const dissolution = await db.dissolutionRequest.upsert({
      where:  { agreementId },
      create: {
        agreementId,
        tenantId:          req.user.id,
        reason:            reason.trim(),
        proposedVacateDate: proposedVacateDate ? new Date(proposedVacateDate) : null,
        status:            'PENDING',
      },
      update: {   // DECLINED thi to dobara PENDING mein bhejo
        reason:            reason.trim(),
        proposedVacateDate: proposedVacateDate ? new Date(proposedVacateDate) : null,
        status:            'PENDING',
        ownerNote:         '',
        respondedAt:       null,
        requestedAt:       new Date(),
      }
    });

    return res.status(201).json({
      success: true,
      data:    dissolution,
      message: 'Dissolution request sent. Wait for the owner\'s response.'
    });

  } catch (err) {
    console.error('[dissolution POST]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/user/dissolution/:agreementId
// Tenant apni dissolution request status dekhe
router.get('/dissolution/:agreementId', async (req, res) => {
  try {
    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.agreementId },
      include: { listing: true }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement not found.' });

    if (agreement.listing.tenantId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const dissolution = await db.dissolutionRequest.findUnique({
      where: { agreementId: req.params.agreementId }
    });

    return res.json({ success: true, data: dissolution || null });

  } catch (err) {
    console.error('[dissolution GET tenant]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/user/dissolution/:id
// Tenant PENDING request wapas le
router.delete('/dissolution/:id', async (req, res) => {
  try {
    const dissolution = await db.dissolutionRequest.findUnique({
      where: { id: req.params.id }
    });

    if (!dissolution)
      return res.status(404).json({ success: false, message: 'Request not found.' });

    if (dissolution.tenantId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your request.' });

    if (dissolution.status !== 'PENDING')
      return res.status(400).json({ success: false, message: 'Only PENDING requests can be cancelled.' });

    await db.dissolutionRequest.delete({ where: { id: req.params.id } });

    return res.json({ success: true, message: 'Request cancelled.' });

  } catch (err) {
    console.error('[dissolution DELETE]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ══════════════════════════════════════════════════════
//  OWNER ROUTES
// ══════════════════════════════════════════════════════

// GET /api/owner/dissolution
// Owner ke properties ki sab dissolution requests
router.get('/dissolution', async (req, res) => {
  try {
    const requests = await db.dissolutionRequest.findMany({
      where: {
        agreement: {
          listing: { property: { ownerId: req.user.id } }
        }
      },
      orderBy: { requestedAt: 'desc' },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        agreement: {
          include: {
            listing: {
              include: {
                property: { select: { id: true, address: true, city: true, rentAmount: true } }
              }
            }
          }
        }
      }
    });

    return res.json({
      success: true,
      data: {
        all:      requests,
        pending:  requests.filter(r => r.status === 'PENDING'),
        accepted: requests.filter(r => r.status === 'ACCEPTED'),
        declined: requests.filter(r => r.status === 'DECLINED'),
      }
    });

  } catch (err) {
    console.error('[dissolution GET owner]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/owner/dissolution/:id/accept
// Owner tenant ki request accept kare → agreement CANCELLED
router.put('/dissolution/:id/accept', async (req, res) => {
  try {
    const { ownerNote = '' } = req.body;

    const dissolution = await db.dissolutionRequest.findUnique({
      where:   { id: req.params.id },
      include: {
        agreement: {
          include: { listing: { include: { property: true } } }
        }
      }
    });

    if (!dissolution)
      return res.status(404).json({ success: false, message: 'Request not found.' });

    if (dissolution.agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your property.' });

    if (dissolution.status !== 'PENDING')
      return res.status(400).json({ success: false, message: 'Only PENDING requests can be accepted.' });

    if (dissolution.agreement.status !== 'ACTIVE')
      return res.status(400).json({ success: false, message: 'The agreement is not currently active.' });

    await db.$transaction(async (tx) => {
      // 1. Request accept karo
      await tx.dissolutionRequest.update({
        where: { id: req.params.id },
        data: {
          status:      'ACCEPTED',
          ownerNote:   ownerNote.trim(),
          respondedAt: new Date(),
        }
      });

      // 2. Agreement + listing + property reset
      await performDissolution(
        tx,
        dissolution.agreementId,
        'tenant_request',
        `Tenant request accept ki. ${ownerNote}`.trim()
      );
    });

    return res.json({
      success: true,
      message: 'Dissolution request re-accepted. Agreement CANCELLED and property is available for rent'

    });

  } catch (err) {
    console.error('[dissolution accept]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/owner/dissolution/:id/decline
// Owner tenant ki request decline kare — agreement chalti rahe
router.put('/dissolution/:id/decline', async (req, res) => {
  try {
    const { ownerNote = '' } = req.body;

    if (!ownerNote?.trim())
      return res.status(400).json({ success: false, message: 'Reason for decline is required.' });

    const dissolution = await db.dissolutionRequest.findUnique({
      where:   { id: req.params.id },
      include: {
        agreement: {
          include: { listing: { include: { property: true } } }
        }
      }
    });

    if (!dissolution)
      return res.status(404).json({ success: false, message: 'Request not found.' });

    if (dissolution.agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your property.' });

    if (dissolution.status !== 'PENDING')
      return res.status(400).json({ success: false, message: 'Only PENDING requests can be declined.' });

    await db.dissolutionRequest.update({
      where: { id: req.params.id },
      data: {
        status:      'DECLINED',
        ownerNote:   ownerNote.trim(),
        respondedAt: new Date(),
      }
    });

    return res.json({ success: true, message: 'Dissolution request declined.' });

  } catch (err) {
    console.error('[dissolution decline]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/owner/dissolution/direct
// Owner seedha agreement dissolve kare (tenant ki request ka intezaar kiye bina)
router.post('/dissolution/direct', async (req, res) => {
  try {
    const { agreementId, reason } = req.body;

    if (!agreementId)    return res.status(400).json({ success: false, message: 'agreementId is required.' });
    if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason for dissolution is required.' });

    const agreement = await db.agreement.findUnique({
      where:   { id: agreementId },
      include: { listing: { include: { property: true } } }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement not found.' });

    if (agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your property.' });

    if (agreement.status !== 'ACTIVE')
      return res.status(400).json({ success: false, message: 'Only ACTIVE agreements can be dissolved.' });

    await db.$transaction(async (tx) => {
      await performDissolution(tx, agreementId, 'owner', reason.trim());
    });

    return res.json({
      success: true,
      message: 'Agreement dissolved.'
    });

  } catch (err) {
    console.error('[dissolution direct]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;