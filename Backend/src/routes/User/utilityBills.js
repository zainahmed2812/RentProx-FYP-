// src/routes/User/utilityBills.js
// TENANT → app.use('/api/user',  tenantBillRouter)
//   POST /api/user/utility-bills/:agreementId   → upload bill
//   GET  /api/user/utility-bills/:agreementId   → tenant's own bills
// OWNER  → app.use('/api/owner', ownerBillRouter)
//   GET  /api/owner/utility-bills/:agreementId  → view tenant bills

import express    from 'express';
import multer     from 'multer';
import path       from 'path';
import fs         from 'fs';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const db = new PrismaClient();

// ── MULTER CONFIG ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/bills';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    cb(null, `bill_${req.user.id}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits:     { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext     = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only images or PDF files are allowed.'));
  }
});

// ══════════════════════════════════════════════════════
//  TENANT ROUTER
// ══════════════════════════════════════════════════════
export const tenantBillRouter = express.Router();
tenantBillRouter.use(protect);

// POST /api/user/utility-bills/:agreementId
tenantBillRouter.post('/utility-bills/:agreementId', upload.single('bill'), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'File is required.' });

    const { month, billType = 'Utility', notes = '' } = req.body;
    if (!month)
      return res.status(400).json({ success: false, message: 'Month is required.' });

    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.agreementId },
      include: { listing: true }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement not found.' });
    if (agreement.listing.tenantId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your agreement.' });
    if (agreement.status !== 'ACTIVE')
      return res.status(400).json({ success: false, message: 'Agreement is not active.' });

    const bill = await db.utilityBill.create({
      data: {
        agreementId: req.params.agreementId,
        month,
        imagePath:   `/uploads/bills/${req.file.filename}`,
        billType,
        notes,
      }
    });

    return res.status(201).json({ success: true, data: bill, message: `${billType} bill uploaded successfully for ${month}!` });

  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('[utility bill upload]', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
});

// GET /api/user/utility-bills/:agreementId
tenantBillRouter.get('/utility-bills/:agreementId', async (req, res) => {
  try {
    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.agreementId },
      include: { listing: true }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement not found.' });
    if (agreement.listing.tenantId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your agreement.' });

    const bills = await db.utilityBill.findMany({
      where:   { agreementId: req.params.agreementId },
      orderBy: { month: 'desc' }
    });

    return res.json({ success: true, data: bills });
  } catch (err) {
    console.error('[utility bills GET tenant]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ══════════════════════════════════════════════════════
//  OWNER ROUTER
// ══════════════════════════════════════════════════════
export const ownerBillRouter = express.Router();
ownerBillRouter.use(protect);

// GET /api/owner/utility-bills/:agreementId
ownerBillRouter.get('/utility-bills/:agreementId', async (req, res) => {
  try {
    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.agreementId },
      include: { listing: { include: { property: true } } }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement not found.' });
    if (agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your property.' });

    const bills = await db.utilityBill.findMany({
      where:   { agreementId: req.params.agreementId },
      orderBy: { month: 'desc' }
    });

    return res.json({ success: true, data: bills });
  } catch (err) {
    console.error('[utility bills GET owner]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Default export
const combinedBillRouter = express.Router();
combinedBillRouter.use(tenantBillRouter);
combinedBillRouter.use(ownerBillRouter);
export default combinedBillRouter;