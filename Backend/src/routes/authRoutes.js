// src/routes/authRoutes.js
// ══════════════════════════════════════════════════════
// Shared Auth Routes — Admin aur User dono ke liye
// POST /api/auth/signup
// POST /api/auth/login
// POST /api/auth/logout
// GET  /api/auth/me
// ══════════════════════════════════════════════════════

import { Router } from 'express';
import db from '../helpers/db.js';
import { hashPassword, comparePassword, generateToken, cookieOptions } from '../helpers/authHelper.js';
import { sendSuccess, sendError, catchAsync } from '../helpers/response.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// ── SIGNUP ────────────────────────────────────────────
// POST /api/auth/signup
// Body: { name, email, password, phone, address, cnic }
router.post('/signup', catchAsync(async (req, res) => {
  const { name, email, password, phone, address, cnic } = req.body;

  if (!name || !email || !password || !phone || !address || !cnic) {
    return sendError(res, 'Tamam fields zaruri hain: name, email, password, phone, address, cnic', 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendError(res, 'Valid email darj karein', 400);
  }

  if (!/^\d{13}$/.test(cnic.replace(/-/g, ''))) {
    return sendError(res, 'CNIC 13 digits ka hona chahiye', 400);
  }

  if (password.length < 6) {
    return sendError(res, 'Password kam az kam 6 characters ka hona chahiye', 400);
  }

  const existing = await db.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { cnic: cnic.replace(/-/g, '') }] },
  });

  if (existing) {
    const field = existing.email === email.toLowerCase() ? 'Email' : 'CNIC';
    return sendError(res, `${field} pehle se registered hai`, 409);
  }

  const user = await db.user.create({
    data: {
      name:     name.trim(),
      email:    email.toLowerCase().trim(),
      password: await hashPassword(password),
      phone:    phone.trim(),
      address:  address.trim(),
      cnic:     cnic.replace(/-/g, '').trim(),
    },
    select: { id: true, name: true, email: true, phone: true, address: true, cnic: true, isAdmin: true, createdAt: true },
  });

  const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin });

  // Cookie mein bhi set karo (session management)
  res.cookie('token', token, cookieOptions);

  return sendSuccess(res, { user, token }, 'Account kamiyabi se ban gaya!', 201);
}));

// ── LOGIN ─────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
router.post('/login', catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 'Email aur password zaruri hain', 400);
  }

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.active) {
    return sendError(res, 'Email ya password galat hai', 401);
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    return sendError(res, 'Email ya password galat hai', 401);
  }

  const token = generateToken({ id: user.id, email: user.email, isAdmin: user.isAdmin });

  // Cookie mein set karo
  res.cookie('token', token, cookieOptions);

  const { password: _, ...safeUser } = user;

  return sendSuccess(res, { user: safeUser, token }, 'Login kamiyab!');
}));

// ── LOGOUT ────────────────────────────────────────────
// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return sendSuccess(res, null, 'Logout ho gaye hain');
});

// ── ME (current user) ─────────────────────────────────
// GET /api/auth/me  — protected
router.get('/me', protect, catchAsync(async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, phone: true, address: true, cnic: true, isAdmin: true, createdAt: true },
  });
  if (!user) return sendError(res, 'User nahi mila', 404);
  return sendSuccess(res, user);
}));

export default router;