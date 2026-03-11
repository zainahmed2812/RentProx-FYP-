// src/routes/User/property.js
// ══════════════════════════════════════════════════════
// POST   /api/user/property       → property add karo
// GET    /api/user/property       → meri sab properties
// DELETE /api/user/property/:id   → property delete karo
// ══════════════════════════════════════════════════════

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect }      from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();

router.use(protect);

// ── POST /api/user/property ───────────────────────────
router.post('/', async (req, res) => {
  try {
    const { city, address, area, areaUnit, rentAmount, description } = req.body;

    if (!city || !address || !area || !rentAmount) {
      return res.status(400).json({
        success: false,
        message: 'City, address, area, rentAmount zaruri hain.'
      });
    }

    const property = await db.property.create({
      data: {
        city,
        address,
        area:        parseFloat(area),
        areaUnit:    areaUnit || 'MARLA',
        rentAmount:  parseFloat(rentAmount),
        description: description || '',
        ownerId:     req.user.id,
      }
    });

    return res.status(201).json({
      success: true,
      data:    property,
      message: 'Property add ho gayi!'
    });

  } catch (err) {
    console.error('[property POST]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/user/property ────────────────────────────
router.get('/', async (req, res) => {
  try {
    const properties = await db.property.findMany({
      where:   { ownerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        listings: {
          where:   { status: 'ACCEPTED' },
          include: {
            tenant:    { select: { id: true, name: true, phone: true } },
            agreement: { select: { id: true, status: true, monthlyRent: true } }
          }
        }
      }
    });

    return res.json({ success: true, data: properties });

  } catch (err) {
    console.error('[property GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/user/property/:id ─────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const property = await db.property.findUnique({
      where: { id: req.params.id }
    });

    if (!property)
      return res.status(404).json({ success: false, message: 'Property nahi mili.' });
    if (property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Yeh aap ki property nahi.' });

    await db.property.delete({ where: { id: req.params.id } });

    return res.json({ success: true, message: 'Property delete ho gayi.' });

  } catch (err) {
    console.error('[property DELETE]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;