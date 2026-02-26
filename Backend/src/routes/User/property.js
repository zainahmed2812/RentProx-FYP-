// src/routes/User/property.js
// ══════════════════════════════════════════════════════
// User Property Routes
// GET    /api/user/property          — apni tamam properties
// POST   /api/user/property          — nai property add karo
// GET    /api/user/property/:id      — single property detail
// PUT    /api/user/property/:id      — property update karo
// DELETE /api/user/property/:id      — property delete karo
// ══════════════════════════════════════════════════════

import { Router } from 'express';
import db from '../../helpers/db.js';
import { sendSuccess, sendError, catchAsync } from '../../helpers/response.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = Router();
router.use(protect);

const VALID_AREA_UNITS = ['SQFT', 'SQM', 'MARLA', 'KANAL'];

// ── GET all properties (Property Management page) ─────
// GET /api/user/property
router.get('/', catchAsync(async (req, res) => {
  const properties = await db.property.findMany({
    where: { ownerId: req.user.id },
    include: {
      rentals: {
        include: {
          tenant: { select: { id: true, name: true, phone: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Occupancy stats attach karo
  const withStats = properties.map(p => ({
    ...p,
    totalRentals:  p.rentals.length,
    activeRentals: p.rentals.length,
    available:     Math.max(0, 1 - p.rentals.length), // single unit per property
  }));

  return sendSuccess(res, withStats);
}));

// ── GET single property ───────────────────────────────
// GET /api/user/property/:id
router.get('/:id', catchAsync(async (req, res) => {
  const property = await db.property.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
    include: {
      rentals: {
        include: {
          tenant:   { select: { id: true, name: true, email: true, phone: true } },
          payments: { orderBy: { month: 'asc' } },
        },
      },
    },
  });

  if (!property) return sendError(res, 'Property nahi mili', 404);
  return sendSuccess(res, property);
}));

// ── POST add property (Add Property page) ────────────
// POST /api/user/property
// Body: { address, city, area, areaUnit, rentAmount, description }
router.post('/', catchAsync(async (req, res) => {
  const { address, city, area, areaUnit, rentAmount, description } = req.body;

  if (!address || !city || !area || !areaUnit || !rentAmount) {
    return sendError(res, 'Zaruri fields: address, city, area, areaUnit, rentAmount', 400);
  }

  if (!VALID_AREA_UNITS.includes(areaUnit)) {
    return sendError(res, `areaUnit mein se ek choose karein: ${VALID_AREA_UNITS.join(', ')}`, 400);
  }

  if (isNaN(parseFloat(area)) || isNaN(parseFloat(rentAmount))) {
    return sendError(res, 'area aur rentAmount numbers hone chahiye', 400);
  }

  const property = await db.property.create({
    data: {
      address:     address.trim(),
      city:        city.trim(),
      area:        parseFloat(area),
      areaUnit,
      rentAmount:  parseFloat(rentAmount),
      description: description?.trim() || '',
      ownerId:     req.user.id,
    },
  });

  return sendSuccess(res, property, 'Property kamiyabi se add ho gayi!', 201);
}));

// ── PUT update property ───────────────────────────────
// PUT /api/user/property/:id
router.put('/:id', catchAsync(async (req, res) => {
  const existing = await db.property.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
  });
  if (!existing) return sendError(res, 'Property nahi mili', 404);

  const { address, city, area, areaUnit, rentAmount, description } = req.body;

  if (areaUnit && !VALID_AREA_UNITS.includes(areaUnit)) {
    return sendError(res, `areaUnit mein se ek choose karein: ${VALID_AREA_UNITS.join(', ')}`, 400);
  }

  const updated = await db.property.update({
    where: { id: req.params.id },
    data: {
      ...(address    && { address: address.trim() }),
      ...(city       && { city: city.trim() }),
      ...(area       && { area: parseFloat(area) }),
      ...(areaUnit   && { areaUnit }),
      ...(rentAmount && { rentAmount: parseFloat(rentAmount) }),
      ...(description !== undefined && { description: description.trim() }),
    },
  });

  return sendSuccess(res, updated, 'Property update ho gayi!');
}));

// ── DELETE property ───────────────────────────────────
// DELETE /api/user/property/:id
router.delete('/:id', catchAsync(async (req, res) => {
  const existing = await db.property.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
  });
  if (!existing) return sendError(res, 'Property nahi mili', 404);

  await db.property.delete({ where: { id: req.params.id } });
  return sendSuccess(res, null, 'Property delete ho gayi!');
}));

export default router;