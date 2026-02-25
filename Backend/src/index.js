// src/index.js
// ══════════════════════════════════════════════════════
// RentProx Backend — Main Entry Point
// ══════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Routes
import authRoutes          from './routes/authRoutes.js';
import userDashboard       from './routes/User/dashboard.js';
import userProperty        from './routes/User/property.js';
import adminDashboard      from './routes/Admin/dashboard.js';
import adminProperty       from './routes/Admin/property.js';

// Middleware
import { errorHandler }    from './middleware/errorMiddleware.js';

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Core Middleware ───────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,  // cookies allow karne ke liye zaruri
  methods:     ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(cookieParser()); // cookie se token read karne ke liye

// ── Auth (Signup / Login / Logout) ───────────────────
app.use('/api/auth', authRoutes);

// ── User Routes ───────────────────────────────────────
app.use('/api/user/dashboard', userDashboard);
app.use('/api/user/property',  userProperty);

// ── Admin Routes ──────────────────────────────────────
app.use('/api/admin/dashboard', adminDashboard);
app.use('/api/admin/property',  adminProperty);

// ── Health Check ──────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'RentProx API chal raha hai 🚀' });
});

// ── 404 ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} nahi mila` });
});

// ── Global Error Handler (LAST hona chahiye) ──────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ RentProx backend: http://localhost:${PORT}`);
});