// src/routes/User/property.js
import express from 'express';
import multer  from 'multer';
import path    from 'path';
import fs      from 'fs';
import { PrismaClient } from '@prisma/client';
import { protect }      from '../../middleware/authMiddleware.js';

const router = express.Router();
const db     = new PrismaClient();
router.use(protect);

// ── MULTER CONFIG ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/properties';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `prop_${req.user.id}_${Date.now()}_${Math.random().toString(36).slice(2,7)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits:     { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext     = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP images are allowed.'));
  }
});

// ── POST /api/user/property ───────────────────────────
router.post('/', upload.array('images', 8), async (req, res) => {
  try {
    const { city, address, area, areaUnit, rentAmount, description } = req.body;

    if (!city || !address || !area || !rentAmount)
      return res.status(400).json({ success: false, message: 'City, address, area, and rentAmount are required.' });

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

    // Save images
    if (req.files && req.files.length > 0) {
      await db.propertyImage.createMany({
        data: req.files.map((file, idx) => ({
          propertyId: property.id,
          url:        `/uploads/properties/${file.filename}`,
          isPrimary:  idx === 0,
        }))
      });
    }

    const fullProperty = await db.property.findUnique({
      where:   { id: property.id },
      include: { images: true }
    });

    return res.status(201).json({ success: true, data: fullProperty, message: 'Property added successfully!' });

  } catch (err) {
    // Delete uploaded files if db fails
    if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
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
        images: { orderBy: { isPrimary: 'desc' } },
        listings: {
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
      where:   { id: req.params.id },
      include: { images: true }
    });

    if (!property)
      return res.status(404).json({ success: false, message: 'Property not found.' });
    if (property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your property.' });

    // Delete image files from disk
    property.images.forEach(img => {
      const filePath = img.url.replace('/uploads/', 'uploads/');
      fs.unlink(filePath, () => {});
    });

    await db.property.delete({ where: { id: req.params.id } });

    return res.json({ success: true, message: 'Property deleted successfully.' });

  } catch (err) {
    console.error('[property DELETE]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;