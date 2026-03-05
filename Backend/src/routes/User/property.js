// src/routes/User/property.js
// ══════════════════════════════════════════════════════
// POST /api/user/property          → property + images add karo
// GET  /api/user/property          → meri properties (images ke saath)
// DELETE /api/user/property/:id    → property delete (images bhi)
// POST /api/user/property/:id/images → existing property mein images add
// DELETE /api/user/property/:id/images/:imgId → single image delete
// ══════════════════════════════════════════════════════

import express from 'express';
import fs      from 'fs';
import path    from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient }  from '@prisma/client';
import { protect }       from '../../middleware/authMiddleware.js';
import { uploadImages, fileToUrl } from '../../middleware/uploadMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router    = express.Router();
const db        = new PrismaClient();

router.use(protect);

// ── Helper: file disk se delete karo ──────────────────
function deleteFile(url) {
  try {
    // url = /uploads/properties/filename.jpg
    const filename = path.basename(url);
    const fullPath = path.join(__dirname, '../../../uploads/properties', filename);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (e) {
    console.warn('[deleteFile] Could not delete:', url, e.message);
  }
}

// ── Multer wrapper (promise) ──────────────────────────
function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    uploadImages(req, res, (err) => {
      if (err) reject(err);
      else     resolve();
    });
  });
}

// ── POST /api/user/property — Property + images add ───
router.post('/', async (req, res) => {
  try {
    // Pehle multer run karo (multipart/form-data parse)
    await runUpload(req, res);

    const { city, address, area, areaUnit, rentAmount, description } = req.body;

    if (!city || !address || !area || !rentAmount) {
      // Upload hue files delete karo agar validation fail ho
      (req.files || []).forEach(f => deleteFile(fileToUrl(f.filename)));
      return res.status(400).json({ success: false, message: 'City, address, area, rentAmount zaruri hain.' });
    }

    const files = req.files || [];

    // Transaction: property + images ek saath
    const property = await db.$transaction(async (tx) => {
      const prop = await tx.property.create({
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

      // Images DB mein save karo
      if (files.length > 0) {
        await tx.propertyImage.createMany({
          data: files.map((file, idx) => ({
            propertyId: prop.id,
            url:        fileToUrl(file.filename),
            filename:   file.originalname,
            isPrimary:  idx === 0,   // pehli image primary hogi
            order:      idx,
          }))
        });
      }

      return tx.property.findUnique({
        where:   { id: prop.id },
        include: { images: { orderBy: { order: 'asc' } } }
      });
    });

    return res.status(201).json({
      success: true,
      data:    property,
      message: `Property add ho gayi! ${files.length} image(s) upload hui.`
    });

  } catch (err) {
    // Upload hue files delete karo on error
    (req.files || []).forEach(f => deleteFile(fileToUrl(f.filename)));
    console.error('[property POST]', err);
    if (err.message?.includes('allowed')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/user/property — Meri properties ─────────
router.get('/', async (req, res) => {
  try {
    const properties = await db.property.findMany({
      where:   { ownerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { images: { orderBy: { order: 'asc' } } }
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

    if (!property)                         return res.status(404).json({ success: false, message: 'Property nahi mili.' });
    if (property.ownerId !== req.user.id)  return res.status(403).json({ success: false, message: 'Yeh aap ki property nahi.' });

    // Disk se images delete karo
    property.images.forEach(img => deleteFile(img.url));

    // DB se delete (cascade se images bhi delete hongi)
    await db.property.delete({ where: { id: req.params.id } });

    return res.json({ success: true, message: 'Property delete ho gayi.' });

  } catch (err) {
    console.error('[property DELETE]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/user/property/:id/images — Images add karo existing property mein
router.post('/:id/images', async (req, res) => {
  try {
    await runUpload(req, res);

    const property = await db.property.findUnique({
      where:   { id: req.params.id },
      include: { images: true }
    });

    if (!property)                        return res.status(404).json({ success: false, message: 'Property nahi mili.' });
    if (property.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Yeh aap ki property nahi.' });

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, message: 'Koi image nahi mili.' });

    // Total check: existing + new <= 8
    const totalAfter = property.images.length + files.length;
    if (totalAfter > 8) {
      files.forEach(f => deleteFile(fileToUrl(f.filename)));
      return res.status(400).json({ success: false, message: `Max 8 images allowed. Abhi ${property.images.length} hain.` });
    }

    const nextOrder = property.images.length;
    const newImages = await db.$transaction(
      files.map((file, idx) =>
        db.propertyImage.create({
          data: {
            propertyId: property.id,
            url:        fileToUrl(file.filename),
            filename:   file.originalname,
            isPrimary:  property.images.length === 0 && idx === 0,
            order:      nextOrder + idx,
          }
        })
      )
    );

    return res.json({ success: true, data: newImages, message: `${newImages.length} image(s) add ho gayi.` });

  } catch (err) {
    (req.files || []).forEach(f => deleteFile(fileToUrl(f.filename)));
    console.error('[property images POST]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/user/property/:id/images/:imgId ───────
router.delete('/:id/images/:imgId', async (req, res) => {
  try {
    const image = await db.propertyImage.findUnique({
      where:   { id: req.params.imgId },
      include: { property: true }
    });

    if (!image)                                 return res.status(404).json({ success: false, message: 'Image nahi mili.' });
    if (image.property.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Access nahi hai.' });

    // Disk se delete
    deleteFile(image.url);

    // DB se delete
    await db.propertyImage.delete({ where: { id: req.params.imgId } });

    // Agar primary thi to pehli remaining image ko primary banao
    if (image.isPrimary) {
      const firstRemaining = await db.propertyImage.findFirst({
        where:   { propertyId: req.params.id },
        orderBy: { order: 'asc' }
      });
      if (firstRemaining) {
        await db.propertyImage.update({
          where: { id: firstRemaining.id },
          data:  { isPrimary: true }
        });
      }
    }

    return res.json({ success: true, message: 'Image delete ho gayi.' });

  } catch (err) {
    console.error('[property image DELETE]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
