// src/routes/public/listings.js
// ══════════════════════════════════════════════════════
// PUBLIC — no auth needed
// GET /api/listings      → available properties (paginated, filtered)
// GET /api/listings/:id  → single property detail
// ══════════════════════════════════════════════════════

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const db     = new PrismaClient();

// ── GET /api/listings ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { city, areaUnit, maxRent, minRent, page = 1, limit = 12 } = req.query;

    const where = {
      // ─── BUG FIX 1: isAvailable=false properties bilkul na aayein ───
      // Jab owner accept karta hai → property.isAvailable = false hoti hai
      // Yeh ensure karta hai k rented properties listing se hatt jaayein
      isAvailable: true,

      // Optional filters
      ...(city     && { city:     { contains: city, mode: 'insensitive' } }),
      ...(areaUnit && { areaUnit }),
      ...((minRent || maxRent) && {
        rentAmount: {
          ...(minRent && { gte: parseFloat(minRent) }),
          ...(maxRent && { lte: parseFloat(maxRent) }),
        }
      }),
    };

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await db.property.count({ where });

    const properties = await db.property.findMany({
      where,
      skip,
      take:    parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, phone: true } },
      }
    });

    return res.json({
      success: true,
      data: {
        properties,
        pagination: {
          total,
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        }
      }
    });

  } catch (err) {
    console.error('[listings GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/listings/:id ─────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const property = await db.property.findUnique({
      where:   { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, phone: true, email: true } },
      }
    });

    if (!property) return res.status(404).json({ success: false, message: 'Property nahi mili.' });

    return res.json({ success: true, data: property });

  } catch (err) {
    console.error('[listings/:id GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;