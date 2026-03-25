// src/routes/User/tenantRequests.js
// ══════════════════════════════════════════════════════
// TENANT — login required
// POST   /api/user/requests       → send a rental request
// GET    /api/user/requests       → all my requests (with status + agreement)
// DELETE /api/user/requests/:id   → cancel a PENDING request
//
// Add to index.js:
//   import tenantRequests from './routes/User/tenantRequests.js';
//   app.use('/api/user/requests', tenantRequests);
// ══════════════════════════════════════════════════════

import express   from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();

router.use(protect);  // all routes require login

// ── POST /api/user/requests ───────────────────────────
router.post('/', async (req, res) => {
  try {
    const { propertyId, message = '' } = req.body;
    const tenantId = req.user.id;

    if (!propertyId) return res.status(400).json({ success: false, message: 'propertyId is required.' });

    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property)           return res.status(404).json({ success: false, message: 'Property not found.' });
    if (!property.isAvailable) return res.status(400).json({ success: false, message: 'This property is not available.' });
    if (property.ownerId === tenantId) return res.status(400).json({ success: false, message: 'You cannot send a request for your own property.' });

    // Check for existing request
    const existing = await db.listing.findUnique({
      where: { propertyId_tenantId: { propertyId, tenantId } }
    });

    if (existing) {
      if (existing.status === 'PENDING')  return res.status(409).json({ success: false, message: 'You have already sent a request for this property.' });
      if (existing.status === 'ACCEPTED') return res.status(409).json({ success: false, message: 'Your request has already been accepted.' });
      // Was DECLINED — delete old and create new
      await db.listing.delete({ where: { id: existing.id } });
    }

    const listing = await db.listing.create({
      data:    { propertyId, tenantId, message },
      include: {
        property: { include: { owner: { select: { name: true, phone: true } } } }
      }
    });

    return res.status(201).json({ success: true, data: listing, message: 'Request sent successfully!' });

  } catch (err) {
    console.error('[tenantRequests POST]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/user/requests ────────────────────────────
router.get('/', async (req, res) => {
  try {
    const listings = await db.listing.findMany({
      where:   { tenantId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          include: { owner: { select: { id: true, name: true, phone: true, email: true } } }
        },
        agreement: true   // agreement included if accepted
      }
    });

    return res.json({ success: true, data: listings });

  } catch (err) {
    console.error('[tenantRequests GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/user/requests/:id ────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const listing = await db.listing.findUnique({ where: { id: req.params.id } });

    if (!listing)                          return res.status(404).json({ success: false, message: 'Request not found.' });
    if (listing.tenantId !== req.user.id)  return res.status(403).json({ success: false, message: 'This is not your request.' });
    if (listing.status   !== 'PENDING')    return res.status(400).json({ success: false, message: 'Only PENDING requests can be cancelled.' });

    await db.listing.delete({ where: { id: req.params.id } });

    return res.json({ success: true, message: 'Request cancelled successfully.' });

  } catch (err) {
    console.error('[tenantRequests DELETE]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;