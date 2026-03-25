// src/routes/User/ledger.js
// ══════════════════════════════════════════════════════
// OWNER  → app.use('/api/owner', ledgerRoutes)
//   GET /api/owner/ledger                   → sab properties ki payments
//   PUT /api/owner/ledger/:id/verify        → monthly payment verify
//   PUT /api/owner/ledger/:id/reject        → monthly payment reject
//
// TENANT → app.use('/api/user', ledgerRoutes)
//   GET  /api/user/ledger                   → apni payments
//   POST /api/user/ledger/:agreementId/pay  → next month submit
//
// Mount separately in index.js:
//   app.use('/api/owner', ownerLedgerRoutes);
//   app.use('/api/user',  userLedgerRoutes);
// ══════════════════════════════════════════════════════

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/authMiddleware.js';

const db = new PrismaClient();

// ── HELPER ────────────────────────────────────────────
function nextMonthLabel(existingPayments) {
  const now = new Date();
  if (!existingPayments.length) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const months = existingPayments.map(p => p.month).sort();
  const last   = months[months.length - 1];
  const [yr, mo] = last.split('-').map(Number);
  const next = new Date(yr, mo, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════
//  OWNER ROUTER
// ══════════════════════════════════════════════════════
export const ownerLedgerRouter = express.Router();
ownerLedgerRouter.use(protect);

// GET /api/owner/ledger
ownerLedgerRouter.get('/ledger', async (req, res) => {
  try {
    const rentals = await db.rental.findMany({
      where: { ownerId: req.user.id, isActive: true },
      include: {
        property: { select: { id: true, address: true, city: true, rentAmount: true } },
        tenant:   { select: { id: true, name: true, email: true, phone: true } },
        agreement: {
          include: {
            securityPayment: true,
            monthlyPayments: { orderBy: { month: 'asc' } }
          }
        }
      }
    });

    const data = rentals.map(r => ({
      rentalId:        r.id,
      property:        r.property,
      tenant:          r.tenant,
      agreement: {
        id:              r.agreement.id,
        monthlyRent:     r.agreement.monthlyRent,
        securityDeposit: r.agreement.securityDeposit,
        startDate:       r.agreement.startDate,
        endDate:         r.agreement.endDate,
      },
      securityPayment: r.agreement.securityPayment,
      monthlyPayments: r.agreement.monthlyPayments,
    }));

    return res.json({ success: true, data });

  } catch (err) {
    console.error('[owner ledger GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/owner/ledger/:paymentId/verify
ownerLedgerRouter.put('/ledger/:paymentId/verify', async (req, res) => {
  try {
    const payment = await db.monthlyRentPayment.findUnique({
      where:   { id: req.params.paymentId },
      include: { agreement: { include: { listing: { include: { property: true } } } } }
    });

    if (!payment)
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your property.' });
    if (payment.status !== 'PENDING_VERIFICATION')
      return res.status(400).json({ success: false, message: 'Payment has already been processed.' });

    await db.monthlyRentPayment.update({
      where: { id: req.params.paymentId },
      data:  { status: 'VERIFIED', verifiedAt: new Date() }
    });

    return res.json({ success: true, message: 'Payment verified successfully!' });

  } catch (err) {
    console.error('[owner ledger verify]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/owner/ledger/:paymentId/reject
ownerLedgerRouter.put('/ledger/:paymentId/reject', async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const payment = await db.monthlyRentPayment.findUnique({
      where:   { id: req.params.paymentId },
      include: { agreement: { include: { listing: { include: { property: true } } } } }
    });

    if (!payment)
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.agreement.listing.property.ownerId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your property.' });
    if (payment.status !== 'PENDING_VERIFICATION')
      return res.status(400).json({ success: false, message: 'Payment has already been processed.' });

    await db.monthlyRentPayment.update({
      where: { id: req.params.paymentId },
      data:  { status: 'REJECTED', rejectedReason: reason || 'Invalid transaction ID.' }
    });

    return res.json({ success: true, message: 'Payment rejected.' });

  } catch (err) {
    console.error('[owner ledger reject]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ══════════════════════════════════════════════════════
//  TENANT ROUTER
// ══════════════════════════════════════════════════════
export const userLedgerRouter = express.Router();
userLedgerRouter.use(protect);

// GET /api/user/ledger
userLedgerRouter.get('/ledger', async (req, res) => {
  try {
    const rental = await db.rental.findFirst({
      where: { tenantId: req.user.id, isActive: true },
      include: {
        property: { select: { id: true, address: true, city: true } },
        agreement: {
          include: {
            securityPayment: true,
            monthlyPayments: { orderBy: { month: 'asc' } }
          }
        }
      }
    });

    if (!rental) {
      return res.json({ success: true, data: null, message: 'No active rental found.' });
    }

    const mps         = rental.agreement.monthlyPayments;
    const nextMonth   = nextMonthLabel(mps);
    const lastPayment = mps[mps.length - 1];
    const canSubmitNext = !lastPayment || lastPayment.status === 'VERIFIED';

    return res.json({
      success: true,
      data: {
        property:  rental.property,
        agreement: {
          id:              rental.agreement.id,
          monthlyRent:     rental.agreement.monthlyRent,
          securityDeposit: rental.agreement.securityDeposit,
          startDate:       rental.agreement.startDate,
          endDate:         rental.agreement.endDate,
        },
        securityPayment: rental.agreement.securityPayment,
        monthlyPayments: mps,
        nextMonth,
        canSubmitNext,
      }
    });

  } catch (err) {
    console.error('[tenant ledger GET]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/user/ledger/:agreementId/pay
userLedgerRouter.post('/ledger/:agreementId/pay', async (req, res) => {
  try {
    const { transactionId, month, amount } = req.body;

    if (!transactionId?.trim()) return res.status(400).json({ success: false, message: 'Transaction ID is required.' });
    if (!month)                  return res.status(400).json({ success: false, message: 'Month is required.' });

    const agreement = await db.agreement.findUnique({
      where:   { id: req.params.agreementId },
      include: { listing: true, monthlyPayments: true }
    });

    if (!agreement)
      return res.status(404).json({ success: false, message: 'Agreement not found.' });
    if (agreement.listing.tenantId !== req.user.id)
      return res.status(403).json({ success: false, message: 'This is not your agreement.' });
    if (agreement.status !== 'ACTIVE')
      return res.status(400).json({ success: false, message: 'Agreement is not active.' });

    const existing = agreement.monthlyPayments.find(p => p.month === month);
    if (existing?.status === 'PENDING_VERIFICATION')
      return res.status(409).json({ success: false, message: 'A payment for this month is already pending.' });
    if (existing?.status === 'VERIFIED')
      return res.status(409).json({ success: false, message: 'A payment for this month is already verified.' });

    if (existing?.status === 'REJECTED') {
      await db.monthlyRentPayment.update({
        where: { id: existing.id },
        data:  { transactionId: transactionId.trim(), status: 'PENDING_VERIFICATION', rejectedReason: '' }
      });
      return res.json({ success: true, message: 'Payment resubmitted successfully!' });
    }

    await db.monthlyRentPayment.create({
      data: {
        agreementId:   req.params.agreementId,
        transactionId: transactionId.trim(),
        month,
        amount:        parseFloat(amount) || agreement.monthlyRent,
        status:        'PENDING_VERIFICATION',
      }
    });

    return res.status(201).json({
      success: true,
      message: `${month} payment submitted successfully! Waiting for owner to verify.`
    });

  } catch (err) {
    console.error('[tenant ledger pay]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Default export (both routers merged) ──────────────
const ledgerRouter = express.Router();
ledgerRouter.use(ownerLedgerRouter);
ledgerRouter.use(userLedgerRouter);
export default ledgerRouter;