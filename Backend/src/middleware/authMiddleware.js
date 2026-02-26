// src/middleware/authMiddleware.js
// ══════════════════════════════════════════════════════
// Auth Middleware
// Har protected page par jaate hi yeh pehle chalega
// JWT token Bearer header YA cookie dono se check hoga
// ══════════════════════════════════════════════════════

import { verifyToken } from '../helpers/authHelper.js';
import db from '../helpers/db.js';

/**
 * PROTECT — Login check
 * Use: router.get('/dashboard', protect, handler)
 *
 * Frontend se token bhejne ka tarika:
 *   Authorization: Bearer <token>
 *   YA cookie mein 'token' naam se
 */
export const protect = async (req, res, next) => {
  let token = null;

  // 1. Authorization header se token lo
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Agar header mein nahi to cookie se lo
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Login zaruri hai. Token nahi mila.',
      redirect: '/login',
    });
  }

  try {
    const decoded = verifyToken(token);

    // DB se fresh user data lo (deactivated account check)
    const user = await db.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, isAdmin: true, active: true },
    });

    if (!user || !user.active) {
      return res.status(401).json({
        success: false,
        message: 'Account active nahi hai ya exist nahi karta.',
        redirect: '/login',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token invalid ya expired hai. Dobara login karein.',
      redirect: '/login',
    });
  }
};

/**
 * ADMIN ONLY — Sirf admin access
 */
export const adminOnly = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Sirf admin yahan access kar sakta hai.',
    });
  }
  next();
};