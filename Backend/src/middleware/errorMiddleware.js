// src/middleware/errorMiddleware.js
// ══════════════════════════════════════════════════════
// Global Error Handler
// index.js mein SABSE LAST register karo:
//   app.use(errorHandler);
// ══════════════════════════════════════════════════════

export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.url} →`, err.message);

  // Prisma: unique constraint violation (P2002)
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field';
    return res.status(409).json({
      success: false,
      message: `Yeh ${field} pehle se registered hai.`
    });
  }

  // Prisma: record not found (P2025)
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record nahi mila.'
    });
  }

  // JWT invalid
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token invalid hai. Dobara login karein.'
    });
  }

  // JWT expired
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expire ho gaya. Dobara login karein.'
    });
  }

  // Default server error
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error aaya.'
  });
};