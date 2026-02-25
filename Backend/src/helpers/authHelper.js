// src/helpers/authHelper.js
// ══════════════════════════════════════════════════════
// Auth Helper — JWT token + Password hashing
// ══════════════════════════════════════════════════════

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET    = process.env.JWT_SECRET || 'rentprox-secret-change-in-production';
const JWT_EXPIRES   = process.env.JWT_EXPIRES || '7d';
const SALT_ROUNDS   = 10;

// ── JWT ───────────────────────────────────────────────

/**
 * Token generate karo
 * @param {{ id: string, email: string, isAdmin: boolean }} payload
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
};

/**
 * Token verify karo — invalid ya expired ho to exception throw hogi
 * @param {string} token
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// ── Password ──────────────────────────────────────────

/**
 * Plain password ko hash karo (signup ke waqt)
 */
export const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

/**
 * Plain password ko hash se compare karo (login ke waqt)
 */
export const comparePassword = (plain, hashed) => bcrypt.compare(plain, hashed);

// ── Cookie options ────────────────────────────────────

/**
 * HttpOnly cookie options — session management ke liye
 */
export const cookieOptions = {
  httpOnly: true,               // JS se access nahi ho sakta (XSS protection)
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 din milliseconds mein
};