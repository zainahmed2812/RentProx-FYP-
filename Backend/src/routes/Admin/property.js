// src/routes/Admin/property.js
// ══════════════════════════════════════════════════════
// Admin Property Management
// GET /api/admin/property        — tamam system properties
// GET /api/admin/property/:id    — kisi bhi property detail
// DELETE /api/admin/property/:id — kisi bhi property delete
// ══════════════════════════════════════════════════════

import { Router } from 'express';
import db from '../../helpers/db.js';
import { sendSuccess, sendError, catchAsync } from '../../helpers/response.js';
import { protect, adminOnly } from '../../middleware/authMiddleware.js';

const router = Router();
router.use(protect, adminOnly);

// GET /api/admin/property
router.get('/', catchAsync(async (req, res) => {
  const properties = await db.property.findMany({
    include: {
      owner: { select: { id: true, name: true, email: true } },
      rentals: { include: { tenant: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return sendSuccess(res, properties);
}));

// GET /api/admin/property/:id
router.get('/:id', catchAsync(async (req, res) => {
  const property = await db.property.findUnique({
    where: { id: req.params.id },
    include: {
      owner:   { select: { id: true, name: true, email: true } },
      rentals: { include: { tenant: true, payments: true } },
    },
  });
  if (!property) return sendError(res, 'Property nahi mili', 404);
  return sendSuccess(res, property);
}));

// DELETE /api/admin/property/:id
router.delete('/:id', catchAsync(async (req, res) => {
  const existing = await db.property.findUnique({ where: { id: req.params.id } });
  if (!existing) return sendError(res, 'Property nahi mili', 404);
  await db.property.delete({ where: { id: req.params.id } });
  return sendSuccess(res, null, 'Property delete ho gayi!');
}));

export default router;