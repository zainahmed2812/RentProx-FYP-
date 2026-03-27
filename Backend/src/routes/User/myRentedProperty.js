// src/routes/User/myRentedProperty.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();
router.use(protect);

// ── GET /api/user/my-rental ───────────────────────────
// Ab SARI active rentals return karta hai (multiple support)
router.get('/my-rental', async (req, res) => {
  try {
    const rentals = await db.rental.findMany({
      where: { tenantId: req.user.id, isActive: true },
      include: {
        property: {
          include: {
            owner: { select: { id: true, name: true, phone: true, email: true } }
          }
        },
        agreement: {
          include: {
            securityPayment:      true,
            monthlyPayments:      { orderBy: { month: 'asc' } },
            dissolutionRequest:   true,
            maintenanceRequests:  { orderBy: { createdAt: 'desc' } },
          }
        },
        owner:  { select: { id: true, name: true, phone: true, email: true } },
        tenant: { select: { id: true, name: true, phone: true, email: true } },
      }
    });

    if (!rentals.length) {
      return res.json({ success: true, data: null, message: 'No active rental found.' });
    }

    // Backward compat: data.rental = first rental, data.rentals = all
    const primary = rentals[0];
    return res.json({
      success: true,
      data: {
        // Single rental fields (backward compat)
        rental:    primary,
        property:  primary.property,
        agreement: primary.agreement,
        owner:     primary.owner,
        complaints: primary.agreement.maintenanceRequests || [],
        // Multi-rental support
        rentals:   rentals.map(r => ({
          rentalId:   r.id,
          property:   r.property,
          agreement:  r.agreement,
          owner:      r.owner,
          maintenanceRequests: r.agreement.maintenanceRequests || [],
        }))
      }
    });

  } catch (err) {
    console.error('[my-rental GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/user/maintenance ────────────────────────
// Tenant maintenance request submit kare
router.post('/maintenance', async (req, res) => {
  try {
    const { agreementId, type, title, description } = req.body;

    if (!agreementId)       return res.status(400).json({ success: false, message: 'agreementId zaruri hai.' });
    if (!type)              return res.status(400).json({ success: false, message: 'Type zaruri hai.' });
    if (!title?.trim())     return res.status(400).json({ success: false, message: 'Title zaruri hai.' });
    if (!description?.trim()) return res.status(400).json({ success: false, message: 'Description zaruri hai.' });

    // Verify agreement belongs to this tenant
    const agreement = await db.agreement.findUnique({
      where:   { id: agreementId },
      include: { listing: true }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement nahi mila.' });
    if (agreement.listing.tenantId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Yeh aap ki agreement nahi.' });
    if (agreement.status !== 'ACTIVE')
      return res.status(400).json({ success: false, message: 'Agreement active nahi hai.' });

    const request = await db.maintenanceRequest.create({
      data: {
        agreementId,
        type,
        title:       title.trim(),
        description: description.trim(),
        status:      'OPEN',
      }
    });

    return res.status(201).json({
      success: true,
      data:    request,
      message: 'Request submit ho gayi! Owner ko notify kar diya gaya.'
    });

  } catch (err) {
    console.error('[maintenance POST]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/user/maintenance ─────────────────────────
// Tenant apni sari maintenance requests dekhe
router.get('/maintenance', async (req, res) => {
  try {
    const rentals = await db.rental.findMany({
      where:   { tenantId: req.user.id, isActive: true },
      include: {
        property: { select: { id: true, address: true, city: true } },
        agreement: {
          include: {
            maintenanceRequests: { orderBy: { createdAt: 'desc' } }
          }
        }
      }
    });

    const requests = rentals.flatMap(r =>
      r.agreement.maintenanceRequests.map(m => ({
        ...m,
        property: r.property
      }))
    );

    return res.json({ success: true, data: requests });

  } catch (err) {
    console.error('[maintenance GET tenant]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/owner/maintenance ────────────────────────
// Owner apni properties ki maintenance requests dekhe
router.get('/maintenance-requests', async (req, res) => {
  try {
    const requests = await db.maintenanceRequest.findMany({
      where: {
        agreement: {
          listing: { property: { ownerId: req.user.id } }
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        agreement: {
          include: {
            listing: {
              include: {
                property: { select: { id: true, address: true, city: true } },
                tenant:   { select: { id: true, name: true, phone: true } },
              }
            }
          }
        }
      }
    });

    const data = requests.map(r => ({
      ...r,
      property: r.agreement.listing.property,
      tenant:   r.agreement.listing.tenant,
    }));

    return res.json({ success: true, data });

  } catch (err) {
    console.error('[maintenance GET owner]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/owner/maintenance/:id ────────────────────
// Owner status update kare
router.put('/maintenance-requests/:id', async (req, res) => {
  try {
    const { status, adminNote = '' } = req.body;
    const allowed = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });

    const request = await db.maintenanceRequest.findUnique({
      where:   { id: req.params.id },
      include: { agreement: { include: { listing: { include: { property: true } } } } }
    });

    if (!request)
      return res.status(404).json({ success: false, message: 'Request nahi mili.' });
    if (request.agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Yeh aap ki property nahi.' });

    const updated = await db.maintenanceRequest.update({
      where: { id: req.params.id },
      data:  { status, adminNote: adminNote.trim() }
    });

    return res.json({ success: true, data: updated, message: 'Status update ho gaya.' });

  } catch (err) {
    console.error('[maintenance PUT]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
