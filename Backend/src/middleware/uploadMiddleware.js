// src/middleware/uploadMiddleware.js
// ══════════════════════════════════════════════════════
// Multer — property images upload ke liye
// Images: Backend/uploads/properties/ folder mein save hongi
// Max: 8 images per property, har image max 5MB
// Allowed: jpg, jpeg, png, webp
//
// Install karo:
//   npm install multer
// ══════════════════════════════════════════════════════

import multer  from 'multer';
import path    from 'path';
import fs      from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Upload folder ensure karo ─────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../../uploads/properties');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Storage config ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Unique filename: timestamp-randomhex-original.ext
    const ext      = path.extname(file.originalname).toLowerCase();
    const unique   = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const safeName = file.originalname
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 40);
    cb(null, `${unique}-${safeName}${ext === '' ? '.jpg' : ''}`);
  }
});

// ── File filter — sirf images ─────────────────────────
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Sirf JPG, PNG, WEBP images allowed hain.'), false);
  }
};

// ── Multer instance ───────────────────────────────────
export const uploadImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5MB per file
    files:    8,                 // max 8 images
  }
}).array('images', 8);           // field name = 'images'

// ── Helper: uploaded file → DB-ready URL ──────────────
// Frontend access ke liye: http://localhost:5000/uploads/properties/filename.jpg
export const fileToUrl = (filename) => `/uploads/properties/${filename}`;
