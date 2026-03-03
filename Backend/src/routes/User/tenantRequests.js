// src/routes/User/tenantRequests.js
// ══════════════════════════════════════════════════════
// TENANT — login required
// POST   /api/user/requests       → property ke liye request bhejo
// GET    /api/user/requests       → meri sab requests (with status + agreement)
// DELETE /api/user/requests/:id   → PENDING request wapas lo
//
// index.js mein add karo:
//   import tenantRequests from './routes/User/tenantRequests.js';
//   app.use('/api/user/requests', tenantRequests);
// ══════════════════════════════════════════════════════

import express   from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();

router.use(protect);  // sab routes login require karte hain

// ── POST /api/user/requests ───────────────────────────
router.post('/', async (req, res) => {
  try {
    const { propertyId, message = '' } = req.body;
    const tenantId = req.user.id;

    if (!propertyId) return res.status(400).json({ success: false, message: 'propertyId zaruri hai.' });

    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property)           return res.status(404).json({ success: false, message: 'Property nahi mili.' });
    if (!property.isAvailable) return res.status(400).json({ success: false, message: 'Yeh property available nahi hai.' });
    if (property.ownerId === tenantId) return res.status(400).json({ success: false, message: 'Apni khud ki property pe request nahi kar sakte.' });

    // Pehle se request check
    const existing = await db.listing.findUnique({
      where: { propertyId_tenantId: { propertyId, tenantId } }
    });

    if (existing) {
      if (existing.status === 'PENDING')  return res.status(409).json({ success: false, message: 'Aap ne pehle se yeh request bheji hui hai.' });
      if (existing.status === 'ACCEPTED') return res.status(409).json({ success: false, message: 'Aap ki request pehle se accept ho chuki hai.' });
      // DECLINED thi — purani delete kar ke nayi banao
      await db.listing.delete({ where: { id: existing.id } });
    }

    const listing = await db.listing.create({
      data:    { propertyId, tenantId, message },
      include: {
        property: { include: { owner: { select: { name: true, phone: true } } } }
      }
    });

    return res.status(201).json({ success: true, data: listing, message: 'Request bheji gayi!' });

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
        agreement: true   // agar accept hua to agreement bhi aayega
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

    if (!listing)                          return res.status(404).json({ success: false, message: 'Request nahi mili.' });
    if (listing.tenantId !== req.user.id)  return res.status(403).json({ success: false, message: 'Yeh aap ki request nahi.' });
    if (listing.status   !== 'PENDING')    return res.status(400).json({ success: false, message: 'Sirf PENDING request cancel ho sakti hai.' });

    await db.listing.delete({ where: { id: req.params.id } });

    return res.json({ success: true, message: 'Request cancel ho gayi.' });

  } catch (err) {
    console.error('[tenantRequests DELETE]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
