// src/routes/User/dissolution.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();

router.use(protect);

// Internal helper — agreement cancel + listing declined + property available
async function performDissolution(tx, agreementId, dissolvedBy, note) {
  const agreement = await tx.agreement.update({
    where: { id: agreementId },
    data: {
      status:          'CANCELLED',
      dissolvedAt:     new Date(),
      dissolvedBy,
      dissolutionNote: note || '',
    },
    include: { listing: { select: { id: true, propertyId: true } } }
  });

  await tx.listing.update({
    where: { id: agreement.listing.id },
    data:  { status: 'DECLINED' }
  });

  await tx.property.update({
    where: { id: agreement.listing.propertyId },
    data:  { isAvailable: true }
  });

  // Rental record deactivate karo
  await tx.rental.updateMany({
    where: { agreementId },
    data:  { isActive: false, endDate: new Date() }
  });

  return agreement;
}

// ── TENANT ROUTES ─────────────────────────────────────

// POST /api/user/dissolution
router.post('/dissolution', async (req, res) => {
  try {
    const { agreementId, reason, proposedVacateDate } = req.body;

    if (!agreementId)    return res.status(400).json({ success: false, message: 'agreementId zaruri hai.' });
    if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason zaruri hai.' });

    const agreement = await db.agreement.findUnique({
      where:   { id: agreementId },
      include: { listing: true, dissolutionRequest: true }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement nahi mila.' });
    if (agreement.listing.tenantId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Yeh aap ki agreement nahi.' });
    if (agreement.status !== 'ACTIVE')
      return res.status(400).json({ success: false, message: 'Sirf ACTIVE agreement dissolve ho sakti hai.' });
    if (agreement.dissolutionRequest?.status === 'PENDING')
      return res.status(409).json({ success: false, message: 'Ek request pehle se pending hai.' });

    const dissolution = await db.dissolutionRequest.upsert({
      where:  { agreementId },
      create: {
        agreementId,
        tenantId:           req.user.id,
        reason:             reason.trim(),
        proposedVacateDate: proposedVacateDate ? new Date(proposedVacateDate) : null,
        status:             'PENDING',
      },
      update: {
        reason:             reason.trim(),
        proposedVacateDate: proposedVacateDate ? new Date(proposedVacateDate) : null,
        status:             'PENDING',
        ownerNote:          '',
        respondedAt:        null,
        requestedAt:        new Date(),
      }
    });

    return res.status(201).json({
      success: true,
      data:    dissolution,
      message: 'Dissolution request bhej di gayi. Owner ke jawab ka intezaar karein.'
    });

  } catch (err) {
    console.error('[dissolution POST]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/user/dissolution/:agreementId
router.get('/dissolution/:agreementId', async (req, res) => {
  try {
    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.agreementId },
      include: { listing: true }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement nahi mila.' });
    if (agreement.listing.tenantId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Access nahi hai.' });

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
router.delete('/dissolution/:id', async (req, res) => {
  try {
    const dissolution = await db.dissolutionRequest.findUnique({
      where: { id: req.params.id }
    });

    if (!dissolution)
      return res.status(404).json({ success: false, message: 'Request nahi mili.' });
    if (dissolution.tenantId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Yeh aap ki request nahi.' });
    if (dissolution.status !== 'PENDING')
      return res.status(400).json({ success: false, message: 'Sirf PENDING request cancel ho sakti hai.' });

    await db.dissolutionRequest.delete({ where: { id: req.params.id } });

    return res.json({ success: true, message: 'Request wapas le li gayi.' });

  } catch (err) {
    console.error('[dissolution DELETE]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── OWNER ROUTES ──────────────────────────────────────

// GET /api/owner/dissolution
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
      return res.status(404).json({ success: false, message: 'Request nahi mili.' });
    if (dissolution.agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Yeh aap ki property nahi.' });
    if (dissolution.status !== 'PENDING')
      return res.status(400).json({ success: false, message: 'Sirf PENDING request accept ho sakti hai.' });
    if (dissolution.agreement.status !== 'ACTIVE')
      return res.status(400).json({ success: false, message: 'Agreement active nahi hai.' });

    await db.$transaction(async (tx) => {
      await tx.dissolutionRequest.update({
        where: { id: req.params.id },
        data:  { status: 'ACCEPTED', ownerNote: ownerNote.trim(), respondedAt: new Date() }
      });
      await performDissolution(tx, dissolution.agreementId, 'tenant_request', ownerNote.trim());
    });

    return res.json({ success: true, message: 'Request accept ho gayi. Agreement cancel aur property wapas available hai.' });

  } catch (err) {
    console.error('[dissolution accept]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/owner/dissolution/:id/decline
router.put('/dissolution/:id/decline', async (req, res) => {
  try {
    const { ownerNote = '' } = req.body;

    if (!ownerNote?.trim())
      return res.status(400).json({ success: false, message: 'Decline karne ki wajah zaruri hai.' });

    const dissolution = await db.dissolutionRequest.findUnique({
      where:   { id: req.params.id },
      include: {
        agreement: {
          include: { listing: { include: { property: true } } }
        }
      }
    });

    if (!dissolution)
      return res.status(404).json({ success: false, message: 'Request nahi mili.' });
    if (dissolution.agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Yeh aap ki property nahi.' });
    if (dissolution.status !== 'PENDING')
      return res.status(400).json({ success: false, message: 'Sirf PENDING request decline ho sakti hai.' });

    await db.dissolutionRequest.update({
      where: { id: req.params.id },
      data:  { status: 'DECLINED', ownerNote: ownerNote.trim(), respondedAt: new Date() }
    });

    return res.json({ success: true, message: 'Request decline ho gayi.' });

  } catch (err) {
    console.error('[dissolution decline]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/owner/dissolution/direct
router.post('/dissolution/direct', async (req, res) => {
  try {
    const { agreementId, reason } = req.body;

    if (!agreementId)    return res.status(400).json({ success: false, message: 'agreementId zaruri hai.' });
    if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason zaruri hai.' });

    const agreement = await db.agreement.findUnique({
      where:   { id: agreementId },
      include: { listing: { include: { property: true } } }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement nahi mila.' });
    if (agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Yeh aap ki property nahi.' });
    if (agreement.status !== 'ACTIVE')
      return res.status(400).json({ success: false, message: 'Sirf ACTIVE agreement dissolve ho sakti hai.' });

    await db.$transaction(async (tx) => {
      await performDissolution(tx, agreementId, 'owner', reason.trim());
    });

    return res.json({ success: true, message: 'Agreement dissolve ho gayi. Property wapas available hai.' });

  } catch (err) {
    console.error('[dissolution direct]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;