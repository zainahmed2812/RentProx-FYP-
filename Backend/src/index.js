// src/index.js
import 'dotenv/config';
import express      from 'express';
import cors         from 'cors';
import cookieParser from 'cookie-parser';

// Routes
import authRoutes     from './routes/authRoutes.js';
import userDashboard  from './routes/User/dashboard.js';
import userProperty   from './routes/User/property.js';
import adminDashboard from './routes/Admin/dashboard.js';
import adminProperty  from './routes/Admin/property.js';
import publicListings  from './routes/public/listings.js';
import tenantRequests  from './routes/User/tenantRequests.js';
import ownerRequests   from './routes/User/ownerRequests.js';
import agreementRoutes from './routes/User/agreement.js';

// Middleware
import { errorHandler } from './middleware/errorMiddleware.js';

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS — development mein sab origins allow ──────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost:8080',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // origin undefined hota hai jab directly Postman ya same-origin se call ho
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(cookieParser());

// ── Routes ─────────────────────────────────────────────
app.use('/api/auth',            authRoutes);
app.use('/api/user/dashboard',  userDashboard);
app.use('/api/user/property',   userProperty);
app.use('/api/admin/dashboard', adminDashboard);
app.use('/api/admin/property',  adminProperty);
app.use('/api/listings',       publicListings);  // public — koi bhi dekh sakta
app.use('/api/user/requests',  tenantRequests);  // tenant — request bhejo/dekho
app.use('/api/owner/requests', ownerRequests);   // owner  — requests manage karo
app.use('/api/user/agreement', agreementRoutes); // dono   — agreement dekho/sign

// ── Health Check ───────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'RentProx API chal raha hai 🚀' });
});

// ── 404 ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} nahi mila` });
});

// ── Global Error Handler (LAST) ────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ RentProx backend: http://localhost:${PORT}`);
  console.log(`📋 Allowed origins: ${allowedOrigins.join(', ')}`);
});