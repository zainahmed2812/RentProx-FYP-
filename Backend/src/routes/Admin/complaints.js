// src/routes/Admin/complaints.js
// ══════════════════════════════════════════════════════
// ADMIN — admin login required
// GET /api/admin/complaints             → sab complaints
// PUT /api/admin/complaints/:id         → status update + admin note
//
// index.js mein add karo:
//   import adminComplaints from './routes/Admin/complaints.js';
//   app.use('/api/admin/complaints', adminComplaints);
// ══════════════════════════════════════════════════════

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();

// Admin middleware
const adminOnly = (req, res, next) => {
  if (!req.user?.isAdmin) return res.status(403).json({ success: false, message: 'Sirf admin access kar sakta hai.' });
  next();
};

router.use(protect, adminOnly);

// ── GET /api/admin/complaints ─────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;

    const complaints = await db.complaint.findMany({
      where: {
        ...(status && { status }),
        ...(type   && { type   }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        tenant:   { select: { id: true, name: true, email: true, phone: true } },
        property: { select: { id: true, address: true, city: true, owner: { select: { name: true, phone: true } } } }
      }
    });

    const summary = {
      total:       complaints.length,
      open:        complaints.filter(c => c.status === 'OPEN').length,
      inProgress:  complaints.filter(c => c.status === 'IN_PROGRESS').length,
      resolved:    complaints.filter(c => c.status === 'RESOLVED').length,
    };

    return res.json({ success: true, data: { complaints, summary } });

  } catch (err) {
    console.error('[admin complaints GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/admin/complaints/:id — Status + note update
router.put('/:id', async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const complaint = await db.complaint.findUnique({ where: { id: req.params.id } });
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint nahi mili.' });

    const updated = await db.complaint.update({
      where: { id: req.params.id },
      data: {
        ...(status    && { status }),
        ...(adminNote != null && { adminNote }),
      }
    });

    return res.json({ success: true, data: updated, message: 'Complaint update ho gayi.' });

  } catch (err) {
    console.error('[admin complaints PUT]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
