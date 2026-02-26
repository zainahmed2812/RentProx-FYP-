// src/helpers/db.js
// ══════════════════════════════════════════════════════
// Database Helper — Prisma Client Singleton
// Isko har jagah import karo, naya instance mat banao
// Usage: import db from '../helpers/db.js'
//        const users = await db.user.findMany()
// ══════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export default db;